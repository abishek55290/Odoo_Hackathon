"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PaymentItem {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string;
  invoice: {
    id: string;
    number: string;
    total: number;
    status: string;
    customer: {
      name: string;
      email: string;
    };
  };
  recordedBy?: {
    name: string;
  };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  async function fetchPayments() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error("Failed to load payments", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter((p) => {
    if (methodFilter && p.method !== methodFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchInv = p.invoice?.number?.toLowerCase().includes(s);
      const matchCust = p.invoice?.customer?.name?.toLowerCase().includes(s);
      const matchEmail = p.invoice?.customer?.email?.toLowerCase().includes(s);
      const matchNote = p.note?.toLowerCase().includes(s);
      if (!matchInv && !matchCust && !matchEmail && !matchNote) return false;
    }
    return true;
  });

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Payment Tracking</h1>
          <p className="text-sm text-gray-500">
            Audit manual settlement transactions across all invoices
          </p>
        </div>
        <div>
          <Link
            href="/invoices"
            className="inline-flex items-center text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            ← View Invoices to Record Payment
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Collected</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalCollected.toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Transactions</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{payments.length}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Settlement Engine</p>
          <p className="text-sm font-medium text-emerald-700 mt-2">Active (Prisma Transactions)</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-lg border">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search payments by invoice, customer, note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-500 font-medium">Method:</span>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3 text-right">Recorded By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  Loading payments...
                </td>
              </tr>
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No payment transactions found.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(p.paidAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-indigo-600">
                    <Link href={`/invoices/${p.invoice.id}`} className="hover:underline">
                      {p.invoice.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.invoice.customer.name}</div>
                    <div className="text-xs text-gray-400">{p.invoice.customer.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                      {p.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ₹{p.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 italic">
                    {p.note || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {p.recordedBy?.name || "System"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
