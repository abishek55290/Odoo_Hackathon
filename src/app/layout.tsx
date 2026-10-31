import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata = { title: "Brightloop — Subscription Management System" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans")}>
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
