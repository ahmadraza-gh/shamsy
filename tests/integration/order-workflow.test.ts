import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const adviserEmail = process.env.E2E_ADVISER_EMAIL ?? "";
const adviserPassword = process.env.E2E_ADVISER_PASSWORD ?? "";
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? "";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? "";
const isLocalDatabase = (() => {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
})();

if (enabled && !isLocalDatabase && process.env.ALLOW_DESTRUCTIVE_TESTS !== "1") {
  throw new Error(
    "Integration tests mutate data and require local Supabase. Set ALLOW_DESTRUCTIVE_TESTS=1 only for an isolated remote test project.",
  );
}
if (enabled && (!adviserEmail || !adviserPassword || !ownerEmail || !ownerPassword)) {
  throw new Error("Integration-test account credentials are required when the suite is enabled.");
}

const dealerId = "00000000-0000-4000-8000-000000000001";
const products = {
  spf: "10000000-0000-4000-8000-000000000001",
  battery5: "10000000-0000-4000-8000-000000000003",
  battery16: "10000000-0000-4000-8000-000000000004",
};

describe.skipIf(!enabled)("live Supabase financial workflow", () => {
  it(
    "rejects tampering, requires owner approval, and preserves the historical rate",
    async () => {
      if (!url || !anonKey || !serviceRoleKey) {
        throw new Error("Supabase integration environment is missing.");
      }

      const adviser = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const owner = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const service = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const adviserLogin = await adviser.auth.signInWithPassword({
          email: adviserEmail,
          password: adviserPassword,
        });
      expect(adviserLogin.error).toBeNull();
      expect(
        (await owner.auth.signInWithPassword({
          email: ownerEmail,
          password: ownerPassword,
        })).error,
      ).toBeNull();

      const catalog = await adviser.from("products").select("id,updated_at");
      expect(catalog.error).toBeNull();
      const catalogVersions = new Map(
        (catalog.data ?? []).map((product) => [product.id, product.updated_at]),
      );
      const line = (productId: string, quantity: number, discountCents: number) => {
        const catalogUpdatedAt = catalogVersions.get(productId);
        if (!catalogUpdatedAt) throw new Error(`Missing catalogue version for ${productId}`);
        return { productId, quantity, discountCents, catalogUpdatedAt };
      };

      const roleEscalation = await adviser
        .from("profiles")
        .update({ role: "owner" })
        .eq("id", adviserLogin.data.user?.id ?? "");
      expect(roleEscalation.error).not.toBeNull();

      const catalogueTampering = await adviser
        .from("products")
        .update({ price_cents: 10_000 })
        .eq("id", products.spf);
      expect(catalogueTampering.error).not.toBeNull();

      const invalidRate = await adviser.rpc("save_order_draft", {
        p_dealer_id: dealerId,
        p_exchange_rate: 7_900,
        p_lines: [line(products.spf, 1, 0)],
        p_order_id: null,
      });
      expect(invalidRate.error?.code).toBe("22023");

      const tamperedPrice = await adviser.rpc("save_order_draft", {
        p_dealer_id: dealerId,
        p_exchange_rate: 8_200,
        p_lines: [
          {
            productId: products.spf,
            quantity: 1,
            discountCents: 0,
            catalogUpdatedAt: catalogVersions.get(products.spf),
            unitPriceCents: 10_000,
          },
        ],
        p_order_id: null,
      });
      expect(tamperedPrice.error?.code).toBe("22023");

      const nullLines = await adviser.rpc("save_order_draft", {
        p_dealer_id: dealerId,
        p_exchange_rate: 8_200,
        p_lines: null,
        p_order_id: null,
      });
      expect(nullLines.error?.code).toBe("22023");

      const saved = await adviser.rpc("save_order_draft", {
        p_dealer_id: dealerId,
        p_exchange_rate: 8_200,
        p_lines: [
          line(products.spf, 4, 4_000),
          line(products.battery5, 2, 7_000),
          line(products.battery16, 1, 15_000),
        ],
        p_order_id: null,
      });
      expect(saved.error).toBeNull();
      const orderId = saved.data as string;

      const twoLineSaved = await adviser.rpc("save_and_finalize_order", {
        p_dealer_id: dealerId,
        p_exchange_rate: 8_200,
        p_lines: [
          line(products.spf, 4, 4_000),
          line(products.battery5, 2, 7_000),
        ],
        p_order_id: null,
      });
      expect(twoLineSaved.error).toBeNull();
      const twoLineOrder = await adviser
        .from("orders")
        .select("status,total_cents,sdg_total")
        .eq("id", twoLineSaved.data)
        .single();
      expect(twoLineOrder.data).toEqual({
        status: "confirmed",
        total_cents: 357_000,
        sdg_total: 29_274_000,
      });

      const repricedDraftProduct = await service
        .from("products")
        .update({ price_cents: 55_000 })
        .eq("id", products.spf);
      const resavedDraft = await adviser.rpc("save_order_draft", {
        p_dealer_id: dealerId,
        p_exchange_rate: 8_200,
        p_lines: [
          line(products.spf, 4, 4_000),
          line(products.battery5, 2, 7_000),
          line(products.battery16, 1, 15_000),
        ],
        p_order_id: orderId,
      });
      const restoredDraftProduct = await service
        .from("products")
        .update({ price_cents: 51_500 })
        .eq("id", products.spf);
      expect(repricedDraftProduct.error).toBeNull();
      expect(resavedDraft.error).toBeNull();
      expect(restoredDraftProduct.error).toBeNull();

      const stored = await adviser
        .from("orders")
        .select("exchange_rate,status,subtotal_cents,discount_cents,total_cents,sdg_total,updated_at,order_lines(id,product_id,unit_price_cents,line_value_cents,discount_cents,line_total_cents,approval_status)")
        .eq("id", orderId)
        .single();
      expect(stored.error).toBeNull();
      expect(stored.data).toMatchObject({
        exchange_rate: 8_200,
        status: "pending_approval",
        subtotal_cents: 575_000,
        discount_cents: 26_000,
        total_cents: 549_000,
        sdg_total: 45_018_000,
      });

      const lines = stored.data?.order_lines ?? [];
      expect(lines.find((line) => line.product_id === products.spf)).toMatchObject({
        unit_price_cents: 51_500,
        line_value_cents: 206_000,
        discount_cents: 4_000,
        line_total_cents: 202_000,
        approval_status: "not_required",
      });
      const blockedLine = lines.find((line) => line.product_id === products.battery16);
      expect(blockedLine).toMatchObject({
        unit_price_cents: 207_000,
        line_value_cents: 207_000,
        discount_cents: 15_000,
        line_total_cents: 192_000,
        approval_status: "pending",
      });

      const blockedFinalize = await adviser.rpc("finalize_order", {
        p_order_id: orderId,
        p_expected_updated_at: stored.data?.updated_at,
      });
      expect(blockedFinalize.error?.code).toBe("55000");

      const forbiddenApproval = await adviser.rpc("approve_order_line", {
        p_line_id: blockedLine?.id,
      });
      expect(forbiddenApproval.error?.code).toBe("42501");

      const approved = await owner.rpc("approve_order_line", { p_line_id: blockedLine?.id });
      expect(approved.error).toBeNull();

      const staleFinalize = await adviser.rpc("finalize_order", {
        p_order_id: orderId,
        p_expected_updated_at: stored.data?.updated_at,
      });
      expect(staleFinalize.error?.code).toBe("40001");

      const approvedOrder = await adviser
        .from("orders")
        .select("updated_at")
        .eq("id", orderId)
        .single();
      expect(approvedOrder.error).toBeNull();

      const finalized = await adviser.rpc("finalize_order", {
        p_order_id: orderId,
        p_expected_updated_at: approvedOrder.data?.updated_at,
      });
      expect(finalized.error).toBeNull();

      const directFinancialEdit = await adviser
        .from("orders")
        .update({ exchange_rate: 9_000 })
        .eq("id", orderId);
      expect(directFinancialEdit.error).not.toBeNull();

      const privilegedFinancialEdit = await service
        .from("orders")
        .update({ exchange_rate: 9_000 })
        .eq("id", orderId);
      expect(privilegedFinancialEdit.error?.code).toBe("55000");

      const repriced = await service
        .from("products")
        .update({ price_cents: 55_000 })
        .eq("id", products.spf);
      const staleCatalogueSave = await adviser.rpc("save_order_draft", {
        p_dealer_id: dealerId,
        p_exchange_rate: 8_200,
        p_lines: [line(products.spf, 1, 0)],
        p_order_id: null,
      });
      const snapshotted = await adviser
        .from("orders")
        .select("total_cents,sdg_total,order_lines(product_id,unit_price_cents)")
        .eq("id", orderId)
        .single();
      const restored = await service
        .from("products")
        .update({ price_cents: 51_500 })
        .eq("id", products.spf);
      expect(repriced.error).toBeNull();
      expect(staleCatalogueSave.error?.code).toBe("40001");
      expect(restored.error).toBeNull();
      expect(snapshotted.data?.total_cents).toBe(549_000);
      expect(snapshotted.data?.sdg_total).toBe(45_018_000);
      expect(
        snapshotted.data?.order_lines.find((line) => line.product_id === products.spf)
          ?.unit_price_cents,
      ).toBe(51_500);

      expect(
        (await owner.rpc("set_current_exchange_rate", { p_exchange_rate: 9_000 })).error,
      ).toBeNull();

      const historical = await adviser
        .from("orders")
        .select("exchange_rate,status,total_cents,sdg_total")
        .eq("id", orderId)
        .single();
      expect(historical.data).toEqual({
        exchange_rate: 8_200,
        status: "confirmed",
        total_cents: 549_000,
        sdg_total: 45_018_000,
      });

      expect(
        (await owner.rpc("set_current_exchange_rate", { p_exchange_rate: 8_200 })).error,
      ).toBeNull();
    },
    30_000,
  );
});
