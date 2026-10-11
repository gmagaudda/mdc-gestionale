import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { homeForRole } from "@/lib/auth/roles";
import { SessionShell } from "@/components/shared/session-shell";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "brand") redirect(homeForRole(user.role));
  return <SessionShell user={user}>{children}</SessionShell>;
}
