"use client";

import { useEffect, useState } from "react";
import { Package, Plus, Search, Tag, Check, X, AlertCircle } from "lucide-react";

interface Variant {
  id?: string;
  attribute: string;
  value: string;
  extraPrice: number;
}

interface Product {
  id: string;
  name: string;
  type: string;
  salesPrice: string | number;
  costPrice: string | number;
  notes?: string | null;
  active: boolean;
  variants: Variant[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState("Software");
  const [salesPrice, setSalesPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [variantAttr, setVariantAttr] = useState("Brand");
  const [variantValue, setVariantValue] = useState("");
  const [variantExtra, setVariantExtra] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const addVariant = () => {
    if (!variantValue.trim()) return;
    setVariants([
      ...variants,
      {
        attribute: variantAttr.trim() || "Brand",
        value: variantValue.trim(),
        extraPrice: parseFloat(variantExtra) || 0,
      },
    ]);
    setVariantValue("");
    setVariantExtra("");
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          salesPrice: parseFloat(salesPrice) || 0,
          costPrice: parseFloat(costPrice) || 0,
          notes,
          variants,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create product");
      } else {
        setShowModal(false);
        setName("");
        setSalesPrice("");
        setCostPrice("");
        setNotes("");
        setVariants([]);
        fetchProducts();
      }
    } catch {
      setError("Network error creating product");
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Products & Variants Catalog
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage your service and product items, configure custom variant surcharges (e.g. Edition: Enterprise +₹560)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Sales Price</th>
                  <th className="py-3 px-4">Cost Price</th>
                  <th className="py-3 px-4">Configured Variants</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      <div>{p.name}</div>
                      {p.notes && <div className="text-xs text-gray-400 font-normal">{p.notes}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">₹{Number(p.salesPrice).toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-500">₹{Number(p.costPrice).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      {p.variants && p.variants.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.variants.map((v, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              <Tag className="w-3 h-3 text-blue-500" />
                              <span>{v.attribute}: {v.value}</span>
                              <span className="font-semibold text-blue-900">(+₹{Number(v.extraPrice).toFixed(2)})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {p.active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toggleActive(p.id, p.active)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {p.active ? "Archive" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Product</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brightloop CRM"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Software">Software</option>
                    <option value="Service">Service</option>
                    <option value="Add-on">Add-on</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Sales Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="5000.00"
                    value={salesPrice}
                    onChange={(e) => setSalesPrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="2000.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Variant builder */}
              <div className="border-t pt-3">
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Configure Product Variants</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Brand)"
                    value={variantAttr}
                    onChange={(e) => setVariantAttr(e.target.value)}
                    className="w-32 px-2.5 py-1.5 border rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Enterprise)"
                    value={variantValue}
                    onChange={(e) => setVariantValue(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border rounded-lg text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Extra ₹ (e.g. 560)"
                    value={variantExtra}
                    onChange={(e) => setVariantExtra(e.target.value)}
                    className="w-28 px-2.5 py-1.5 border rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg font-medium"
                  >
                    Add
                  </button>
                </div>

                {variants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {variants.map((v, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-800 text-xs border border-blue-200"
                      >
                        {v.attribute}: {v.value} (+₹{v.extraPrice})
                        <button type="button" onClick={() => removeVariant(i)} className="text-red-500 hover:text-red-700 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
