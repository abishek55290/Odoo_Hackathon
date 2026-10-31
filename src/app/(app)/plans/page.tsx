"use client";

import { useEffect, useState } from "react";
import { Repeat, Plus, AlertCircle, X } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: string | number;
  period: string;
  minQuantity: number;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  startDate?: string;
  endDate?: string | null;
  _count?: { subscriptions: number };
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState("MONTHLY");
  const [minQuantity, setMinQuantity] = useState("1");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [autoClose, setAutoClose] = useState(false);
  const [pausable, setPausable] = useState(false);
  const [closable, setClosable] = useState(true);
  const [renewable, setRenewable] = useState(true);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (data.plans) setPlans(data.plans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: parseFloat(price) || 0,
          period,
          minQuantity: parseInt(minQuantity, 10) || 1,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : null,
          autoClose,
          pausable,
          closable,
          renewable,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create plan");
      } else {
        setShowModal(false);
        setName("");
        setPrice("");
        setEndDate("");
        fetchPlans();
      }
    } catch {
      setError("Network error creating plan");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Repeat className="w-6 h-6 text-indigo-600" />
            Subscription Plans
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Define recurring billing periods, minimum seat commitments, and lifecycle policy flags
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Create Plan
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">No plans defined yet.</div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 uppercase">
                    {plan.period}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {plan._count?.subscriptions || 0} active subs
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-gray-900">
                    ₹{Number(plan.price).toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500">/ {plan.period.toLowerCase()}</span>
                </div>

                <div className="mt-4 pt-3 border-t space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Min Commitment:</span>
                    <span className="font-semibold text-gray-900">{plan.minQuantity} unit(s)</span>
                  </div>
                  {plan.endDate && (
                    <div className="flex justify-between text-amber-700 font-medium">
                      <span>Available Until:</span>
                      <span>{new Date(plan.endDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t flex flex-wrap gap-1.5">
                {plan.pausable && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded font-medium">
                    Pausable
                  </span>
                )}
                {plan.closable && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded font-medium">
                    Early Closure
                  </span>
                )}
                {plan.renewable && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded font-medium">
                    Auto-Renewable
                  </span>
                )}
                {plan.autoClose && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded font-medium">
                    Auto-Close on Expiry
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Create Subscription Plan</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Monthly"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="2500.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Billing Period</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Available Start</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Available End (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Minimum Commitment Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2 border-t pt-3 text-xs">
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pausable}
                    onChange={(e) => setPausable(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Allow Customer to Pause
                </label>
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closable}
                    onChange={(e) => setClosable(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Allow Early Closure
                </label>
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewable}
                    onChange={(e) => setRenewable(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Allow Renewal
                </label>
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoClose}
                    onChange={(e) => setAutoClose(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Auto-Close When Plan Expires
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
