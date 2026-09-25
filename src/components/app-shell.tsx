import Link from "next/link";
import { ClipboardCheck, FilePlus2, ListOrdered, LogOut, SunMedium } from "lucide-react";

import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui";
import type { Profile } from "@/types/models";

export function AppShell({
  viewer,
  children,
}: {
  viewer: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="app-header">
        <div className="page-frame flex h-16 items-center justify-between gap-4">
          <Link className="flex items-center gap-2.5" href="/orders/new">
            <span className="brand-mark brand-mark-small" aria-hidden="true">
              <SunMedium size={18} strokeWidth={2.5} />
            </span>
            <span className="font-semibold tracking-[-0.02em] text-slate-950">Shamsy</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            <NavLink href="/orders/new" icon={<FilePlus2 size={17} />} label="New order" />
            <NavLink href="/orders" icon={<ListOrdered size={17} />} label="Orders" />
            {viewer.role === "owner" ? (
              <NavLink href="/approvals" icon={<ClipboardCheck size={17} />} label="Approvals" />
            ) : null}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-medium text-slate-800">{viewer.email}</p>
              <p className="text-xs capitalize text-slate-500">{viewer.role}</p>
            </div>
            <form action={logoutAction}>
              <Button title="Sign out" type="submit" variant="icon">
                <LogOut aria-hidden="true" size={18} />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="pb-24 md:pb-8">{children}</div>

      <nav className="mobile-nav md:hidden" aria-label="Primary navigation">
        <NavLink href="/orders/new" icon={<FilePlus2 size={20} />} label="New" />
        <NavLink href="/orders" icon={<ListOrdered size={20} />} label="Orders" />
        {viewer.role === "owner" ? (
          <NavLink href="/approvals" icon={<ClipboardCheck size={20} />} label="Approvals" />
        ) : null}
      </nav>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return <Link className="nav-link" href={href}>{icon}<span>{label}</span></Link>;
}
