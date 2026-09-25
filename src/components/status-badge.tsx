import { CheckCircle2, CircleDashed, Clock3 } from "lucide-react";

import type { OrderStatus } from "@/types/models";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = {
    draft: { label: "Draft", className: "status-normal", icon: <CircleDashed size={14} /> },
    pending_approval: { label: "Pending approval", className: "status-red", icon: <Clock3 size={14} /> },
    confirmed: { label: "Confirmed", className: "status-approved", icon: <CheckCircle2 size={14} /> },
  }[status];

  return <span className={`status-pill ${config.className}`}>{config.icon}{config.label}</span>;
}

