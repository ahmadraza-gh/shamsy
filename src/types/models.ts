export type AppRole = "adviser" | "owner";
export type OrderStatus = "draft" | "pending_approval" | "confirmed";
export type ApprovalStatus = "not_required" | "pending" | "approved";

export interface Profile {
  id: string;
  email: string;
  role: AppRole;
}

export interface Dealer {
  id: string;
  name: string;
  city: string;
}

export interface Product {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  updated_at: string;
}

export interface AppSettings {
  minimum_exchange_rate: number;
  current_exchange_rate: number;
}

export interface OrderLineRecord {
  id: string;
  order_id: string;
  product_id: string;
  line_position: number;
  quantity: number;
  unit_price_cents: number;
  line_value_cents: number;
  discount_cents: number;
  line_total_cents: number;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  products: { name: string } | null;
  approver?: { email: string } | null;
}

export interface OrderRecord {
  id: string;
  dealer_id: string;
  adviser_id: string;
  exchange_rate: number;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  sdg_total: number;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  dealers: Dealer | null;
  profiles?: Pick<Profile, "email"> | null;
  order_lines: OrderLineRecord[];
}
