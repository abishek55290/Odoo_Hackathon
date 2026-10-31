"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DiscountItem {
  id: string;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
  minPurchase?: number | null;
  minQuantity?: number | null;
  startDate: string;
  endDate?: string | null;
  usageLimit?: number | null;
  timesUsed: number;
  scope: "PRODUCT" | "SUBSCRIPTION";
  productId?: string | null;
  product?: { name: string } | null;
  isExpired: boolean;
  isExhausted: boolean;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<"FIXED" | "PERCENTAGE">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"PRODUCT" | "SUBSCRIPTION">("SUBSCRIPTION");
  const [minQuantity, setMinQuantity] = useState("");
  const [minPurchase, setMinPurchase] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function fetchDiscounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/discounts");
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data);
      }
    } catch (err) {
      console.error("Failed to load discounts", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDiscounts();
  }, []);

  async function handleCreateDiscount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const val = parseFloat(value);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("Value must be a positive number");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          value: val,
          scope,
          minQuantity: minQuantity ? parseInt(minQuantity, 10) : null,
          minPurchase: minPurchase ? parseFloat(minPurchase) : null,
          usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
          startDate: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Discount rule "${name}" created successfully!`);
        setName("");
        setValue("");
        setMinQuantity("");
        setMinPurchase("");
        setUsageLimit("");
        setShowAddForm(false);
        fetchDiscounts();
      } else {
        setErrorMsg(data.error || "Failed to create discount rule (Requires ADMIN role)");
      }
    } catch {
      setErrorMsg("Error creating discount rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Discount Engine</h1>
          <p className="text-sm text-gray-500">
            Admin-controlled discounts with usage limits, eligibility checks, and scope rules
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/invoices"
            className="text-xs px-3 py-2 border rounded-lg hover:bg-gray-50 font-medium"
          >
            ← Back to Invoices
          </Link>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            {showAddForm ? "Cancel" : "+ Add Discount Rule (Admin)"}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {successMsg}
        </div>
      )}

      {/* Add Discount Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Create Discount Rule</h2>
          <form onSubmit={handleCreateDiscount} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. 10% Off 10+ Seats"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Value ({type === "PERCENTAGE" ? "%" : "₹"})
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={type === "PERCENTAGE" ? "10" : "500"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="SUBSCRIPTION">Subscription-Wide</option>
                <option value="PRODUCT">Product-Specific</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Min Quantity (Optional)</label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Uses / Limit (Optional)</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {submitting ? "Saving..." : "Create Discount Rule"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Discounts Table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Discount Rule</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-center">Scope</th>
              <th className="px-4 py-3 text-center">Usage</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  Loading discount rules...
                </td>
              </tr>
            ) : discounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  No discount rules configured.
                </td>
              </tr>
            ) : (
              discounts.map((d) => {
                const isInactive = d.isExpired || d.isExhausted;
                return (
                  <tr key={d.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{d.name}</div>
                      {d.minQuantity && (
                        <div className="text-xs text-gray-400">Min Qty: {d.minQuantity}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-600">{d.type}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {d.type === "PERCENTAGE" ? `${d.value}%` : `₹${d.value.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                        {d.scope}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                      {d.timesUsed} / {d.usageLimit !== null ? d.usageLimit : "∞"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isInactive
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {d.isExpired ? "Expired" : d.isExhausted ? "Limit Reached" : "Active"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
