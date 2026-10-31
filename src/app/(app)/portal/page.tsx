"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  ShoppingBag,
  FileText,
  Printer,
  Calendar,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface PortalSubscription {
  id: string;
  number: string;
  status: string;
  paused: boolean;
  startDate: string;
  expiryDate?: string | null;
  nextBillingDate?: string | null;
  plan: {
    name: string;
    price: number | string;
    period: string;
  };
  lines: {
    quantity: number;
    unitPrice: number | string;
    product: { name: string };
    variant?: { value: string } | null;
  }[];
}

interface PortalInvoice {
  id: string;
  number: string;
  status: string;
  subscriptionNumber: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  total: number;
  paid: number;
  outstanding: number;
  linesCount: number;
}

export default function CustomerPortalPage() {
  const [activeTab, setActiveTab] = useState<"subscriptions" | "invoices">("subscriptions");
  const [subscriptions, setSubscriptions] = useState<PortalSubscription[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [subsRes, invsRes] = await Promise.all([
        fetch("/api/portal/subscriptions"),
        fetch("/api/portal/invoices"),
      ]);

      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData.subscriptions || []);
      }
      if (invsRes.ok) {
        const invsData = await invsRes.json();
        setInvoices(invsData.invoices || []);
      }
    } catch {
      setError("Failed to load your account records. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmQuote = async (subId: string) => {
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/subscriptions/${subId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to confirm quotation");
      } else {
        setActionSuccess("Quotation confirmed successfully!");
        fetchData();
      }
    } catch {
      setError("Network error confirming quotation");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customer Self-Service Portal</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Review your active subscriptions, quotation proposals, and billing history
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold border transition disabled:opacity-50 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          Refresh Records
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-px">
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 ${
            activeTab === "subscriptions"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          My Subscriptions ({subscriptions.length})
        </button>

        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 ${
            activeTab === "invoices"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <FileText className="w-4 h-4" />
          My Invoices & Receipts ({invoices.length})
        </button>
      </div>

      {/* Tab 1: Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 bg-white rounded-2xl border border-gray-200">
              Loading your subscriptions...
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400 bg-white rounded-2xl border border-gray-200">
              You do not have any subscription records.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub) => {
                const totalAmount = sub.lines.reduce(
                  (sum, l) => sum + Number(l.unitPrice) * l.quantity,
                  0
                );

                return (
                  <div
                    key={sub.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-indigo-600">{sub.number}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            sub.status === "ACTIVE"
                              ? sub.paused
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                              : sub.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : sub.status === "QUOTATION"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {sub.status === "ACTIVE" && sub.paused ? "PAUSED" : sub.status}
                        </span>
                      </div>

                      <div>
                        <div className="text-base font-bold text-gray-900">{sub.plan.name}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          ₹{Number(sub.plan.price).toFixed(2)} / {sub.plan.period.toLowerCase()}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase">Included Items:</div>
                        {sub.lines.map((l, idx) => (
                          <div key={idx} className="flex justify-between text-gray-700">
                            <span>
                              {l.quantity}x {l.product.name}
                              {l.variant && <span className="text-indigo-600 font-medium"> ({l.variant.value})</span>}
                            </span>
                            <span className="font-mono font-medium">₹{(Number(l.unitPrice) * l.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 border-t pt-2">
                        <div>
                          <span className="block text-gray-400">Start Date:</span>
                          <span className="font-mono font-medium text-gray-700">
                            {new Date(sub.startDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-gray-400">Next Renewal:</span>
                          <span className="font-mono font-medium text-gray-700">
                            {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Cycle Cost</div>
                        <div className="text-base font-bold font-mono text-gray-900">₹{totalAmount.toFixed(2)}</div>
                      </div>

                      {sub.status === "QUOTATION" && (
                        <button
                          onClick={() => handleConfirmQuote(sub.id)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          Confirm Proposal
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Invoices */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Invoices & Statements</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">Loading invoices...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">No invoices recorded yet.</td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{inv.number}</td>
                      <td className="py-3 px-4 font-mono text-gray-600">{inv.subscriptionNumber}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-gray-900">
                        ₹{inv.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-emerald-600">
                        ₹{inv.paid.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-indigo-600">
                        ₹{inv.outstanding.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/invoices/${inv.id}/print`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-medium text-[11px] transition"
                        >
                          <Printer className="w-3 h-3" /> PDF
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
