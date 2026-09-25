import { describe, expect, it } from "vitest";

import { isTrustedMutationRequest } from "@/lib/request-security";

describe("mutation request origin checks", () => {
  it("accepts a same-origin browser request", () => {
    const request = new Request("https://orders.example.com/api/orders", {
      headers: { origin: "https://orders.example.com", "sec-fetch-site": "same-origin" },
      method: "POST",
    });

    expect(isTrustedMutationRequest(request)).toBe(true);
  });

  it("rejects a different origin, including same-site sibling hosts", () => {
    const request = new Request("https://orders.example.com/api/orders", {
      headers: { origin: "https://other.example.com", "sec-fetch-site": "same-site" },
      method: "POST",
    });

    expect(isTrustedMutationRequest(request)).toBe(false);
  });

  it("rejects cross-site browser requests without relying on an Origin header", () => {
    const request = new Request("https://orders.example.com/api/orders", {
      headers: { "sec-fetch-site": "cross-site" },
      method: "POST",
    });

    expect(isTrustedMutationRequest(request)).toBe(false);
  });

  it("allows non-browser clients that do not send browser origin metadata", () => {
    const request = new Request("https://orders.example.com/api/orders", { method: "POST" });

    expect(isTrustedMutationRequest(request)).toBe(true);
  });
});
