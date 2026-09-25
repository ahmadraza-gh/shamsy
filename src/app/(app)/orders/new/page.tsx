import type { Metadata } from "next";

import { OrderBuilder } from "@/features/orders/order-builder";
import { getCatalog } from "@/server/data";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const { dealers, products, settings } = await getCatalog();

  return (
    <main className="page-frame py-7 md:py-10">
      <div className="mb-6 md:mb-8">
        <p className="eyebrow text-[var(--brand)]">Sales workspace</p>
        <h1 className="page-heading mt-2">New order</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
          Select the dealer and products. Catalogue prices are fixed and verified again when you save.
        </p>
      </div>
      <OrderBuilder
        currentExchangeRate={settings.current_exchange_rate}
        dealers={dealers}
        minimumExchangeRate={settings.minimum_exchange_rate}
        products={products}
      />
    </main>
  );
}

