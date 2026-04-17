import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

// No Redis mock required — helpers under test don't touch Redis.
import {
  satsToBtcAmount,
  btcAmountToSats,
  verifyStrikeWebhookSignature,
  applyInvoiceToRecord,
  type StrikeCheckoutRecord,
  type StrikeInvoice,
} from "@/lib/strike";

describe("satsToBtcAmount / btcAmountToSats", () => {
  it("formats 1000 sats as 0.00001000 BTC", () => {
    expect(satsToBtcAmount(1000)).toBe("0.00001000");
  });

  it("formats 100 sats as 0.00000100 BTC", () => {
    expect(satsToBtcAmount(100)).toBe("0.00000100");
  });

  it("formats 100_000_000 sats as exactly 1 BTC", () => {
    expect(satsToBtcAmount(100_000_000)).toBe("1.00000000");
  });

  it("round-trips back to sats", () => {
    for (const n of [1, 100, 1000, 12345, 99_999_999, 100_000_000, 210_000_000]) {
      expect(btcAmountToSats(satsToBtcAmount(n))).toBe(n);
    }
  });

  it("rejects negative or non-integer sats", () => {
    expect(() => satsToBtcAmount(-1)).toThrow();
    expect(() => satsToBtcAmount(1.5)).toThrow();
  });

  it("rejects BTC strings with more than 8 decimals", () => {
    expect(btcAmountToSats("0.123456789")).toBeNull();
    expect(btcAmountToSats("0.000000001")).toBeNull();
  });

  it("rejects malformed BTC strings", () => {
    expect(btcAmountToSats("abc")).toBeNull();
    expect(btcAmountToSats("")).toBeNull();
    expect(btcAmountToSats("-1.0")).toBeNull();
    expect(btcAmountToSats("1.2.3")).toBeNull();
  });
});

describe("verifyStrikeWebhookSignature", () => {
  const secret = "test-secret-for-unit-tests";
  const body = { id: "evt_1", eventType: "invoice.updated", data: { entityId: "inv_1" } };

  function sign(b: unknown, s: string = secret): string {
    return createHmac("sha256", s).update(JSON.stringify(b)).digest("hex");
  }

  it("accepts a valid signature", () => {
    expect(verifyStrikeWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it("rejects a wrong-secret signature", () => {
    expect(verifyStrikeWebhookSignature(body, sign(body, "other-secret"), secret)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const sig = sign(body);
    const tampered = { ...body, eventType: "invoice.created" };
    expect(verifyStrikeWebhookSignature(tampered, sig, secret)).toBe(false);
  });

  it("rejects missing signature", () => {
    expect(verifyStrikeWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyStrikeWebhookSignature(body, "", secret)).toBe(false);
  });

  it("rejects a signature of wrong length (no throw on timingSafeEqual)", () => {
    expect(verifyStrikeWebhookSignature(body, "deadbeef", secret)).toBe(false);
  });

  it("rejects when secret is missing", () => {
    expect(verifyStrikeWebhookSignature(body, sign(body), undefined)).toBe(false);
  });
});

describe("applyInvoiceToRecord", () => {
  let base: StrikeCheckoutRecord;
  beforeEach(() => {
    base = {
      invoiceId: "inv_1",
      correlationId: "fortunesats-abc-123456",
      purchaseType: "fortune",
      amountSats: 100,
      amountBtc: "0.00000100",
      description: "One fortune — Fortune Sats",
      state: "UNPAID",
      createdAt: 1_700_000_000_000,
      lastSyncedAt: 1_700_000_000_000,
    };
  });

  it("marks paidAt on UNPAID→PAID transition", () => {
    const invoice: StrikeInvoice = {
      invoiceId: "inv_1",
      amount: { amount: "0.00000100", currency: "BTC" },
      state: "PAID",
      created: "2026-04-17T00:00:00Z",
    };
    const now = 1_700_000_050_000;
    const next = applyInvoiceToRecord(base, invoice, now);
    expect(next.state).toBe("PAID");
    expect(next.paidAt).toBe(now);
    expect(next.lastSyncedAt).toBe(now);
  });

  it("does not overwrite an existing paidAt", () => {
    const already: StrikeCheckoutRecord = { ...base, state: "PAID", paidAt: 111 };
    const invoice: StrikeInvoice = {
      invoiceId: "inv_1",
      amount: { amount: "0.00000100", currency: "BTC" },
      state: "PAID",
      created: "2026-04-17T00:00:00Z",
    };
    const next = applyInvoiceToRecord(already, invoice, 222);
    expect(next.paidAt).toBe(111);
  });

  it("does not set paidAt when state remains UNPAID", () => {
    const invoice: StrikeInvoice = {
      invoiceId: "inv_1",
      amount: { amount: "0.00000100", currency: "BTC" },
      state: "UNPAID",
      created: "2026-04-17T00:00:00Z",
    };
    const next = applyInvoiceToRecord(base, invoice, 222);
    expect(next.state).toBe("UNPAID");
    expect(next.paidAt).toBeUndefined();
  });
});
