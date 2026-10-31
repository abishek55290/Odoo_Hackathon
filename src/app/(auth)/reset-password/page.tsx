"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, Lock } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Reset token is missing from URL query parameter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2500);
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
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Reset Password</h1>
          <p className="text-xs text-gray-500">Create a secure new password</p>
        </div>
      </div>

      {success ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Password Reset Successful</p>
              <p className="mt-1">Your password has been updated. Redirecting you to sign in...</p>
            </div>
          </div>
          <Link
            href="/login"
            className="block text-center w-full rounded-lg bg-indigo-600 p-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Click here to sign in now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!token && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              No reset token detected in the URL. Please verify your reset link.
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">New password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 9 chars (Upper, lower, special)"
                required
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-9"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Must be &gt;8 characters with uppercase, lowercase, and special character.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}

          <button
            disabled={loading || !token}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 p-2.5 text-sm font-semibold text-white transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Update Password"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading reset form...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
