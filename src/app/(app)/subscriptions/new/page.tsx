"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, Plus, Trash2, AlertCircle, ArrowLeft } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: string | number;
  period: string;
  minQuantity: number;
}

interface ProductVariant {
  id: string;
  attribute: string;
  value: string;
  extraPrice: string | number;
}

interface Product {
  id: string;
  name: string;
  salesPrice: string | number;
  variants: ProductVariant[];
}

export default function NewSubscriptionPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 15");
  const [lines, setLines] = useState<{ productId: string; variantId: string; quantity: number }[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.plans) {
          setPlans(d.plans);
          if (d.plans.length > 0) setSelectedPlanId(d.plans[0].id);
        }
      });

    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.products) {
          setProducts(d.products);
          if (d.products.length > 0) {
            setLines([{ productId: d.products[0].id, variantId: "", quantity: 1 }]);
          }
        }
      });
  }, []);

  const addLine = () => {
    if (products.length === 0) return;
    setLines([...lines, { productId: products[0].id, variantId: "", quantity: 1 }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "productId") {
      updated[idx].variantId = "";
    }
    setLines(updated);
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Live calculation based on shared technical contract:
  // line unit price = plan price + variant extraPrice
  const preview = lines.map((line) => {
    const prod = products.find((p) => p.id === line.productId);
    const variant = prod?.variants.find((v) => v.id === line.variantId);
    const basePlanPrice = selectedPlan ? Number(selectedPlan.price) : 0;
    const variantExtra = variant ? Number(variant.extraPrice) : 0;
    const unitPrice = basePlanPrice + variantExtra;
    const amount = unitPrice * line.quantity;
    return { unitPrice, amount };
  });

  const totalAmount = preview.reduce((acc, p) => acc + p.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerId.trim()) {
      setError("Please enter or specify a Customer ID");
      return;
    }
    if (!selectedPlanId) {
      setError("Please select a plan");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId.trim(),
          planId: selectedPlanId,
          paymentTerms,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            quantity: l.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create subscription");
      } else {
        router.push("/subscriptions");
        router.refresh();
      }
    } catch {
      setError("Network error submitting subscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/subscriptions" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Subscriptions
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create New Subscription</h1>
            <p className="text-xs text-gray-500">Configure customer, plan commitment, product variants and immutable pricing snapshot</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Customer User ID</label>
              <input
                type="text"
                required
                placeholder="Customer CUID or ID"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Select Recurring Plan</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{Number(p.price).toFixed(2)}/{p.period.toLowerCase()} (Min: {p.minQuantity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Payment Terms</label>
            <input
              type="text"
              placeholder="e.g. Net 15"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Lines Builder */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-700 uppercase">Subscription Line Items</label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const prod = products.find((p) => p.id === line.productId);
                const itemPreview = preview[idx];

                return (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Product</label>
                        <select
                          value={line.productId}
                          onChange={(e) => updateLine(idx, "productId", e.target.value)}
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Variant (Optional)</label>
                        <select
                          value={line.variantId}
                          onChange={(e) => updateLine(idx, "variantId", e.target.value)}
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs"
                        >
                          <option value="">No Variant Surcharge</option>
                          {prod?.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.attribute}: {v.value} (+₹{Number(v.extraPrice).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Quantity</label>
                        <input
                          type="number"
                          min={selectedPlan?.minQuantity || 1}
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {itemPreview && (
                      <div className="flex items-center justify-between text-xs text-gray-600 bg-white p-2.5 rounded-lg border">
                        <span>
                          Unit Price Snapshot: <strong>₹{itemPreview.unitPrice.toFixed(2)}</strong>
                        </span>
                        <span className="font-bold text-gray-900">
                          Line Subtotal: ₹{itemPreview.amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-800 font-semibold uppercase">Total Contract Value</div>
              <div className="text-xs text-emerald-600">Calculated via immutable snapshot pricing</div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-900">₹{totalAmount.toFixed(2)}</div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/subscriptions"
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Save Draft Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
