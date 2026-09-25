import "server-only";

import { notFound } from "next/navigation";

import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppSettings, Dealer, OrderRecord, Product } from "@/types/models";

export async function getCatalog(): Promise<{
  dealers: Dealer[];
  products: Product[];
  settings: AppSettings;
}> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const [dealersResult, productsResult, settingsResult] = await Promise.all([
    supabase.from("dealers").select("id,name,city").order("name"),
    supabase
      .from("products")
      .select("id,name,price_cents,active,updated_at")
      .eq("active", true)
      .order("name"),
    supabase
      .from("app_settings")
      .select("minimum_exchange_rate,current_exchange_rate")
      .eq("id", 1)
      .single(),
  ]);

  const error = dealersResult.error ?? productsResult.error ?? settingsResult.error;
  if (error) throw new Error("The order catalogue could not be loaded.");

  return {
    dealers: (dealersResult.data ?? []) as Dealer[],
    products: (productsResult.data ?? []) as Product[],
    settings: settingsResult.data as AppSettings,
  };
}

export async function getOrders(): Promise<OrderRecord[]> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,dealer_id,adviser_id,exchange_rate,status,subtotal_cents,discount_cents,total_cents,sdg_total,created_at,updated_at,confirmed_at,dealers(id,name,city),order_lines(id)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error("Orders could not be loaded.");
  return (data ?? []) as unknown as OrderRecord[];
}

export async function getOrder(orderId: string): Promise<OrderRecord> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,dealer_id,adviser_id,exchange_rate,status,subtotal_cents,discount_cents,total_cents,sdg_total,created_at,updated_at,confirmed_at,dealers(id,name,city),profiles!orders_adviser_id_fkey(email),order_lines(id,order_id,line_position,product_id,quantity,unit_price_cents,line_value_cents,discount_cents,line_total_cents,approval_status,approved_by,approved_at,created_at,products(name),approver:profiles!order_lines_approved_by_fkey(email))",
    )
    .eq("id", orderId)
    .order("line_position", { referencedTable: "order_lines", ascending: true })
    .maybeSingle();

  if (error) throw new Error("The order could not be loaded. Please try again.");
  if (!data) notFound();
  return data as unknown as OrderRecord;
}

export async function getPendingApprovalOrders(): Promise<OrderRecord[]> {
  await requireViewer(["owner"]);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,dealer_id,adviser_id,exchange_rate,status,subtotal_cents,discount_cents,total_cents,sdg_total,created_at,updated_at,confirmed_at,dealers(id,name,city),profiles!orders_adviser_id_fkey(email),order_lines(id,order_id,line_position,product_id,quantity,unit_price_cents,line_value_cents,discount_cents,line_total_cents,approval_status,approved_by,approved_at,created_at,products(name))",
    )
    .eq("status", "pending_approval")
    .order("line_position", { referencedTable: "order_lines", ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error("Pending approvals could not be loaded.");
  return (data ?? []) as unknown as OrderRecord[];
}
