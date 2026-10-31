"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Clock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, []);

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
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
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
    </div>
  );
}
