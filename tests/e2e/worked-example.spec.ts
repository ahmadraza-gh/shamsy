import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_E2E === "1";
const adviserEmail = process.env.E2E_ADVISER_EMAIL ?? "";
const adviserPassword = process.env.E2E_ADVISER_PASSWORD ?? "";
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? "";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocalDatabase = (() => {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
})();

const ids = {
  dealer: "00000000-0000-4000-8000-000000000001",
  spf: "10000000-0000-4000-8000-000000000001",
  battery5: "10000000-0000-4000-8000-000000000003",
  battery16: "10000000-0000-4000-8000-000000000004",
};

test.skip(!enabled, "Set RUN_E2E=1 after configuring and seeding Supabase.");
if (enabled && (!adviserEmail || !adviserPassword || !ownerEmail || !ownerPassword)) {
  throw new Error("E2E account credentials are required when RUN_E2E=1.");
}
if (enabled && !isLocalDatabase && process.env.ALLOW_DESTRUCTIVE_TESTS !== "1") {
  throw new Error(
    "E2E mutates data and requires local Supabase. Set ALLOW_DESTRUCTIVE_TESTS=1 only for an isolated remote test project.",
  );
}

test("worked order requires owner approval and preserves its historical rate", async ({ page }) => {
  await login(page, adviserEmail, adviserPassword);
  await page.goto("/orders/new");
  const spfCatalogUpdatedAt = await page
    .locator(`option[value="${ids.spf}"]`)
    .first()
    .getAttribute("data-catalog-updated-at");
  expect(spfCatalogUpdatedAt).toBeTruthy();

  const invalidRate = await page.request.post("/api/orders", {
    data: {
      dealerId: ids.dealer,
      exchangeRate: 7_900,
      lines: [{
        productId: ids.spf,
        quantity: 1,
        discountCents: 0,
        catalogUpdatedAt: spfCatalogUpdatedAt,
      }],
    },
  });
  expect(invalidRate.status()).toBe(422);

  const tamperedPrice = await page.request.post("/api/orders", {
    data: {
      dealerId: ids.dealer,
      exchangeRate: 8_200,
      lines: [
        {
          productId: ids.spf,
          quantity: 1,
          discountCents: 0,
          catalogUpdatedAt: spfCatalogUpdatedAt,
          unitPriceCents: 10_000,
        },
      ],
    },
  });
  expect(tamperedPrice.status()).toBe(422);

  await page.goto("/orders/new");
  await page.getByLabel("Dealer").selectOption(ids.dealer);
  await page.getByLabel("SDG per USD").fill("8200");
  await enterLine(page, 1, ids.spf, "4", "40");
  await page.getByRole("button", { name: "Add product" }).click();
  await enterLine(page, 2, ids.battery5, "2", "70");
  await expect(page.getByTestId("usd-total")).toHaveText("$3,570.00");
  await expect(page.getByTestId("sdg-total")).toHaveText("29,274,000 SDG");
  await page.getByRole("button", { name: "Save & confirm" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+\?result=confirmed/);
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("$3,570.00", { exact: true })).toBeVisible();
  await expect(page.getByText("29,274,000 SDG", { exact: true })).toBeVisible();

  await page.goto("/orders/new");
  await page.getByLabel("Dealer").selectOption(ids.dealer);
  const rate = page.getByLabel("SDG per USD");
  await rate.fill("7900");
  await rate.press("Tab");
  await expect(rate).toHaveValue("8000");
  await expect(page.getByText("Exchange rate cannot be lower than 8,000 SDG/USD.")).toBeVisible();
  await rate.fill("8200");

  await enterLine(page, 1, ids.spf, "4", "40");
  await page.getByRole("button", { name: "Add product" }).click();
  await enterLine(page, 2, ids.battery5, "2", "70");
  await page.getByRole("button", { name: "Add product" }).click();
  await enterLine(page, 3, ids.battery16, "1", "150");

  const firstLine = page.getByTestId("order-line-1");
  await expect(firstLine.getByText("$515.00", { exact: true })).toBeVisible();
  await expect(firstLine.getByText("$2,060.00", { exact: true })).toBeVisible();
  await expect(firstLine.getByText("1.94%", { exact: true })).toBeVisible();
  await expect(firstLine.getByText("$2,020.00", { exact: true })).toBeVisible();

  const secondLine = page.getByTestId("order-line-2");
  await expect(secondLine.getByText("$1,620.00", { exact: true })).toBeVisible();
  await expect(secondLine.getByText("4.32%", { exact: true })).toBeVisible();
  await expect(secondLine.getByText("$1,550.00", { exact: true })).toBeVisible();

  const thirdLine = page.getByTestId("order-line-3");
  await expect(thirdLine.getByText("7.25%", { exact: true })).toBeVisible();
  await expect(thirdLine.getByText("$1,920.00", { exact: true })).toBeVisible();

  await expect(page.getByTestId("discount-status-1")).toContainText("Within adviser limit");
  await expect(page.getByTestId("discount-status-2")).toContainText("High discount");
  await expect(page.getByTestId("discount-status-3")).toContainText("Owner approval required");
  await expect(page.getByTestId("usd-total")).toHaveText("$5,490.00");
  await expect(page.getByTestId("sdg-total")).toHaveText("45,018,000 SDG");
  await expect(page.getByRole("button", { name: "Save & confirm" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Save for approval" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+\?result=saved/);
  const orderPath = new URL(page.url()).pathname;
  const orderId = orderPath.split("/").at(-1);
  expect(orderId).toBeTruthy();
  const blockedLineId = await page.getByTestId("detail-line-3").getAttribute("data-line-id");
  expect(blockedLineId).toBeTruthy();

  const forbidden = await page.request.post(`/api/order-lines/${blockedLineId}/approve`);
  expect(forbidden.status()).toBe(403);

  await signOut(page);
  await login(page, ownerEmail, ownerPassword);
  await page.goto("/approvals");
  const approvalCard = page.getByTestId(`approval-order-${orderId}`);
  await expect(approvalCard.getByText("Hope 16.0LM-A1 — 16 kWh battery")).toBeVisible();
  await expect(approvalCard.getByText("7.25%")).toBeVisible();
  await approvalCard.getByRole("button", { name: "Approve discount" }).click();
  await expect(approvalCard).toHaveCount(0);

  await signOut(page);
  await login(page, adviserEmail, adviserPassword);
  await page.goto(orderPath);
  await page.getByRole("button", { name: "Finalize order" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("$5,490.00", { exact: true })).toBeVisible();
  await expect(page.getByText("45,018,000 SDG", { exact: true })).toBeVisible();

  await signOut(page);
  await login(page, ownerEmail, ownerPassword);
  await page.goto("/approvals");
  await page.getByLabel("Current SDG per USD").fill("9000");
  await page.getByRole("button", { name: "Update current rate" }).click();
  await expect(page.getByText("Existing orders were not changed.")).toBeVisible();
  await page.goto(orderPath);
  await expect(page.getByText("Stored rate: 8,200 SDG/USD")).toBeVisible();
  await expect(page.getByText("45,018,000 SDG", { exact: true })).toBeVisible();
  await expect(page.getByText("49,410,000 SDG", { exact: true })).toHaveCount(0);

  await page.goto("/approvals");
  await page.getByLabel("Current SDG per USD").fill("8200");
  await page.getByRole("button", { name: "Update current rate" }).click();
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/orders\/new/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
}

async function enterLine(
  page: Page,
  number: number,
  productId: string,
  quantity: string,
  discount: string,
) {
  const line = page.getByTestId(`order-line-${number}`);
  await line.getByLabel(`Line ${number} product`).selectOption(productId);
  await line.getByLabel(`Line ${number} quantity`).fill(quantity);
  await line.getByLabel(`Line ${number} discount USD`).fill(discount);
}
