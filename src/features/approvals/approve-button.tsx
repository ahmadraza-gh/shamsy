"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui";

export function ApproveButton({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/order-lines/${lineId}/approve`, { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The discount could not be approved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request failed.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button className="w-full sm:w-auto" loading={pending} onClick={() => void approve()}>
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}
        {pending ? "Approving…" : "Approve discount"}
      </Button>
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
