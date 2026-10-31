"use client";

import { useEffect, useState, use } from "react";

interface PrintInvoice {
  id: string;
  number: string;
  status: string;
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
  customer: {
    name: string;
    email: string;
  };
  subscription?: {
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
}

export default function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [invoice, setInvoice] = useState<PrintInvoice | null>(null);

  useEffect(() => {
    async function loadData() {
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);
      }
    }
    loadData();
  }, [id]);

  if (!invoice) {
    return <div className="p-8 text-center text-gray-400">Loading invoice print layout...</div>;
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto print:p-0 print:max-w-none text-gray-900 font-sans">
      {/* Print Trigger Button (Hidden in Print View) */}
      <div className="mb-6 flex justify-between items-center print:hidden bg-gray-50 p-4 rounded border">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Print Preview</h2>
          <p className="text-xs text-gray-500">Ready for printing or PDF export.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded shadow"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Invoice Document Header */}
      <div className="border-b pb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">BRIGHTLOOP</h1>
          <p className="text-sm text-gray-500 mt-1">Subscription Billing & Revenue Management</p>
          <p className="text-xs text-gray-400">GSTIN: 29AAAAA0000A1Z5</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-700">{invoice.number}</div>
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-1">
            Status: {invoice.status}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            <strong>Date:</strong> {new Date(invoice.issueDate).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500">
            <strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Customer & Period Info */}
      <div className="grid grid-cols-2 gap-8 my-6 text-sm">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Billed To</h3>
          <p className="font-bold text-gray-900 text-base mt-1">{invoice.customer.name}</p>
          <p className="text-gray-600">{invoice.customer.email}</p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Subscription Period</h3>
          <p className="text-gray-800 mt-1">
            <strong>Ref:</strong> {invoice.subscription ? invoice.subscription.number : "Manual"}
          </p>
          <p className="text-gray-600">
            {new Date(invoice.periodStart).toLocaleDateString()} to {new Date(invoice.periodEnd).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Itemized Table */}
      <table className="w-full text-left text-sm border-collapse my-6">
        <thead>
          <tr className="border-y border-gray-300 bg-gray-50 text-xs font-bold uppercase text-gray-600">
            <th className="py-2.5 px-3">Description</th>
            <th className="py-2.5 px-3 text-center">Qty</th>
            <th className="py-2.5 px-3 text-right">Unit Price</th>
            <th className="py-2.5 px-3 text-right">Discount</th>
            <th className="py-2.5 px-3 text-right">Tax %</th>
            <th className="py-2.5 px-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {invoice.lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2 px-3 font-medium text-gray-900">{l.description}</td>
              <td className="py-2 px-3 text-center">{l.quantity}</td>
              <td className="py-2 px-3 text-right">₹{l.unitPrice.toFixed(2)}</td>
              <td className="py-2 px-3 text-right text-gray-600">
                {l.discountAmount > 0 ? `-₹${l.discountAmount.toFixed(2)}` : "—"}
              </td>
              <td className="py-2 px-3 text-right">{l.taxPercent}%</td>
              <td className="py-2 px-3 text-right font-semibold text-gray-900">
                ₹{l.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-end my-6 text-sm">
        <div className="w-72 space-y-2 border-t pt-4">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span>₹{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Discounts:</span>
            <span>-₹{invoice.discountTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax:</span>
            <span>₹{invoice.taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-base text-gray-900">
            <span>Total:</span>
            <span>₹{invoice.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Paid:</span>
            <span>₹{invoice.totalPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-2 font-extrabold text-lg text-gray-900">
            <span>Amount Due:</span>
            <span>₹{invoice.outstandingBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-12 border-t pt-6 text-center text-xs text-gray-400">
        <p>Thank you for using Brightloop. For inquiries, contact billing@brightloop.test.</p>
        <p className="mt-1">Computer generated invoice. No signature required.</p>
      </div>
    </div>
  );
}
