"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui";

export function FinalizeButton({
  orderId,
  expectedUpdatedAt,
}: {
  orderId: string;
  expectedUpdatedAt: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finalize() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The order could not be finalized.");
      router.replace(`/orders/${orderId}?result=confirmed`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request failed.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button className="w-full sm:w-auto" loading={pending} onClick={() => void finalize()}>
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
        {pending ? "Confirming…" : "Finalize order"}
      </Button>
      {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
    </div>
  );
}
