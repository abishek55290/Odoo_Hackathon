"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e?: React.FormEvent<HTMLFormElement>, overrideEmail?: string, overridePw?: string) {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    const loginEmail = overrideEmail || email;
    const loginPw = overridePw || password;

    const r = await signIn("credentials", {
      email: loginEmail,
      password: loginPw,
      redirect: false,
    });
    setLoading(false);

    if (r?.error) {
      setError("Invalid email or password (or account inactive)");
    } else {
      window.location.href = "/"; // "/" redirects by role
    }
  }

  function fillDemo(e: string, p: string) {
    setEmail(e);
    setPassword(p);
    handleLogin(undefined, e, p);
  }

  return (
    <main className="mx-auto mt-20 max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xl shadow-xs">
          B
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 pt-2">Sign in to Brightloop</h1>
        <p className="text-xs text-gray-500">Subscription & Billing Management System</p>
      </div>

      {/* Demo Credentials Quick Fill */}
      <div className="rounded-xl bg-indigo-50/70 p-3.5 border border-indigo-100 text-xs">
        <p className="font-semibold text-indigo-900 mb-2">⚡ 1-Click Demo Login:</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => fillDemo("admin@brightloop.test", "Admin123!")}
            className="rounded-lg bg-white p-2 font-medium text-indigo-700 shadow-2xs border border-indigo-200 hover:bg-indigo-100 transition text-center"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => fillDemo("staff@brightloop.test", "Staff123!")}
            className="rounded-lg bg-white p-2 font-medium text-blue-700 shadow-2xs border border-blue-200 hover:bg-blue-100 transition text-center"
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => fillDemo("customer@brightloop.test", "Customer123!")}
            className="rounded-lg bg-white p-2 font-medium text-emerald-700 shadow-2xs border border-emerald-200 hover:bg-emerald-100 transition text-center"
          >
            Customer
          </button>
        </div>
      </div>

      <form onSubmit={(e) => handleLogin(e)} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Email address</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
