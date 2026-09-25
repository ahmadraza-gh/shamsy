import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, ExternalLink, Settings2 } from "lucide-react";

import { ApproveButton } from "@/features/approvals/approve-button";
import { RateForm } from "@/features/settings/rate-form";
import { formatDiscountPercentage, formatUsd } from "@/lib/money";
import { requireViewer } from "@/lib/auth/viewer";
import { getCatalog, getPendingApprovalOrders } from "@/server/data";

export const metadata: Metadata = { title: "Pending approvals" };

export default async function ApprovalsPage() {
  await requireViewer(["owner"]);
  const [orders, catalog] = await Promise.all([getPendingApprovalOrders(), getCatalog()]);
  const pendingLines = orders.flatMap((order) =>
    order.order_lines
      .filter((line) => line.approval_status === "pending")
      .map((line) => ({ order, line })),
  );

  return (
    <main className="page-frame py-7 md:py-10">
      <div className="mb-6 md:mb-8">
        <p className="eyebrow text-[var(--brand)]">Owner workspace</p>
        <h1 className="page-heading mt-2">Pending approvals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
          Review each line above the adviser&apos;s 5% threshold. Approval is bound to this exact saved line.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label="Discount approval queue">
          {pendingLines.length === 0 ? (
            <div className="card grid min-h-72 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ClipboardCheck size={24} /></span>
                <h2 className="mt-4 text-lg font-semibold">Approval queue is clear</h2>
                <p className="mt-2 text-sm text-slate-600">There are no discount exceptions waiting for review.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLines.map(({ order, line }) => (
                <article
                  className="card overflow-hidden"
                  data-testid={`approval-order-${order.id}`}
                  key={line.id}
                >
                  <div className="border-l-4 border-red-700 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow text-red-700">Owner approval required</p>
                        <h2 className="mt-2 text-lg font-semibold">{line.products?.name}</h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {order.dealers?.name} · adviser {order.profiles?.email ?? order.adviser_id.slice(0, 8)}
                        </p>
                      </div>
                      <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)]" href={`/orders/${order.id}`}>
                        Order {order.id.slice(0, 8).toUpperCase()} <ExternalLink size={15} />
                      </Link>
                    </div>

                    <div className="my-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
                      <ApprovalMetric label="Line value" value={formatUsd(line.line_value_cents)} />
                      <ApprovalMetric label="Discount" value={formatUsd(line.discount_cents)} />
                      <ApprovalMetric label="Discount %" value={formatDiscountPercentage(line.discount_cents, line.line_value_cents)} danger />
                      <ApprovalMetric label="Line total" value={formatUsd(line.line_total_cents)} />
                    </div>
                    <ApproveButton lineId={line.id} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="card lg:sticky lg:top-21">
          <div className="card-header">
            <div>
              <p className="eyebrow text-slate-500">Default for new orders</p>
              <h2 className="mt-1 text-lg font-semibold">Exchange rate</h2>
            </div>
            <Settings2 className="text-[var(--brand)]" size={21} />
          </div>
          <div className="card-body">
            <RateForm
              currentRate={catalog.settings.current_exchange_rate}
              minimumRate={catalog.settings.minimum_exchange_rate}
            />
            <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              Changing this default never changes the rate or totals stored on an existing order.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ApprovalMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${danger ? "text-red-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
