"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface InvoiceItem {
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
  linesCount: number;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  subscription?: {
    id: string;
    number: string;
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Billing run state
  const [runningBilling, setRunningBilling] = useState(false);
  const [billingResult, setBillingResult] = useState<{
    success: boolean;
    generatedCount: number;
    duplicateCount: number;
    skippedCount: number;
    processedCount: number;
    timestamp: string;
  } | null>(null);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "15");

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, page]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  }

  async function handleRunBilling() {
    if (runningBilling) return;
    setRunningBilling(true);
    setBillingResult(null);
    try {
      const res = await fetch("/api/billing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOfDate: new Date().toISOString() }),
      });
      const data = await res.json();
      if (res.ok) {
        setBillingResult(data);
        fetchInvoices();
      } else {
        alert(data.error || "Billing run failed");
      }
    } catch (err) {
      alert("Error triggering billing run");
    } finally {
      setRunningBilling(false);
    }
  }

  async function handleConfirm(id: string) {
    try {
      const res = await fetch(`/api/invoices/${id}/confirm`, { method: "POST" });
      if (res.ok) {
        fetchInvoices();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to confirm invoice");
      }
    } catch {
      alert("Error confirming invoice");
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this invoice?")) return;
    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, { method: "POST" });
      if (res.ok) {
        fetchInvoices();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel invoice");
      }
    } catch {
      alert("Error cancelling invoice");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Invoice Management</h1>
          <p className="text-sm text-gray-500">
            View, track, confirm, and generate recurring billing invoices
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/taxes" className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 font-medium">
            Tax Rules
          </Link>
          <Link href="/discounts" className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 font-medium">
            Discount Rules
          </Link>
          <Button
            onClick={handleRunBilling}
            disabled={runningBilling}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            {runningBilling ? "Running Billing Engine..." : "⚡ Run Recurring Billing"}
          </Button>
        </div>
      </div>

      {/* Billing Run Notification Banner */}
      {billingResult && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <div>
            <p className="font-semibold text-emerald-800">
              Billing Run Completed Successfully!
            </p>
            <p className="text-sm mt-0.5 text-emerald-700">
              Processed: <strong>{billingResult.processedCount}</strong> subscriptions | Generated:{" "}
              <strong>{billingResult.generatedCount}</strong> invoices | Duplicates Prevented:{" "}
              <strong>{billingResult.duplicateCount}</strong> | Skipped:{" "}
              <strong>{billingResult.skippedCount}</strong>
            </p>
          </div>
          <button
            onClick={() => setBillingResult(null)}
            className="text-xs text-emerald-700 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-lg border">
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-80">
          <input
            type="text"
            placeholder="Search invoice #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses ({totalCount})</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PAID">PAID</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance Due</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  Loading invoices...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  No invoices found. Click <strong>Run Recurring Billing</strong> to generate invoices for active subscriptions.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const statusStyles: Record<string, string> = {
                  DRAFT: "bg-gray-100 text-gray-700 border-gray-300",
                  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
                  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
                };

                return (
                  <tr key={inv.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-medium text-indigo-600">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{inv.customer.name}</div>
                      <div className="text-xs text-gray-400">{inv.customer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(inv.periodStart).toLocaleDateString()} -{" "}
                      {new Date(inv.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-gray-900">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </div>
                      {inv.isOverdue && (
                        <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                          OVERDUE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ₹{inv.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ₹{inv.outstandingBalance.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                          statusStyles[inv.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="inline-block text-xs font-medium px-2 py-1 text-indigo-600 hover:text-indigo-800"
                      >
                        View
                      </Link>
                      {inv.status === "DRAFT" && (
                        <button
                          onClick={() => handleConfirm(inv.id)}
                          className="text-xs font-medium px-2 py-1 text-blue-600 hover:underline"
                        >
                          Confirm
                        </button>
                      )}
                      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleCancel(inv.id)}
                          className="text-xs font-medium px-2 py-1 text-rose-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
