import { describe, it, expect, vi } from "vitest";

// Mock Redis to use in-memory store
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");

const { createOrder, PACK_BASE_PRICE_SATS } = await import("@/lib/orders");

describe("createOrder", () => {
  it("creates an order with a unique price offset (1-999 sats above base)", async () => {
    const order = await createOrder();
    expect(order.amountSats).toBeGreaterThan(PACK_BASE_PRICE_SATS);
    expect(order.amountSats).toBeLessThanOrEqual(PACK_BASE_PRICE_SATS + 999);
  });

  it("generates different amounts across orders (probabilistic)", async () => {
    const amounts = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const order = await createOrder();
      amounts.add(order.amountSats);
    }
    // With 999 possible offsets and 20 samples, we should see at least 2 distinct values
    expect(amounts.size).toBeGreaterThanOrEqual(2);
  });

  it("preserves all required fields", async () => {
    const order = await createOrder();
    expect(order.id).toBeTruthy();
    expect(order.secret).toBeTruthy();
    expect(order.address).toBeTruthy();
    expect(order.fortunesTotal).toBe(100);
    expect(order.fortunesRemaining).toBe(100);
    expect(order.status).toBe("pending");
    expect(order.claimedFortunes).toEqual([]);
  });
});
