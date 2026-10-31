"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  Clock,
  Layers,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";

interface DashboardData {
  metrics: {
    activeSubscriptionsCount: number;
    totalSubscriptionsCount: number;
    mrr: number;
    arr: number;
    totalBilled: number;
    collectedRevenue: number;
    outstandingBalance: number;
    overdueCount: number;
    overdueBalance: number;
  };
  statusBreakdown: {
    DRAFT: number;
    QUOTATION: number;
    CONFIRMED: number;
    ACTIVE: number;
    PAUSED: number;
    CLOSED: number;
  };
  recentInvoices: {
    id: string;
    number: string;
    customerName: string;
    status: string;
    total: number;
    balance: number;
    dueDate: string;
    createdAt: string;
  }[];
}

export default function ReportsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) {
        throw new Error("Failed to load dashboard metrics");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Executive Finance & Subscription Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time MRR, recurring billing runs, cash collections, and portfolio lifecycle
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
            <span>Monthly Recurring (MRR)</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 font-mono">
            {loading ? "..." : `₹${(data?.metrics.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>ARR: ₹{(data?.metrics.arr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
              {data?.metrics.activeSubscriptionsCount || 0} active subs
            </span>
          </div>
        </div>

        {/* Collected Revenue */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
            <span>Collected Cash</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono">
            {loading ? "..." : `₹${(data?.metrics.collectedRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>Total Invoiced: ₹{(data?.metrics.totalBilled || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
            <span>Outstanding Balance</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600 font-mono">
            {loading ? "..." : `₹${(data?.metrics.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-[11px] text-gray-500">
            Unsettled open invoice balances across all customers
          </div>
        </div>

        {/* Overdue Risk */}
        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-red-600 font-semibold uppercase tracking-wider">
            <span>Overdue Exposure</span>
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-red-600 font-mono">
            {loading ? "..." : `₹${(data?.metrics.overdueBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-[11px] text-red-600 font-semibold flex items-center justify-between">
            <span>{data?.metrics.overdueCount || 0} overdue invoices</span>
            <span className="text-gray-400 font-normal">Past due date</span>
          </div>
        </div>
      </div>

      {/* Subscription Pipeline Status Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" /> Subscription Lifecycle Distribution
          </h2>
          <span className="text-xs text-gray-500 font-mono">
            Total Subscriptions: {data?.metrics.totalSubscriptionsCount || 0}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Draft Proposals", count: data?.statusBreakdown.DRAFT || 0, color: "bg-gray-50 text-gray-700 border-gray-200" },
            { label: "Sent Quotations", count: data?.statusBreakdown.QUOTATION || 0, color: "bg-purple-50 text-purple-700 border-purple-200" },
            { label: "Confirmed", count: data?.statusBreakdown.CONFIRMED || 0, color: "bg-blue-50 text-blue-700 border-blue-200" },
            { label: "Active Recurring", count: data?.statusBreakdown.ACTIVE || 0, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label: "Paused", count: data?.statusBreakdown.PAUSED || 0, color: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Closed / Ended", count: data?.statusBreakdown.CLOSED || 0, color: "bg-gray-100 text-gray-600 border-gray-300" },
          ].map((item, i) => (
            <div key={i} className={`p-4 rounded-xl border ${item.color} text-center space-y-1`}>
              <div className="text-xs font-semibold">{item.label}</div>
              <div className="text-2xl font-black font-mono">{loading ? "-" : item.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" /> Recent Invoices
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Most recent billing entries and their payment status</p>
          </div>
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            View all invoices <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">Loading invoices...</td>
                </tr>
              ) : (data?.recentInvoices || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">No invoices recorded yet.</td>
                </tr>
              ) : (
                data?.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{inv.number}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{inv.customerName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "CONFIRMED"
                            ? "bg-blue-100 text-blue-800"
                            : inv.status === "CANCELLED"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-gray-900">
                      ₹{inv.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-indigo-600">
                      ₹{inv.balance.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-medium text-[11px] transition"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
