"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { Button, Input } from "@/components/ui";
import { MAXIMUM_EXCHANGE_RATE } from "@/features/orders/constants";

export function RateForm({ currentRate, minimumRate }: { currentRate: number; minimumRate: number }) {
  const router = useRouter();
  const [rate, setRate] = useState(String(currentRate));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const numericRate = Number(rate);
    if (
      !Number.isInteger(numericRate)
      || numericRate < minimumRate
      || numericRate > MAXIMUM_EXCHANGE_RATE
    ) {
      const correctedRate = numericRate > MAXIMUM_EXCHANGE_RATE
        ? MAXIMUM_EXCHANGE_RATE
        : minimumRate;
      setRate(String(correctedRate));
      setMessage({
        type: "error",
        text: `Exchange rate must be between ${minimumRate.toLocaleString("en-US")} and ${MAXIMUM_EXCHANGE_RATE.toLocaleString("en-US")} SDG/USD.`,
      });
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/exchange-rate", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentExchangeRate: numericRate }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The exchange rate could not be updated.");
      setMessage({ type: "success", text: "Current exchange rate updated. Existing orders were not changed." });
      router.refresh();
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "The request failed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void save(event)}>
      <div>
        <label className="field-label" htmlFor="current-rate">Current SDG per USD</label>
        <Input
          className="tabular-nums"
          id="current-rate"
          inputMode="numeric"
          max={MAXIMUM_EXCHANGE_RATE}
          min={minimumRate}
          onChange={(event) => { setRate(event.target.value); setMessage(null); }}
          step="1"
          type="number"
          value={rate}
        />
        <p className="field-help">
          New orders use this default. Supported range: {minimumRate.toLocaleString("en-US")}–{MAXIMUM_EXCHANGE_RATE.toLocaleString("en-US")}.
        </p>
      </div>
      <Button className="w-full sm:w-auto" loading={pending} type="submit" variant="secondary">
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}
        {pending ? "Updating…" : "Update current rate"}
      </Button>
      {message ? (
        <p className={`notice ${message.type === "success" ? "notice-success" : "notice-error"}`} role={message.type === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
