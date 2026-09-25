"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  BadgeDollarSign,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button, Input, Select } from "@/components/ui";
import {
  MAXIMUM_EXCHANGE_RATE,
  MINIMUM_EXCHANGE_RATE,
} from "@/features/orders/constants";
import type { SaveOrderInput } from "@/features/orders/schemas";
import { getStatusCopy } from "@/features/orders/status";
import {
  calculateLineTotal,
  calculateLineValue,
  calculateOrderAmounts,
  formatDiscountPercentage,
  formatSdg,
  formatUsd,
  getDiscountBand,
  parseUsdToCents,
  type DiscountBand,
} from "@/lib/money";
import type { Dealer, Product } from "@/types/models";

interface EditableLine {
  key: string;
  productId: string;
  quantity: string;
  discountUsd: string;
  snapshotUnitPriceCents?: number;
}

export interface EditableOrder {
  id: string;
  dealerId: string;
  exchangeRate: number;
  lines: Array<{
    id: string;
    productId: string;
    quantity: number;
    discountCents: number;
    unitPriceCents: number;
  }>;
}

interface LinePreview {
  valid: boolean;
  lineValueCents: number;
  discountCents: number;
  lineTotalCents: number;
  band: DiscountBand;
  error: string | null;
}

const EMPTY_PREVIEW: LinePreview = {
  valid: false,
  lineValueCents: 0,
  discountCents: 0,
  lineTotalCents: 0,
  band: "normal",
  error: null,
};

function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function getLinePreview(line: EditableLine, product?: Product): LinePreview {
  if (!product) return EMPTY_PREVIEW;

  const quantity = Number(line.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
    return { ...EMPTY_PREVIEW, error: "Quantity must be between 1 and 10,000." };
  }

  const discountCents = parseUsdToCents(line.discountUsd);
  if (discountCents === null) {
    return { ...EMPTY_PREVIEW, error: "Enter the discount with no more than 2 decimal places." };
  }

  try {
    const unitPriceCents = line.snapshotUnitPriceCents ?? product.price_cents;
    const lineValueCents = calculateLineValue(unitPriceCents, quantity);
    const lineTotalCents = calculateLineTotal(lineValueCents, discountCents);
    return {
      valid: true,
      lineValueCents,
      discountCents,
      lineTotalCents,
      band: getDiscountBand(discountCents, lineValueCents),
      error: null,
    };
  } catch (error) {
    return {
      ...EMPTY_PREVIEW,
      error: error instanceof Error ? error.message : "This line is invalid.",
    };
  }
}

