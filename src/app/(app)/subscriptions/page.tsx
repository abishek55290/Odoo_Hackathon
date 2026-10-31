"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Plus, AlertCircle, Play, Pause, RefreshCw, XCircle, CheckCircle } from "lucide-react";

interface SubscriptionLine {
  id: string;
  quantity: number;
  unitPrice: string | number;
  amount: string | number;
  product: { name: string };
  variant?: { attribute: string; value: string; extraPrice: string | number } | null;
}

interface Subscription {
  id: string;
  number: string;
  status: string;
  paused: boolean;
  startDate: string;
  expiryDate?: string | null;
  quoteValidUntil?: string | null;
  nextBillingDate?: string | null;
  paymentTerms?: string | null;
  customer: { name: string; email: string };
  plan: { name: string; period: string };
  lines: SubscriptionLine[];
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/subscriptions?status=${statusFilter}` : "/api/subscriptions";
      const res = await fetch(url);
      const data = await res.json();
      if (data.subscriptions) setSubscriptions(data.subscriptions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter]);

  const handleTransition = async (id: string, action: string) => {
    setActionError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/subscriptions/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Transition failed");
      } else {
        fetchSubscriptions();
      }
    } catch {
      setActionError("Error triggering status transition");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
            Subscription Lifecycle Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Track customer recurring agreements, manage quotes, renewals and automated billing milestones
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="QUOTATION">Quotation</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>

          <Link
            href="/subscriptions/new"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Subscription
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No subscriptions found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="py-3 px-4">Subscription #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Plan & Lines</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Next Billing Date</th>
                  <th className="py-3 px-4 text-right">Contract Total</th>
                  <th className="py-3 px-4 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscriptions.map((sub) => {
                  const total = sub.lines.reduce((acc, l) => acc + Number(l.amount), 0);
                  const isBusy = busyId === sub.id;

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{sub.number}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{sub.customer.name}</div>
                        <div className="text-xs text-gray-400">{sub.customer.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{sub.plan.name}</div>
                        <div className="text-xs text-gray-500">
                          {sub.lines.map((l, i) => (
                            <span key={i}>
                              {l.quantity}x {l.product.name}
                              {l.variant ? ` (${l.variant.value})` : ""}
                              {i < sub.lines.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            sub.status === "ACTIVE"
                              ? sub.paused
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                              : sub.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : sub.status === "CLOSED"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {sub.status === "ACTIVE" && sub.paused ? "PAUSED" : sub.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-600">
                        {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">₹{total.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sub.status === "DRAFT" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleTransition(sub.id, "TO_QUOTATION")}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs rounded font-medium border border-purple-200"
                            >
                              Send Quote
                            </button>
                          )}
                          {(sub.status === "QUOTATION" || sub.status === "DRAFT") && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleTransition(sub.id, "CONFIRM")}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded font-medium border border-blue-200"
                            >
                              Confirm
                            </button>
                          )}
                          {sub.status === "CONFIRMED" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleTransition(sub.id, "ACTIVATE")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-semibold shadow-sm flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Activate
                            </button>
                          )}
                          {sub.status === "ACTIVE" && !sub.paused && (
                            <>
                              <button
                                disabled={isBusy}
                                onClick={() => handleTransition(sub.id, "PAUSE")}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs rounded font-medium border border-amber-200"
                              >
                                Pause
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => handleTransition(sub.id, "CLOSE")}
                                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs rounded font-medium border"
                              >
                                Close
                              </button>
                            </>
                          )}
                          {sub.status === "ACTIVE" && sub.paused && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleTransition(sub.id, "RESUME")}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs rounded font-medium border border-emerald-200"
                            >
                              Resume
                            </button>
                          )}
                          {sub.status === "CLOSED" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleTransition(sub.id, "RENEW")}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded font-medium border border-blue-200"
                            >
                              Renew
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
