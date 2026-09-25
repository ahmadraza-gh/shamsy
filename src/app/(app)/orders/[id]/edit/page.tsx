import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrderBuilder, type EditableOrder } from "@/features/orders/order-builder";
import { getCatalog, getOrder } from "@/server/data";

export const metadata: Metadata = { title: "Edit order" };

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, catalog] = await Promise.all([getOrder(id), getCatalog()]);
  if (order.status === "confirmed") redirect(`/orders/${id}`);

  const initialOrder: EditableOrder = {
    id: order.id,
    dealerId: order.dealer_id,
    exchangeRate: order.exchange_rate,
    lines: order.order_lines.map((line) => ({
      id: line.id,
      productId: line.product_id,
      quantity: line.quantity,
      discountCents: line.discount_cents,
      unitPriceCents: line.unit_price_cents,
    })),
  };

  return (
    <main className="page-frame py-7 md:py-10">
      <div className="mb-6 md:mb-8">
        <p className="eyebrow text-[var(--brand)]">Draft order</p>
        <h1 className="page-heading mt-2">Edit order</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
          Saving changes replaces the draft lines and clears any earlier owner approvals.
        </p>
      </div>
      <OrderBuilder
        currentExchangeRate={catalog.settings.current_exchange_rate}
        dealers={catalog.dealers}
        initialOrder={initialOrder}
        minimumExchangeRate={catalog.settings.minimum_exchange_rate}
        products={catalog.products}
      />
    </main>
  );
}
