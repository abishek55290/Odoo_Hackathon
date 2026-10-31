"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, Plus, Trash2, AlertCircle, ArrowLeft, UserCheck, Sparkles } from "lucide-react";

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

interface Customer {
  id: string;
  name: string;
  email: string;
}

function SubscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 15");
  const [lines, setLines] = useState<{ productId: string; variantId: string; quantity: number }[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);

  // 1. Fetch initial catalog data and customers
  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.plans) {
          setPlans(d.plans);
          if (d.plans.length > 0 && !selectedPlanId) setSelectedPlanId(d.plans[0].id);
        }
      });

    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.products) {
          setProducts(d.products);
          if (d.products.length > 0 && lines.length === 0 && !templateIdParam) {
            setLines([{ productId: d.products[0].id, variantId: "", quantity: 1 }]);
          }
        }
      });

    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.customers) {
          setCustomers(d.customers);
          if (d.customers.length > 0) setSelectedCustomerId(d.customers[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Consume templateId parameter when present
  useEffect(() => {
    if (templateIdParam) {
      fetch(`/api/quotes/${templateIdParam}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.template) {
            const tmpl = data.template;
            setLoadedTemplateName(tmpl.name);
            if (tmpl.planId) setSelectedPlanId(tmpl.planId);
            if (tmpl.lines && tmpl.lines.length > 0) {
              setLines(
                tmpl.lines.map((l: any) => ({
                  productId: l.productId,
                  variantId: l.variantId || "",
                  quantity: l.quantity || 1,
                }))
              );
            }
          }
        })
        .catch((err) => console.error("Failed to load template", err));
    }
  }, [templateIdParam]);

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

    if (!selectedCustomerId) {
      setError("Please select a customer for this subscription.");
      return;
    }

    if (!selectedPlanId) {
      setError("Please select a billing plan.");
      return;
    }

    if (lines.length === 0) {
      setError("Please add at least one product line.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          planId: selectedPlanId,
          templateId: templateIdParam || undefined,
          paymentTerms,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || undefined,
            quantity: l.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create subscription draft");
      } else {
        router.push("/subscriptions");
      }
    } catch {
      setError("Network error creating subscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/subscriptions"
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            New Subscription Draft
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Create a standardized proposal or confirmed subscription line items
          </p>
        </div>
      </div>

      {loadedTemplateName && (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 p-3 rounded-xl text-xs text-purple-800">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            Loaded pre-configured proposal bundle: <strong>{loadedTemplateName}</strong>
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Plan Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-indigo-600" /> Subscription Target & Billing Plan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Selector */}
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Customer Account</label>
              {customers.length > 0 ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  required
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter Customer ID"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs"
                />
              )}
            </div>

            {/* Plan Selector */}
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Recurring Plan</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                required
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{Number(p.price).toFixed(2)} / {p.period.toLowerCase()} (min {p.minQuantity})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Terms */}
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="Immediate Payment">Immediate Payment</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="End of Month">End of Following Month</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Lines Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Product Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product Line
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => {
              const currentProd = products.find((p) => p.id === line.productId);
              const availableVariants = currentProd?.variants || [];
              const calc = preview[idx] || { unitPrice: 0, amount: 0 };

              return (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="w-full sm:flex-1">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Product</label>
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(idx, "productId", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-48">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Variant (Optional)</label>
                    <select
                      value={line.variantId}
                      onChange={(e) => updateLine(idx, "variantId", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      disabled={availableVariants.length === 0}
                    >
                      <option value="">None (Standard)</option>
                      {availableVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attribute}: {v.value} (+₹{Number(v.extraPrice).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-24">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Qty</label>
                    <input
                      type="number"
                      min={selectedPlan?.minQuantity || 1}
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white text-center font-semibold"
                    />
                  </div>

                  <div className="w-full sm:w-32 text-right">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Snapshot Price</label>
                    <div className="text-xs font-mono font-bold text-gray-900 pt-1">
                      ₹{calc.unitPrice.toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">/ unit</span>
                    </div>
                  </div>

                  <div className="w-full sm:w-28 text-right">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Subtotal</label>
                    <div className="text-xs font-mono font-bold text-indigo-600 pt-1">
                      ₹{calc.amount.toFixed(2)}
                    </div>
                  </div>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="p-2 text-gray-400 hover:text-red-500 transition self-end sm:self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
            <span className="font-semibold text-gray-700">Estimated Total (Before Tax & Discounts):</span>
            <span className="text-xl font-bold font-mono text-gray-900">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/subscriptions"
            className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {submitting ? "Saving Draft..." : "Create Subscription Draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewSubscriptionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading subscription editor...</div>}>
      <SubscriptionForm />
    </Suspense>
  );
}
