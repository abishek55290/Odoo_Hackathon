import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <AppShell
      user={{
        id: session.user.id,
        name: session.user.name || session.user.email || "User",
        email: session.user.email || "",
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
