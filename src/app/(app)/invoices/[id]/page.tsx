"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface InvoiceDetail {
  id: string;
  number: string;
  status: "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  totalPaid: number;
  outstandingBalance: number;
  isOverdue: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  subscription?: {
    id: string;
    number: string;
    plan: {
      name: string;
      period: string;
    };
  };
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxPercent: number;
    discountAmount: number;
    amount: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    paidAt: string;
    note?: string;
    recordedBy?: {
      name: string;
      email: string;
    };
  }[];
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment Recording State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("UPI");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Email state
  const [sendingEmail, setSendingEmail] = useState(false);

  async function fetchInvoice() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);
        if (data.outstandingBalance > 0) {
          setPaymentAmount(String(data.outstandingBalance));
        }
      } else {
        setErrorMsg("Failed to load invoice details");
      }
    } catch {
      setErrorMsg("Error connecting to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  async function handleConfirm() {
    try {
      const res = await fetch(`/api/invoices/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Invoice confirmed successfully");
        fetchInvoice();
      } else {
        setErrorMsg(data.error || "Confirmation failed");
      }
    } catch {
      setErrorMsg("Error confirming invoice");
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this invoice?")) return;
    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Invoice cancelled");
        fetchInvoice();
      } else {
        setErrorMsg(data.error || "Cancellation failed");
      }
    } catch {
      setErrorMsg("Error cancelling invoice");
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Invoice email successfully dispatched!");
      } else {
        setErrorMsg(data.error || "Failed to send email");
      }
    } catch {
      setErrorMsg("Error dispatching email");
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid positive payment amount");
      return;
    }

    if (amt > invoice.outstandingBalance + 0.01) {
      alert(`Cannot overpay. Outstanding balance is ₹${invoice.outstandingBalance.toFixed(2)}`);
      return;
    }

    setSubmittingPayment(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: amt,
          method: paymentMethod,
          note: paymentNote,
          paidAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Payment of ₹${amt.toFixed(2)} recorded successfully!`);
        setPaymentNote("");
        fetchInvoice();
      } else {
        setErrorMsg(data.error || "Payment recording failed");
      }
    } catch {
      setErrorMsg("Network error recording payment");
    } finally {
      setSubmittingPayment(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-500">Loading invoice details...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8">
        <p className="text-rose-600 font-medium">Invoice not found.</p>
        <Link href="/invoices" className="text-indigo-600 hover:underline mt-2 inline-block">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700 border-gray-300",
    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <Link href="/invoices" className="text-xs text-gray-500 hover:text-gray-900 mb-1 inline-block">
            ← Back to Invoices
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                statusStyles[invoice.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {invoice.status}
            </span>
            {invoice.isOverdue && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                OVERDUE
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === "DRAFT" && (
            <Button onClick={handleConfirm} variant="default" size="sm">
              Confirm Invoice
            </Button>
          )}
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <Button onClick={handleCancel} variant="destructive" size="sm">
              Cancel Invoice
            </Button>
          )}
          <Button
            onClick={handleSendEmail}
            variant="outline"
            size="sm"
            disabled={sendingEmail}
          >
            {sendingEmail ? "Sending..." : "✉ Send Email"}
          </Button>
          <Link
            href={`/invoices/${invoice.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            🖨 Print Layout
          </Link>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold ml-2">
            ✕
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Invoice Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-lg border">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</h3>
          <p className="font-semibold text-gray-900 mt-1">{invoice.customer.name}</p>
          <p className="text-sm text-gray-600">{invoice.customer.email}</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subscription</h3>
          <p className="font-semibold text-gray-900 mt-1">
            {invoice.subscription ? invoice.subscription.number : "Manual / Standalone"}
          </p>
          {invoice.subscription && (
            <p className="text-sm text-gray-600">
              {invoice.subscription.plan.name} ({invoice.subscription.plan.period})
            </p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Billing Period & Dates</h3>
          <p className="text-sm text-gray-800 mt-1">
            <strong>Period:</strong> {new Date(invoice.periodStart).toLocaleDateString()} –{" "}
            {new Date(invoice.periodEnd).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-800">
            <strong>Issued:</strong> {new Date(invoice.issueDate).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-800">
            <strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/50">
          <h2 className="font-semibold text-gray-900">Invoice Items</h2>
        </div>
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3 text-center">Qty</th>
              <th className="px-6 py-3 text-right">Unit Price</th>
              <th className="px-6 py-3 text-right">Discount</th>
              <th className="px-6 py-3 text-right">Tax %</th>
              <th className="px-6 py-3 text-right">Taxable Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-6 py-3 font-medium text-gray-900">{l.description}</td>
                <td className="px-6 py-3 text-center">{l.quantity}</td>
                <td className="px-6 py-3 text-right">₹{l.unitPrice.toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-emerald-600">
                  {l.discountAmount > 0 ? `-₹${l.discountAmount.toFixed(2)}` : "—"}
                </td>
                <td className="px-6 py-3 text-right">{l.taxPercent}%</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">
                  ₹{l.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculation Summary Block */}
        <div className="border-t bg-gray-50/70 p-6 flex flex-col items-end space-y-2 text-sm">
          <div className="flex justify-between w-64 text-gray-600">
            <span>Subtotal:</span>
            <span>₹{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-64 text-emerald-600">
            <span>Total Discounts:</span>
            <span>-₹{invoice.discountTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-64 text-gray-600">
            <span>Taxes:</span>
            <span>₹{invoice.taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-64 pt-2 border-t font-bold text-gray-900 text-base">
            <span>Total:</span>
            <span>₹{invoice.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-64 text-blue-700">
            <span>Total Paid:</span>
            <span>₹{invoice.totalPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-64 pt-2 border-t font-bold text-lg text-rose-700">
            <span>Balance Due:</span>
            <span>₹{invoice.outstandingBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payments History & Recording Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment History */}
        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="font-semibold text-gray-900">Recorded Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {invoice.payments.map((p) => (
                <div key={p.id} className="p-3 rounded-lg border bg-gray-50/50 flex justify-between items-center text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">₹{p.amount.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      via {p.method} on {new Date(p.paidAt).toLocaleDateString()}
                    </div>
                    {p.note && <div className="text-xs italic text-gray-400 mt-0.5">"{p.note}"</div>}
                  </div>
                  {p.recordedBy && (
                    <div className="text-xs text-gray-400 text-right">
                      Recorded by: {p.recordedBy.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Record Manual Payment Form */}
        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="font-semibold text-gray-900">Record Payment</h2>
          {invoice.status === "CANCELLED" ? (
            <p className="text-sm text-gray-500">Payments cannot be recorded against a cancelled invoice.</p>
          ) : invoice.outstandingBalance <= 0 ? (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm font-medium">
              ✓ This invoice is fully settled!
            </div>
          ) : (
            <form onSubmit={handleRecordPayment} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={invoice.outstandingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Max payable: ₹{invoice.outstandingBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Credit/Debit Card</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes / Reference # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank txn ref 987123"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <Button
                type="submit"
                disabled={submittingPayment}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {submittingPayment ? "Recording Payment..." : `Record ₹${parseFloat(paymentAmount || "0").toFixed(2)} Payment`}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
