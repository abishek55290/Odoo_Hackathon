import { db } from "@/lib/db";
import { InvoiceStatus, PaymentMethod } from "@prisma/client";

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paidAt?: Date | string;
  note?: string;
  recordedById: string;
}

export interface PaymentSummary {
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: number;
  totalPaid: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  status: InvoiceStatus;
}

/**
 * Calculates current payment summary for an invoice.
 */
export async function getInvoicePaymentSummary(invoiceId: string): Promise<PaymentSummary | null> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) return null;

  const total = Number(invoice.total);
  const totalPaid = Math.round(
    invoice.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) * 100
  ) / 100;
  const remainingBalance = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
  const isFullyPaid = remainingBalance <= 0;

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    invoiceTotal: total,
    totalPaid,
    remainingBalance,
    isFullyPaid,
    status: invoice.status,
  };
}

/**
 * Records a payment against an invoice inside an atomic transaction:
 * - Rejects non-positive payments.
 * - Rejects payments against CANCELLED invoices.
 * - Rejects overpayments where amount > remaining balance.
 * - Transitions invoice status to PAID if fully settled.
 */
export async function recordPayment(input: RecordPaymentInput) {
  const { invoiceId, amount, paidAt, note } = input;
  const rawMethod = (input.method || (input as any).paymentMethod || "CARD").toString().toUpperCase();
  let method: PaymentMethod = PaymentMethod.CARD;
  if (rawMethod === "CASH") method = PaymentMethod.CASH;
  else if (rawMethod === "BANK_TRANSFER") method = PaymentMethod.BANK_TRANSFER;
  else if (rawMethod === "UPI") method = PaymentMethod.UPI;
  else if (rawMethod === "CHEQUE") method = PaymentMethod.CHEQUE;
  else method = PaymentMethod.CARD;

  const recordedById = input.recordedById || null;

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  return await db.$transaction(async (tx: any) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new Error("Cannot record payment against a canceled invoice");
    }

    const invoiceTotal = Number(invoice.total);
    const alreadyPaid = Math.round(
      invoice.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) * 100
    ) / 100;
    const remainingBalance = Math.round((invoiceTotal - alreadyPaid) * 100) / 100;

    // Reject overpayments (allowing for 1 cent rounding tolerance)
    if (amount > remainingBalance + 0.009) {
      throw new Error(
        `Overpayment rejected: payment amount (${amount}) exceeds remaining balance (${remainingBalance})`
      );
    }

    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        amount,
        method,
        paidAt: paymentDate,
        note: note || null,
        recordedById,
      },
    });

    const newTotalPaid = Math.round((alreadyPaid + amount) * 100) / 100;
    const newRemainingBalance = Math.max(0, Math.round((invoiceTotal - newTotalPaid) * 100) / 100);

    let updatedStatus = invoice.status;
    if (newRemainingBalance <= 0) {
      updatedStatus = InvoiceStatus.PAID;
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
    }

    return {
      payment,
      summary: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceTotal,
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        isFullyPaid: newRemainingBalance <= 0,
        status: updatedStatus,
      },
    };
  });
}
