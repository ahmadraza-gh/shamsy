import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FilePlus2, ListOrdered } from "lucide-react";

import { OrderStatusBadge } from "@/components/status-badge";
import { buttonClassName } from "@/components/ui";
import { formatSdg, formatUsd } from "@/lib/money";
import { getOrders } from "@/server/data";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <main className="page-frame py-7 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="eyebrow text-[var(--brand)]">Order history</p>
          <h1 className="page-heading mt-2">Orders</h1>
          <p className="mt-2 text-sm text-slate-600">Drafts, pending approvals, and immutable confirmed orders.</p>
        </div>
        <Link className={buttonClassName()} href="/orders/new"><FilePlus2 size={18} /> New order</Link>
      </div>

      {orders.length === 0 ? (
        <section className="card grid min-h-72 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500"><ListOrdered size={24} /></span>
            <h2 className="mt-4 text-lg font-semibold">No orders yet</h2>
            <p className="mt-2 text-sm text-slate-600">Create the first dealer order to see it here.</p>
            <Link className={buttonClassName({ className: "mt-5" })} href="/orders/new">Create order</Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <Link className="card group p-5 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md" href={`/orders/${order.id}`} key={order.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow text-slate-500">{order.id.slice(0, 8).toUpperCase()}</p>
                  <h2 className="mt-1 font-semibold text-slate-950">{order.dealers?.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{order.dealers?.city}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">USD total</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatUsd(order.total_cents)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">SDG total</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatSdg(order.sdg_total)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>{order.order_lines.length} {order.order_lines.length === 1 ? "line" : "lines"} · rate {order.exchange_rate.toLocaleString("en-US")}</span>
                <ArrowRight className="transition group-hover:translate-x-1" size={17} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
