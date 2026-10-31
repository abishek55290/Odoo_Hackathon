"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to process request");
      } else {
        setMessage(data.message || "Reset link generated.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Forgot Password</h1>
          <p className="text-xs text-gray-500">We will send you a reset link</p>
        </div>
      </div>

      {message ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Request Received</p>
              <p className="mt-1">{message}</p>
              <p className="mt-2 text-gray-500 font-mono text-[11px]">
                Tip for local dev: The reset link has been logged in server logs.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-gray-100 hover:bg-gray-200 p-2 text-xs font-semibold text-gray-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Your account email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@brightloop.test"
              required
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 p-2.5 text-sm font-semibold text-white transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Processing..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
