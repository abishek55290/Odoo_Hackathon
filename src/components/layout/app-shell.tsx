"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "STAFF" | "CUSTOMER";
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Role-aware navigation definitions
  const adminStaffNav = [
    {
      href: "/reports",
      label: "Dashboard & KPIs",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      href: "/products",
      label: "Products & Variants",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      href: "/plans",
      label: "Subscription Plans",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      href: "/quotes",
      label: "Quotation Templates",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: "/subscriptions",
      label: "Subscriptions",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      href: "/invoices",
      label: "Invoices",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    },
    {
      href: "/payments",
      label: "Payments Ledger",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/taxes",
      label: "Tax Rules",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
    },
    {
      href: "/discounts",
      label: "Discounts",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
  ];

  const customerNav = [
    {
      href: "/portal",
      label: "Customer Portal",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ];

  const navigationItems = user.role === "CUSTOMER" ? customerNav : adminStaffNav;

  const roleBadgeColor = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    STAFF: "bg-blue-100 text-blue-800 border-blue-200",
    CUSTOMER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  }[user.role];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 bg-white">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-sm">
            B
          </div>
          <div>
            <span className="font-bold tracking-tight text-gray-900 text-base">
              Brightloop
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 font-medium">
              Subscription Cloud
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              {user.role === "CUSTOMER" ? "Self Service Portal" : "Management Console"}
            </p>
            <nav className="space-y-1">
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/reports" &&
                    item.href !== "/portal" &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white shadow-xs font-semibold"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <span className={cn(isActive ? "text-white" : "text-gray-400")}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Card & Sign Out */}
        <div className="border-t border-gray-200 p-4 bg-gray-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-semibold text-gray-900">{user.name}</p>
                <span
                  className={cn(
                    "inline-block rounded-full border px-1.5 py-0.2 text-[10px] font-medium leading-none",
                    roleBadgeColor
                  )}
                >
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              title="Sign out"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-6">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
                  B
                </div>
                <span className="font-bold text-gray-900">Brightloop</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    pathname === item.href
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="border-t p-4">
              <p className="text-xs font-semibold text-gray-900">{user.name}</p>
              <p className="text-[11px] text-gray-500 mb-3">{user.email}</p>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full rounded-md border border-gray-300 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Open sidebar"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <span className="font-semibold text-gray-800">Brightloop</span>
              <span>/</span>
              <span className="capitalize text-indigo-600 font-semibold">
                {pathname.replace("/", "") || "Home"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Link to Customer Portal for testing */}
            {user.role !== "CUSTOMER" && (
              <Link
                href="/portal"
                className="hidden sm:inline-flex items-center rounded-lg bg-gray-50 hover:bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 transition"
                title="View customer portal view"
              >
                Switch to Customer View
              </Link>
            )}

            {/* User pill */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span
                className={cn(
                  "hidden sm:inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                  roleBadgeColor
                )}
              >
                {user.role}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-gray-600 hover:text-red-600 font-medium ml-1 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
