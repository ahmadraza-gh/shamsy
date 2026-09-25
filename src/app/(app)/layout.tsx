import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/auth/viewer";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}

