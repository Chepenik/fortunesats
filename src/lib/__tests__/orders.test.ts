import { describe, it, expect, vi } from "vitest";

// Mock Redis to use in-memory store (no Upstash needed)
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");

const {
  createOrder,
  getOrder,
  claimFortune,
  markOrderPaid,
  markOrderLightningPaid,
  markOrderConfirmed,
  updateOrder,
  PACK_BASE_PRICE_SATS,
  PACK_SIZE,
} = await import("@/lib/orders");

describe("createOrder", () => {
  it("creates an order with a unique price offset (1-999 sats above base)", async () => {
    const order = await createOrder({ rail: "onchain" });
    expect(order.amountSats).toBeGreaterThan(PACK_BASE_PRICE_SATS);
    expect(order.amountSats).toBeLessThanOrEqual(PACK_BASE_PRICE_SATS + 999);
  });

  it("generates different amounts across orders (probabilistic)", async () => {
    const amounts = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const order = await createOrder({ rail: "onchain" });
      amounts.add(order.amountSats);
    }
    // With 999 possible offsets and 20 samples, we should see at least 2 distinct values
    expect(amounts.size).toBeGreaterThanOrEqual(2);
  });

  it("preserves all required fields", async () => {
    const order = await createOrder({ rail: "onchain" });
    expect(order.id).toBeTruthy();
    expect(order.secret).toBeTruthy();
    expect(order.address).toBeTruthy();
    expect(order.fortunesTotal).toBe(PACK_SIZE);
    expect(order.fortunesRemaining).toBe(PACK_SIZE);
    expect(order.status).toBe("pending");
    expect(order.claimedFortunes).toEqual([]);
  });

  it("creates lightning order with flat base price and no address", async () => {
    const order = await createOrder({ rail: "lightning" });
    expect(order.amountSats).toBe(PACK_BASE_PRICE_SATS);
    expect(order.address).toBe("");
    expect(order.rail).toBe("lightning");
    expect(order.status).toBe("pending");
  });
});

describe("getOrder", () => {
  it("returns the order when secret matches", async () => {
    const created = await createOrder({ rail: "lightning" });
    const fetched = await getOrder(created.id, created.secret);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
  });

  it("returns null when secret is wrong", async () => {
    const created = await createOrder({ rail: "lightning" });
    const fetched = await getOrder(created.id, "wrong-secret");
    expect(fetched).toBeNull();
  });

  it("returns null for unknown order id", async () => {
    const fetched = await getOrder("nonexistent-id", "any-secret");
    expect(fetched).toBeNull();
  });
});

describe("markOrderLightningPaid", () => {
  it("transitions a lightning order from pending to lightning-paid", async () => {
    const order = await createOrder({ rail: "lightning" });
    const updated = await markOrderLightningPaid(order.id);
    expect(updated?.status).toBe("lightning-paid");
    expect(updated?.paidAt).toBeTruthy();
  });

  it("is idempotent — preserves paidAt on repeat calls", async () => {
    const order = await createOrder({ rail: "lightning" });
    const first = await markOrderLightningPaid(order.id);
    const firstPaidAt = first?.paidAt;
    const second = await markOrderLightningPaid(order.id);
    expect(second?.status).toBe("lightning-paid");
    expect(second?.paidAt).toBe(firstPaidAt);
  });

  it("leaves non-lightning orders unchanged", async () => {
    const order = await createOrder({ rail: "onchain" });
    const result = await markOrderLightningPaid(order.id);
    expect(result?.status).toBe("pending");
    expect(result?.rail).toBe("onchain");
  });

  it("returns null for unknown order", async () => {
    const result = await markOrderLightningPaid("nonexistent-id");
    expect(result).toBeNull();
  });
});

