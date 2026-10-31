"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Clock, AlertCircle, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  name: string;
  price: string | number;
  period: string;
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
  variants: ProductVariant[];
}

interface QuoteTemplate {
  id: string;
  name: string;
  validityDays: number;
  plan: { id: string; name: string; price: string | number; period: string };
  lines: {
    quantity: number;
    product: { id: string; name: string };
    variant?: { id: string; attribute: string; value: string; extraPrice: string | number } | null;
  }[];
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteTemplate[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Modal form states
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState("");
  const [validityDays, setValidityDays] = useState("30");
  const [lines, setLines] = useState<{ productId: string; variantId: string; quantity: number }[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes");
      const data = await res.json();
      if (data.templates) setQuotes(data.templates);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();

    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.plans) {
          setPlans(d.plans);
          if (d.plans.length > 0 && !planId) setPlanId(d.plans[0].id);
        }
      });

    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.products) {
          setProducts(d.products);
          if (d.products.length > 0 && lines.length === 0) {
            setLines([{ productId: d.products[0].id, variantId: "", quantity: 1 }]);
          }
        }
      });
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setModalSubmitting(true);

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          planId,
          validityDays: parseInt(validityDays, 10) || 30,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || undefined,
            quantity: l.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create template");
      } else {
        setShowModal(false);
        setName("");
        fetchQuotes();
      }
    } catch {
      setError("Network error creating quotation template");
    } finally {
      setModalSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" />
            Quotation Templates
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Standardized proposal bundles with pre-configured plan & product line items
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Create Template
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
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">Loading quotation templates...</div>
        ) : quotes.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">No quotation templates found.</div>
        ) : (
          quotes.map((q) => (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
                    {q.plan.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Valid {q.validityDays} days
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">{q.name}</h3>

                <div className="border-t pt-3 space-y-2">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Included Products:</div>
                  {q.lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-700">
                      <span>
                        {line.quantity}x {line.product.name}
                        {line.variant && <span className="text-blue-600 font-medium"> ({line.variant.value})</span>}
                      </span>
                      {line.variant && <span className="text-gray-400 font-mono">+₹{Number(line.variant.extraPrice).toFixed(2)}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase font-semibold">Plan Base Price</div>
                  <div className="text-sm font-bold text-gray-900">₹{Number(q.plan.price).toFixed(2)}</div>
                </div>

                <button
                  onClick={() => router.push(`/subscriptions/new?templateId=${q.id}`)}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Load in Subscription
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Create Quotation Template</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard SaaS Package"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Base Plan</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{Number(p.price).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Validity (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                  />
                </div>
              </div>

              {/* Product Lines */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Bundled Products</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    + Add Product
                  </button>
                </div>

                {lines.map((l, idx) => {
                  const prod = products.find((p) => p.id === l.productId);
                  const variants = prod?.variants || [];
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border text-xs">
                      <select
                        value={l.productId}
                        onChange={(e) => updateLine(idx, "productId", e.target.value)}
                        className="flex-1 rounded border border-gray-300 p-1 bg-white text-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={l.variantId}
                        onChange={(e) => updateLine(idx, "variantId", e.target.value)}
                        disabled={variants.length === 0}
                        className="w-32 rounded border border-gray-300 p-1 bg-white text-xs"
                      >
                        <option value="">No Variant</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.value} (+₹{Number(v.extraPrice).toFixed(0)})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                        className="w-14 rounded border border-gray-300 p-1 text-center font-bold text-xs"
                      />

                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-red-500 font-bold px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {modalSubmitting ? "Saving..." : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
