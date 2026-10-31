"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface TaxItem {
  id: string;
  name: string;
  ratePercent: number;
  basisPoints: number;
  active: boolean;
  usageCount: number;
}

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<TaxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function fetchTaxes() {
    setLoading(true);
    try {
      const res = await fetch("/api/taxes");
      if (res.ok) {
        const data = await res.json();
        setTaxes(data);
      }
    } catch (err) {
      console.error("Failed to load taxes", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTaxes();
  }, []);

  async function handleCreateTax(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const rate = parseFloat(ratePercent);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setErrorMsg("Rate must be between 0% and 100%");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ratePercent: rate,
          active,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Tax rule "${name}" created successfully!`);
        setName("");
        setRatePercent("");
        setShowAddForm(false);
        fetchTaxes();
      } else {
        setErrorMsg(data.error || "Failed to create tax rule (Requires ADMIN role)");
      }
    } catch {
      setErrorMsg("Error creating tax rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tax Rules</h1>
          <p className="text-sm text-gray-500">
            Admin-controlled statutory rates computed in integer basis points
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
            {showAddForm ? "Cancel" : "+ Add Tax Rule (Admin)"}
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

      {/* Add Tax Rule Card */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">New Tax Rule</h2>
          <form onSubmit={handleCreateTax} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tax Name</label>
              <input
                type="text"
                placeholder="e.g. GST 18%, VAT 5%"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rate (%)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 18.00"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">
                Basis points: {ratePercent ? Math.round(parseFloat(ratePercent) * 100) : 0} bps
              </p>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submitting ? "Saving..." : "Save Rule"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Taxes Table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
            <tr>
              <th className="px-6 py-3">Tax Name</th>
              <th className="px-6 py-3 text-right">Rate (%)</th>
              <th className="px-6 py-3 text-right">Basis Points (bps)</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Items Linked</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  Loading tax rules...
                </td>
              </tr>
            ) : taxes.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  No tax rules found.
                </td>
              </tr>
            ) : (
              taxes.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/70">
                  <td className="px-6 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">
                    {t.ratePercent.toFixed(2)}%
                  </td>
                  <td className="px-6 py-3 text-right text-gray-600 font-mono">
                    {t.basisPoints} bps
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        t.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-xs text-gray-500">
                    {t.usageCount}
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
