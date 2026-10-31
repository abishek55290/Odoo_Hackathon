import { db } from "@/lib/db";
import { InvoiceStatus, Prisma } from "@prisma/client";
import nodemailer from "nodemailer";

export interface InvoiceFilters {
  status?: InvoiceStatus;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getInvoices(filters: InvoiceFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.InvoiceWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { number: { contains: s, mode: "insensitive" } },
      { customer: { name: { contains: s, mode: "insensitive" } } },
      { customer: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  const [totalCount, invoices] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        subscription: { select: { id: true, number: true } },
        payments: { select: { id: true, amount: true, paidAt: true, method: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items = invoices.map((inv) => {
    const total = Number(inv.total);
    const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    const isOverdue = inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.dueDate < new Date();

    return {
      ...inv,
      subtotal: Number(inv.subtotal),
      discountTotal: Number(inv.discountTotal),
      taxTotal: Number(inv.taxTotal),
      total,
      totalPaid: paid,
      outstandingBalance: balance,
      isOverdue,
      linesCount: inv._count.lines,
    };
  });

  return {
    items,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

export async function getInvoiceById(id: string) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      subscription: {
        include: {
          plan: true,
        },
      },
      lines: true,
      payments: {
        include: {
          recordedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { paidAt: "desc" },
      },
    },
  });

  if (!invoice) return null;

  const total = Number(invoice.total);
  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const isOverdue = invoice.status !== "PAID" && invoice.status !== "CANCELLED" && invoice.dueDate < new Date();

  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    discountTotal: Number(invoice.discountTotal),
    taxTotal: Number(invoice.taxTotal),
    total,
    totalPaid: paid,
    outstandingBalance: balance,
    isOverdue,
    lines: invoice.lines.map((l) => ({
      ...l,
      unitPrice: Number(l.unitPrice),
      taxPercent: Number(l.taxPercent),
      discountAmount: Number(l.discountAmount),
      amount: Number(l.amount),
    })),
    payments: invoice.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}

export async function confirmInvoice(id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error(`Cannot confirm an invoice with status ${invoice.status}`);
  }

  return await db.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CONFIRMED },
  });
}

export async function cancelInvoice(id: string) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { payments: true },
  });

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === InvoiceStatus.PAID) {
    throw new Error("Cannot cancel an already paid invoice");
  }
  if (invoice.payments.length > 0) {
    throw new Error("Cannot cancel an invoice with recorded payments. Please refund or remove payments first.");
  }

  return await db.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CANCELLED },
  });
}

/**
 * Sends invoice email if SMTP credentials are provided.
 * If SMTP is not configured, explicitly returns an error.
 */
export async function sendInvoiceEmail(id: string) {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new Error("Invoice not found");

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Strict check: if credentials are not configured, do not fake success
  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in the environment.");
  }

  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const from = process.env.MAIL_FROM || "Brightloop <billing@brightloop.test>";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const linesHtml = invoice.lines
    .map(
      (l) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${l.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${l.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${l.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${l.discountAmount.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${l.amount.toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2>Invoice ${invoice.number}</h2>
      <p>Hello ${invoice.customer.name},</p>
      <p>Your invoice for the period ${new Date(invoice.periodStart).toLocaleDateString()} to ${new Date(invoice.periodEnd).toLocaleDateString()} is ready.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background: #f7f7f7;">
            <th style="padding: 8px; text-align: left;">Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Unit Price</th>
            <th style="padding: 8px; text-align: right;">Discount</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml}
        </tbody>
      </table>

      <div style="margin-top: 20px; text-align: right;">
        <p><strong>Subtotal:</strong> ₹${invoice.subtotal.toFixed(2)}</p>
        <p><strong>Discount Total:</strong> -₹${invoice.discountTotal.toFixed(2)}</p>
        <p><strong>Tax Total:</strong> ₹${invoice.taxTotal.toFixed(2)}</p>
        <p style="font-size: 1.2em;"><strong>Total:</strong> ₹${invoice.total.toFixed(2)}</p>
        <p><strong>Balance Due:</strong> ₹${invoice.outstandingBalance.toFixed(2)}</p>
        <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
      </div>

      <p style="margin-top: 24px; color: #666; font-size: 0.9em;">Thank you for your business!</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from,
    to: invoice.customer.email,
    subject: `Invoice ${invoice.number} from Brightloop`,
    html: emailHtml,
  });

  return { success: true, messageId: info.messageId };
}
