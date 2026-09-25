import type { DiscountBand } from "@/lib/money";

export function getStatusCopy(band: DiscountBand): { label: string; detail: string } {
  switch (band) {
    case "normal":
      return { label: "No discount", detail: "Normal pricing" };
    case "sand":
      return { label: "Within adviser limit", detail: "Discount is 3% or less" };
    case "red":
      return { label: "High discount", detail: "Above 3%, within the 5% limit" };
    case "blocked":
      return { label: "Owner approval required", detail: "Discount is above 5%" };
  }
}

