import type { Metadata } from "next";
import { SunMedium } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getViewer } from "@/lib/auth/viewer";
import { hasSupabaseEnvironment } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const configured = hasSupabaseEnvironment();
  if (configured && (await getViewer())) redirect("/orders/new");

  return (
    <main className="login-canvas">
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="brand-mark" aria-hidden="true">
          <SunMedium size={24} strokeWidth={2.5} />
        </div>
        <p className="eyebrow mt-6">Shamsy operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" id="login-heading">
          Order entry
        </h1>
        <p className="mt-3 max-w-sm text-base leading-7 text-slate-600">
          Sign in to record a dealer order or review a discount exception.
        </p>
        <LoginForm configured={configured} />
      </section>
      <aside className="login-context" aria-label="Application purpose">
        <div>
          <p className="eyebrow text-amber-300">Solar distribution</p>
          <p className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.045em] text-white">
            Accurate orders, even when the network is slow and the numbers are large.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
          <div className="context-stat"><strong>USD</strong><span>Fixed catalogue pricing</span></div>
          <div className="context-stat"><strong>SDG</strong><span>Snapshotted exchange rates</span></div>
        </div>
      </aside>
    </main>
  );
}
