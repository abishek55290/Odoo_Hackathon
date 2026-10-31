import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "DRAFT"
  | "QUOTATION"
  | "CONFIRMED"
  | "ACTIVE"
  | "CLOSED"
  | "PAID"
  | "PARTIAL"
  | "OVERDUE"
  | "CANCELLED"
  | "PENDING"
  | string;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  showDot?: boolean;
}

export function StatusBadge({
  status,
  showDot = true,
  className,
  ...props
}: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  let styles = "bg-gray-100 text-gray-700 border-gray-200";
  let dotColor = "bg-gray-400";
  let label = normalized;

  switch (normalized) {
    case "ACTIVE":
    case "PAID":
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      dotColor = "bg-emerald-500";
      break;

    case "CONFIRMED":
      styles = "bg-blue-50 text-blue-700 border-blue-200";
      dotColor = "bg-blue-500";
      break;

    case "QUOTATION":
    case "PENDING":
      styles = "bg-amber-50 text-amber-700 border-amber-200";
      dotColor = "bg-amber-500";
      break;

    case "PARTIAL":
      styles = "bg-purple-50 text-purple-700 border-purple-200";
      dotColor = "bg-purple-500";
      label = "PARTIAL PAID";
      break;

    case "OVERDUE":
      styles = "bg-rose-50 text-rose-700 border-rose-200";
      dotColor = "bg-rose-500";
      break;

    case "CANCELLED":
    case "CLOSED":
      styles = "bg-zinc-100 text-zinc-600 border-zinc-200";
      dotColor = "bg-zinc-400";
      break;

    case "DRAFT":
      styles = "bg-slate-100 text-slate-700 border-slate-200";
      dotColor = "bg-slate-400";
      break;

    default:
      styles = "bg-gray-100 text-gray-700 border-gray-200";
      dotColor = "bg-gray-400";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        styles,
        className
      )}
      {...props}
    >
      {showDot && (
        <span className={cn("size-1.5 rounded-full", dotColor)} aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}
