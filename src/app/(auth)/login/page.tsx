"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const r = await signIn("credentials", {
      email: f.get("email"),
      password: f.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (r?.error) setError("Invalid email or password (or account inactive)");
    else window.location.href = "/"; // "/" redirects by role
  }

  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm border border-gray-100">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sign in to Brightloop</h1>
        <p className="text-xs text-gray-500">Subscription & Billing Management System</p>
      </div>

      <form onSubmit={submit} className="space-y-4 pt-2">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Email address</label>
          <input
            name="email"
            type="email"
            placeholder="admin@brightloop.test"
            required
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-700">Password</label>
            <Link href="/forgot-password" className="text-xs text-indigo-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 p-2.5 text-sm font-semibold text-white transition shadow-sm disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-gray-500 border-t">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
          Create account
        </Link>
      </div>
    </main>
  );
}
