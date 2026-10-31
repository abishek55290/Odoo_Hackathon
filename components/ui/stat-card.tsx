import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  className?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  className,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("overflow-hidden border border-gray-200 shadow-sm", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="size-9 animate-pulse rounded-lg bg-gray-100" />
          </div>
          <div className="mt-4 h-8 w-36 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-3 w-48 animate-pulse rounded bg-gray-100" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {title}
          </p>
          {icon && (
            <div className="flex size-10 items-center justify-center rounded-lg bg-gray-50 border border-gray-100 text-gray-700">
              {icon}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center text-xs font-medium",
                trend.isPositive ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend.isPositive ? "↑ " : "↓ "}
              {trend.value}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