describe("markOrderPaid", () => {
  it("transitions a pending on-chain order to mempool", async () => {
    const order = await createOrder({ rail: "onchain" });
    const updated = await markOrderPaid(order.id, "deadbeeftxid", 10500);
    expect(updated?.status).toBe("mempool");
    expect(updated?.txid).toBe("deadbeeftxid");
    expect(updated?.txAmountSats).toBe(10500);
    expect(updated?.paidAt).toBeTruthy();
  });

  it("is idempotent — does not overwrite a paid order", async () => {
    const order = await createOrder({ rail: "onchain" });
    await markOrderPaid(order.id, "first-txid", 10500);
    const second = await markOrderPaid(order.id, "second-txid", 10600);
    expect(second?.txid).toBe("first-txid");
    expect(second?.txAmountSats).toBe(10500);
    expect(second?.status).toBe("mempool");
  });

  it("returns null for unknown order", async () => {
    const result = await markOrderPaid("nonexistent-id", "txid", 10000);
    expect(result).toBeNull();
  });
});

describe("markOrderConfirmed", () => {
  it("transitions a mempool order to confirmed", async () => {
    const order = await createOrder({ rail: "onchain" });
    await markOrderPaid(order.id, "txid123", 10500);
    const confirmed = await markOrderConfirmed(order.id);
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.confirmedAt).toBeTruthy();
  });

  it("returns null for a pending (unpaid) order", async () => {
    const order = await createOrder({ rail: "onchain" });
    const result = await markOrderConfirmed(order.id);
    expect(result).toBeNull();
  });

  it("is idempotent — preserves confirmedAt on repeat calls", async () => {
    const order = await createOrder({ rail: "onchain" });
    await markOrderPaid(order.id, "txid456", 10500);
    const first = await markOrderConfirmed(order.id);
    const firstConfirmedAt = first?.confirmedAt;
    const second = await markOrderConfirmed(order.id);
    expect(second?.confirmedAt).toBe(firstConfirmedAt);
    expect(second?.status).toBe("confirmed");
  });

  it("returns null for unknown order", async () => {
    const result = await markOrderConfirmed("nonexistent-id");
    expect(result).toBeNull();
  });
});

describe("claimFortune", () => {
  it("claims a fortune from a paid lightning order", async () => {
    const order = await createOrder({ rail: "lightning" });
    await markOrderLightningPaid(order.id);
    const result = await claimFortune(order.id, order.secret, "You will find great success.");
    expect(result.success).toBe(true);
    expect(result.fortunesRemaining).toBe(PACK_SIZE - 1);
  });

  it("decrements fortunesRemaining on each successive claim", async () => {
    const order = await createOrder({ rail: "lightning" });
    await markOrderLightningPaid(order.id);
    await claimFortune(order.id, order.secret, "Fortune One");
    const second = await claimFortune(order.id, order.secret, "Fortune Two");
    expect(second.fortunesRemaining).toBe(PACK_SIZE - 2);
  });

  it("claims a fortune from a mempool on-chain order", async () => {
    const order = await createOrder({ rail: "onchain" });
    await markOrderPaid(order.id, "sometxid", 10500);
    const result = await claimFortune(order.id, order.secret, "Wealth awaits.");
    expect(result.success).toBe(true);
    expect(result.fortunesRemaining).toBe(PACK_SIZE - 1);
  });

  it("returns error for unpaid (pending) order", async () => {
    const order = await createOrder({ rail: "lightning" });
    const result = await claimFortune(order.id, order.secret, "Fortune");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not yet paid/i);
  });

  it("returns error with wrong secret", async () => {
    const order = await createOrder({ rail: "lightning" });
    await markOrderLightningPaid(order.id);
    const result = await claimFortune(order.id, "wrong-secret", "Fortune");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid order");
  });

  it("returns error for unknown order id", async () => {
    const result = await claimFortune("nonexistent", "secret", "Fortune");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid order");
  });

  it("returns error when all fortunes have been claimed", async () => {
    const order = await createOrder({ rail: "lightning" });
    await markOrderLightningPaid(order.id);
    // Exhaust the pack by setting fortunesRemaining to 0
    await updateOrder(order.id, { fortunesRemaining: 0 });
    const result = await claimFortune(order.id, order.secret, "One more");
    expect(result.success).toBe(false);
    expect(result.error).toBe("All fortunes claimed");
    expect(result.fortunesRemaining).toBe(0);
  });
});