export function OrderBuilder({
  dealers,
  products,
  currentExchangeRate,
  minimumExchangeRate,
  initialOrder,
}: {
  dealers: Dealer[];
  products: Product[];
  currentExchangeRate: number;
  minimumExchangeRate: number;
  initialOrder?: EditableOrder;
}) {
  const router = useRouter();
  const minimumRate = Math.max(MINIMUM_EXCHANGE_RATE, minimumExchangeRate);
  const [dealerId, setDealerId] = useState(initialOrder?.dealerId ?? "");
  const [exchangeRate, setExchangeRate] = useState(
    String(initialOrder?.exchangeRate ?? currentExchangeRate),
  );
  const [rateError, setRateError] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>(() =>
    initialOrder?.lines.length
      ? initialOrder.lines.map((line) => ({
          key: line.id,
          productId: line.productId,
          quantity: String(line.quantity),
          discountUsd: centsToInput(line.discountCents),
          snapshotUnitPriceCents: line.unitPriceCents,
        }))
      : [{ key: "new-line-1", productId: "", quantity: "1", discountUsd: "0.00" }],
  );
  const [submitting, setSubmitting] = useState<"draft" | "finalize" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const initialSnapshotByProduct = useMemo(
    () => new Map(
      (initialOrder?.lines ?? []).map((line) => [line.productId, line.unitPriceCents]),
    ),
    [initialOrder],
  );
  const previews = useMemo(
    () => lines.map((line) => getLinePreview(line, productById.get(line.productId))),
    [lines, productById],
  );
  const numericRate = Number(exchangeRate);
  const hasValidRate = Number.isInteger(numericRate)
    && numericRate >= minimumRate
    && numericRate <= MAXIMUM_EXCHANGE_RATE;
  const summary = useMemo(() => {
    const validLines = lines.flatMap((line, index) => {
      const product = productById.get(line.productId);
      const preview = previews[index];
      if (!product || !preview?.valid) return [];
      return [{
        unitPriceCents: line.snapshotUnitPriceCents ?? product.price_cents,
        quantity: Number(line.quantity),
        discountCents: preview.discountCents,
      }];
    });

    return calculateOrderAmounts(validLines, hasValidRate ? numericRate : minimumRate);
  }, [hasValidRate, lines, minimumRate, numericRate, previews, productById]);

  const hasBlockedLine = previews.some((preview) => preview.band === "blocked");
  const selectedProducts = new Set(lines.map((line) => line.productId).filter(Boolean));

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
    setFormError(null);
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: "",
        quantity: "1",
        discountUsd: "0.00",
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function normalizeRate(event: React.FocusEvent<HTMLInputElement>) {
    // Read the element directly so a fast blur cannot observe stale React state.
    const value = Number(event.currentTarget.value);
    if (!Number.isInteger(value) || value < minimumRate) {
      setExchangeRate(String(minimumRate));
      setRateError(
        `Exchange rate cannot be lower than ${minimumRate.toLocaleString("en-US")} SDG/USD.`,
      );
      return;
    }
    if (value > MAXIMUM_EXCHANGE_RATE) {
      setExchangeRate(String(MAXIMUM_EXCHANGE_RATE));
      setRateError(
        `Exchange rate cannot exceed ${MAXIMUM_EXCHANGE_RATE.toLocaleString("en-US")} SDG/USD.`,
      );
      return;
    }
    setRateError(null);
  }

  function buildInput(): SaveOrderInput | null {
    if (!dealerId) {
      setFormError("Select a dealer before saving the order.");
      return null;
    }
    const rate = Number(exchangeRate);
    if (!Number.isInteger(rate) || rate < minimumRate || rate > MAXIMUM_EXCHANGE_RATE) {
      const correctedRate = rate > MAXIMUM_EXCHANGE_RATE
        ? MAXIMUM_EXCHANGE_RATE
        : minimumRate;
      setExchangeRate(String(correctedRate));
      setRateError(
        `Exchange rate must be between ${minimumRate.toLocaleString("en-US")} and ${MAXIMUM_EXCHANGE_RATE.toLocaleString("en-US")} SDG/USD.`,
      );
      setFormError("Correct the exchange rate before saving.");
      return null;
    }
    if (lines.length < 1) {
      setFormError("Add at least one product.");
      return null;
    }

    const seen = new Set<string>();
    const inputLines: SaveOrderInput["lines"] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const preview = previews[index];
      if (!line?.productId) {
        setFormError(`Select a product for line ${index + 1}.`);
        return null;
      }
      if (seen.has(line.productId)) {
        setFormError("Each product may appear only once per order.");
        return null;
      }
      seen.add(line.productId);
      if (!preview?.valid) {
        setFormError(preview?.error ?? `Correct line ${index + 1}.`);
        return null;
      }
      inputLines.push({
        productId: line.productId,
        quantity: Number(line.quantity),
        discountCents: preview.discountCents,
        catalogUpdatedAt: productById.get(line.productId)?.updated_at ?? "",
      });
    }

    return { dealerId, exchangeRate: rate, lines: inputLines };
  }

  async function submit(mode: "draft" | "finalize") {
    const input = buildInput();
    if (!input) return;
    if (mode === "finalize" && hasBlockedLine) {
      setFormError("Owner approval is required for discounts above 5%.");
      return;
    }

    setSubmitting(mode);
    setFormError(null);
    try {
      if (mode === "finalize") {
        const response = await fetch("/api/orders/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...input,
            ...(initialOrder ? { orderId: initialOrder.id } : {}),
          }),
        });
        const result = (await response.json()) as { orderId?: string; error?: string };
        if (!response.ok || !result.orderId) {
          throw new Error(result.error ?? "The order could not be confirmed.");
        }
        router.push(`/orders/${result.orderId}?result=confirmed`);
        router.refresh();
        return;
      }

      const saveResponse = await fetch(
        initialOrder ? `/api/orders/${initialOrder.id}` : "/api/orders",
        {
          method: initialOrder ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const saved = (await saveResponse.json()) as { orderId?: string; error?: string };
      if (!saveResponse.ok || !saved.orderId) {
        throw new Error(saved.error ?? "The order could not be saved.");
      }

      router.push(`/orders/${saved.orderId}?result=saved`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The request failed. Try again.";
      setFormError(message);
      if (message === "Product price changed while the order was being edited. Please review.") {
        // Refresh Server Component catalogue props without discarding this mounted form's inputs.
        router.refresh();
      }
      setSubmitting(null);
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-5">
        <section className="card" aria-labelledby="order-details-heading">
          <div className="card-header">
            <div>
              <p className="eyebrow text-slate-500">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold" id="order-details-heading">Order details</h2>
            </div>
            <BadgeDollarSign aria-hidden="true" className="text-[var(--brand)]" size={22} />
          </div>
          <div className="card-body grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="dealer">Dealer</label>
              <Select
                id="dealer"
                onChange={(event) => { setDealerId(event.target.value); setFormError(null); }}
                required
                value={dealerId}
              >
                <option value="">Select dealer</option>
                {dealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>{dealer.name} · {dealer.city}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="field-label" htmlFor="exchange-rate">SDG per USD</label>
              <Input
                aria-describedby="exchange-rate-help"
                className="tabular-nums"
                id="exchange-rate"
                inputMode="numeric"
                max={MAXIMUM_EXCHANGE_RATE}
                min={minimumRate}
                onBlur={normalizeRate}
                onChange={(event) => { setExchangeRate(event.target.value); setRateError(null); }}
                step="1"
                type="number"
                value={exchangeRate}
              />
              <p className={`field-help ${rateError ? "text-red-700" : ""}`} id="exchange-rate-help">
                {rateError ?? `Minimum allowed rate: ${minimumRate.toLocaleString("en-US")}`}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="products-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-slate-500">Step 2</p>
              <h2 className="mt-1 text-lg font-semibold" id="products-heading">Products</h2>
            </div>
            <span className="text-sm text-slate-500">{lines.length} {lines.length === 1 ? "line" : "lines"}</span>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => {
              const product = productById.get(line.productId);
              const preview = previews[index] ?? EMPTY_PREVIEW;
              return (
                <OrderLineCard
                  canRemove={lines.length > 1}
                  index={index}
                  initialSnapshotByProduct={initialSnapshotByProduct}
                  key={line.key}
                  line={line}
                  onRemove={() => removeLine(line.key)}
                  onUpdate={(patch) => updateLine(line.key, patch)}
                  preview={preview}
                  product={product}
                  products={products}
                  selectedProducts={selectedProducts}
                />
              );
            })}
          </div>

          <Button
            className="mt-4 w-full sm:w-auto"
            disabled={lines.length >= products.length}
            onClick={addLine}
            variant="secondary"
          >
            <Plus aria-hidden="true" size={18} /> Add product
          </Button>
        </section>
      </div>

      <aside className="card lg:sticky lg:top-21" aria-labelledby="summary-heading">
        <div className="card-header">
          <div>
            <p className="eyebrow text-slate-500">Live preview</p>
            <h2 className="mt-1 text-lg font-semibold" id="summary-heading">Order summary</h2>
          </div>
          <ShieldCheck aria-hidden="true" className="text-[var(--brand)]" size={22} />
        </div>
        <div className="card-body space-y-3">
          <div className="summary-row"><span>Subtotal</span><strong>{formatUsd(summary.subtotalCents)}</strong></div>
          <div className="summary-row"><span>Discount</span><strong>−{formatUsd(summary.discountCents)}</strong></div>
          <div className="summary-row summary-total"><span>USD total</span><strong data-testid="usd-total">{formatUsd(summary.totalCents)}</strong></div>
          <div aria-live="polite" className="rounded-xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">SDG total</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.035em]" data-testid="sdg-total">
              {hasValidRate ? formatSdg(summary.sdgTotal) : "Enter a valid rate"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {hasValidRate ? `at ${numericRate.toLocaleString("en-US")} SDG/USD` : `Minimum ${minimumRate.toLocaleString("en-US")} SDG/USD`}
            </p>
          </div>

          {hasBlockedLine ? (
            <div className="notice notice-error flex gap-2" role="status">
              <AlertOctagon aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <span>Owner approval is required. Save the order so an owner can review it.</span>
            </div>
          ) : (
            <div className="notice notice-success flex gap-2" role="status">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <span>No owner approval is currently required.</span>
            </div>
          )}

          {formError ? <p className="notice notice-error" role="alert">{formError}</p> : null}

          <div className="grid gap-2 pt-1">
            <Button
              className="w-full"
              disabled={submitting !== null}
              loading={submitting === "draft"}
              onClick={() => void submit("draft")}
              variant="secondary"
            >
              {submitting === "draft" ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
              {submitting === "draft" ? "Saving…" : hasBlockedLine ? "Save for approval" : "Save draft"}
            </Button>
            <Button
              className="w-full"
              disabled={submitting !== null || hasBlockedLine}
              loading={submitting === "finalize"}
              onClick={() => void submit("finalize")}
            >
              {submitting === "finalize" ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              {submitting === "finalize" ? "Confirming…" : "Save & confirm"}
            </Button>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Prices and totals are recalculated by the database when you save.
          </p>
        </div>
      </aside>
    </div>
  );
}

function OrderLineCard({
  line,
  index,
  initialSnapshotByProduct,
  product,
  products,
  preview,
  selectedProducts,
  canRemove,
  onUpdate,
  onRemove,
}: {
  line: EditableLine;
  index: number;
  initialSnapshotByProduct: Map<string, number>;
  product?: Product;
  products: Product[];
  preview: LinePreview;
  selectedProducts: Set<string>;
  canRemove: boolean;
  onUpdate: (patch: Partial<EditableLine>) => void;
  onRemove: () => void;
}) {
  const state = getStatusCopy(preview.band);
  return (
    <article
      aria-labelledby={`line-heading-${line.key}`}
      className={`card order-line order-line-${preview.band}`}
      data-testid={`order-line-${index + 1}`}
    >
      <div className="card-header">
        <div>
          <p className="eyebrow text-slate-500">Line {index + 1}</p>
          <p className="mt-1 font-semibold text-slate-900" id={`line-heading-${line.key}`}>
            {product?.name ?? "Choose a product"}
          </p>
        </div>
        <Button
          className="text-red-700"
          disabled={!canRemove}
          onClick={onRemove}
          title={`Remove line ${index + 1}`}
          variant="icon"
        >
          <Trash2 aria-hidden="true" size={18} />
          <span className="sr-only">Remove line {index + 1}</span>
        </Button>
      </div>
      <div className="card-body space-y-4">
        <div>
          <label className="field-label" htmlFor={`product-${line.key}`}>Product</label>
          <Select
            aria-label={`Line ${index + 1} product`}
            id={`product-${line.key}`}
            onChange={(event) => onUpdate({
              productId: event.target.value,
              snapshotUnitPriceCents: initialSnapshotByProduct.get(event.target.value),
            })}
            value={line.productId}
          >
            <option value="">Select product</option>
            {products.map((option) => (
              <option
                data-catalog-updated-at={option.updated_at}
                disabled={selectedProducts.has(option.id) && option.id !== line.productId}
                key={option.id}
                value={option.id}
              >
                {option.name} · {formatUsd(option.price_cents)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label={line.snapshotUnitPriceCents === undefined ? "Unit price" : "Saved unit price"}
            value={product
              ? formatUsd(line.snapshotUnitPriceCents ?? product.price_cents)
              : "—"}
          />
          <div>
            <label className="field-label" htmlFor={`quantity-${line.key}`}>Quantity</label>
            <Input
              aria-label={`Line ${index + 1} quantity`}
              aria-invalid={preview.error?.startsWith("Quantity") || undefined}
              className="tabular-nums"
              id={`quantity-${line.key}`}
              inputMode="numeric"
              max="10000"
              min="1"
              onChange={(event) => onUpdate({ quantity: event.target.value })}
              step="1"
              type="number"
              value={line.quantity}
            />
          </div>
          <Metric label="Line value" value={product && preview.valid ? formatUsd(preview.lineValueCents) : "—"} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor={`discount-${line.key}`}>Discount USD</label>
            <div className="input-shell">
              <span aria-hidden="true">$</span>
              <Input
                aria-label={`Line ${index + 1} discount USD`}
                aria-invalid={preview.error?.startsWith("Enter the discount") || undefined}
                className="border-0 px-0 tabular-nums"
                id={`discount-${line.key}`}
                inputMode="decimal"
                onChange={(event) => onUpdate({ discountUsd: event.target.value })}
                value={line.discountUsd}
              />
            </div>
          </div>
          <Metric
            label="Discount %"
            value={product && preview.valid
              ? formatDiscountPercentage(preview.discountCents, preview.lineValueCents)
              : "—"}
          />
          <Metric label="Line total" value={product && preview.valid ? formatUsd(preview.lineTotalCents) : "—"} strong />
        </div>

        {preview.error ? <p className="notice notice-error" role="alert">{preview.error}</p> : null}
        {product && preview.valid ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <span className={`status-pill status-${preview.band}`} data-testid={`discount-status-${index + 1}`}>
              {state.label}
            </span>
            <span className="text-xs text-slate-500">{state.detail}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <p className={`flex min-h-12 items-center tabular-nums ${strong ? "text-lg font-semibold text-[var(--brand)]" : "font-medium text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}
