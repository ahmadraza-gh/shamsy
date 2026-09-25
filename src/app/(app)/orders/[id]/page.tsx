import type { Metadata } from "next";
import Link from "next/link";
import { AlertOctagon, ArrowLeft, CalendarDays, Pencil, ShieldCheck } from "lucide-react";

import { OrderStatusBadge } from "@/components/status-badge";
import { buttonClassName } from "@/components/ui";
import { FinalizeButton } from "@/features/orders/finalize-button";
import {
  formatDiscountPercentage,
  formatSdg,
  formatUsd,
  getDiscountBand,
} from "@/lib/money";
import { getStatusCopy } from "@/features/orders/status";
import { getOrder } from "@/server/data";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await getOrder(id);
  const pendingApproval = order.order_lines.some((line) => line.approval_status === "pending");
  const canFinalize = order.status !== "confirmed" && !pendingApproval;

  return (
    <main className="page-frame py-7 md:py-10">
      <Link className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950" href="/orders">
        <ArrowLeft size={17} /> All orders
      </Link>

      {query.result === "saved" ? (
        <p className="notice notice-success mb-5" role="status">Draft saved with authoritative catalogue prices.</p>
      ) : null}
      {query.result === "confirmed" && order.status === "confirmed" ? (
        <p className="notice notice-success mb-5" role="status">Order confirmed. Its financial values are now read-only.</p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[var(--brand)]">Order {order.id.slice(0, 8).toUpperCase()}</p>
          <h1 className="page-heading mt-2">{order.dealers?.name ?? "Dealer order"}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays size={16} /> {formatDate(order.created_at)} · {order.dealers?.city}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {pendingApproval ? (
        <div className="notice notice-error mb-5 flex gap-3" role="status">
          <AlertOctagon className="mt-0.5 shrink-0" size={19} />
          <div>
            <strong>Owner approval required</strong>
            <p className="mt-1">This order cannot be finalized until every line above 5% is approved.</p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="space-y-4" aria-labelledby="lines-heading">
          <h2 className="text-lg font-semibold" id="lines-heading">Order lines</h2>
          {order.order_lines.map((line, index) => {
            const band = getDiscountBand(line.discount_cents, line.line_value_cents);
            const copy = getStatusCopy(band);
            const approved = line.approval_status === "approved";
            return (
              <article
                className={`card order-line order-line-${band}`}
                data-line-id={line.id}
                data-testid={`detail-line-${index + 1}`}
                key={line.id}
              >
                <div className="card-header">
                  <div>
                    <p className="eyebrow text-slate-500">Line {index + 1}</p>
                    <h3 className="mt-1 font-semibold text-slate-950">{line.products?.name}</h3>
                  </div>
                  <span className={`status-pill ${approved ? "status-approved" : `status-${band}`}`}>
                    {approved ? "Owner approved" : copy.label}
                  </span>
                </div>
                <div className="card-body grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
                  <DetailMetric label="Unit price snapshot" value={formatUsd(line.unit_price_cents)} />
                  <DetailMetric label="Quantity" value={String(line.quantity)} />
                  <DetailMetric label="Line value" value={formatUsd(line.line_value_cents)} />
                  <DetailMetric label="Discount" value={formatUsd(line.discount_cents)} />
                  <DetailMetric label="Discount %" value={formatDiscountPercentage(line.discount_cents, line.line_value_cents)} />
                  <DetailMetric label="Line total" value={formatUsd(line.line_total_cents)} strong />
                  {approved ? (
                    <p className="col-span-full text-sm text-emerald-800">
                      Approved {line.approved_at ? formatDate(line.approved_at) : ""}
                      {line.approver?.email ? ` by ${line.approver.email}` : ""}.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        <aside className="card lg:sticky lg:top-21">
          <div className="card-header">
            <div>
              <p className="eyebrow text-slate-500">Stored snapshot</p>
              <h2 className="mt-1 text-lg font-semibold">Totals</h2>
            </div>
            <ShieldCheck className="text-[var(--brand)]" size={22} />
          </div>
          <div className="card-body space-y-3">
            <div className="summary-row"><span>Subtotal</span><strong>{formatUsd(order.subtotal_cents)}</strong></div>
            <div className="summary-row"><span>Discount</span><strong>−{formatUsd(order.discount_cents)}</strong></div>
            <div className="summary-row summary-total"><span>USD total</span><strong>{formatUsd(order.total_cents)}</strong></div>
            <div className="rounded-xl bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">SDG total</p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{formatSdg(order.sdg_total)}</p>
              <p className="mt-1 text-xs text-slate-400">Stored rate: {order.exchange_rate.toLocaleString("en-US")} SDG/USD</p>
            </div>

            {order.status !== "confirmed" ? (
              <div className="grid gap-2 pt-2">
                <Link className={buttonClassName({ className: "w-full", variant: "secondary" })} href={`/orders/${order.id}/edit`}>
                  <Pencil size={17} /> Edit draft
                </Link>
                {canFinalize ? (
                  <FinalizeButton orderId={order.id} expectedUpdatedAt={order.updated_at} />
                ) : null}
              </div>
            ) : (
              <p className="notice notice-success">Confirmed orders are read-only.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function DetailMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold text-[var(--brand)]" : "font-medium text-slate-900"}`}>{value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
