import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Hoisted mocks ──────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  verifyStrikeWebhookSignature: vi.fn(),
  claimWebhookEvent: vi.fn(),
  getStrikeInvoice: vi.fn(),
  getCheckoutRecord: vi.fn(),
  saveCheckoutRecord: vi.fn(),
  applyInvoiceToRecord: vi.fn(),
  getOrderIdByStrikeInvoice: vi.fn(),
  markOrderLightningPaid: vi.fn(),
}));

vi.mock("@/lib/strike", () => ({
  verifyStrikeWebhookSignature: mocks.verifyStrikeWebhookSignature,
  claimWebhookEvent: mocks.claimWebhookEvent,
  getStrikeInvoice: mocks.getStrikeInvoice,
  getCheckoutRecord: mocks.getCheckoutRecord,
  saveCheckoutRecord: mocks.saveCheckoutRecord,
  applyInvoiceToRecord: mocks.applyInvoiceToRecord,
}));

vi.mock("@/lib/orders", () => ({
  getOrderIdByStrikeInvoice: mocks.getOrderIdByStrikeInvoice,
  markOrderLightningPaid: mocks.markOrderLightningPaid,
}));

const { POST } = await import("@/app/api/strike/webhook/route");

/* ─── Fixtures ───────────────────────────────────────────── */

const INVOICE_ID = "inv_test123";

const UNPAID_INVOICE = {
  invoiceId: INVOICE_ID,
  state: "UNPAID",
  amount: { amount: "0.00000100", currency: "BTC" },
  created: "2026-01-01T00:00:00Z",
};

const PAID_INVOICE = { ...UNPAID_INVOICE, state: "PAID" };

const BASE_RECORD = {
  invoiceId: INVOICE_ID,
  correlationId: "corr-1",
  purchaseType: "fortune" as const,
  amountSats: 100,
  amountBtc: "0.00000100",
  description: "Test fortune",
  state: "UNPAID" as const,
  createdAt: Date.now(),
  lastSyncedAt: Date.now(),
};

const PAID_RECORD = { ...BASE_RECORD, state: "PAID" as const, paidAt: Date.now() };

function webhookPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_001",
    eventType: "invoice.updated",
    webhookVersion: "1.0",
    data: { entityId: INVOICE_ID },
    created: "2026-01-01T00:00:00Z",
    ...overrides,
  });
}

function webhookRequest(body: string, signature = "valid-sig") {
  return new Request("https://fortunesats.test/api/strike/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-signature": signature },
    body,
  });
}

/* ─── Tests ──────────────────────────────────────────────── */

describe("POST /api/strike/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyStrikeWebhookSignature.mockReturnValue(true);
    mocks.claimWebhookEvent.mockResolvedValue(true);
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);
    mocks.getCheckoutRecord.mockResolvedValue(BASE_RECORD);
    mocks.saveCheckoutRecord.mockResolvedValue(undefined);
    mocks.applyInvoiceToRecord.mockReturnValue(PAID_RECORD);
    mocks.getOrderIdByStrikeInvoice.mockResolvedValue(null);
    mocks.markOrderLightningPaid.mockResolvedValue(undefined);
  });

  describe("request validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const res = await POST(webhookRequest("not-json"));
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toBe("Invalid JSON");
    });

    it("returns 401 when signature verification fails", async () => {
      mocks.verifyStrikeWebhookSignature.mockReturnValue(false);

      const res = await POST(webhookRequest(webhookPayload()));
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toBe("Unauthorized");
    });

    it("does not call Strike API when signature fails", async () => {
      mocks.verifyStrikeWebhookSignature.mockReturnValue(false);

      await POST(webhookRequest(webhookPayload()));

      expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
      expect(mocks.saveCheckoutRecord).not.toHaveBeenCalled();
    });
  });

  describe("deduplication", () => {
    it("returns 200 deduped when event already processed", async () => {
      mocks.claimWebhookEvent.mockResolvedValue(false);

      const res = await POST(webhookRequest(webhookPayload()));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true, deduped: true });
      expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
    });
  });

  describe("event filtering", () => {
    it("acknowledges and ignores unknown event types", async () => {
      const res = await POST(webhookRequest(webhookPayload({ eventType: "invoice.created" })));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true, ignored: "invoice.created" });
      expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
    });

    it("returns noop 200 when entityId is missing", async () => {
      const res = await POST(webhookRequest(webhookPayload({ data: {} })));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.noop).toContain("missing entityId");
      expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
    });
  });

  describe("happy path — fortune payment", () => {
    it("fetches invoice, applies to record, saves, and returns 200", async () => {
      const res = await POST(webhookRequest(webhookPayload()));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true });

      expect(mocks.getStrikeInvoice).toHaveBeenCalledWith(INVOICE_ID);
      expect(mocks.getCheckoutRecord).toHaveBeenCalledWith(INVOICE_ID);
      expect(mocks.applyInvoiceToRecord).toHaveBeenCalledWith(BASE_RECORD, PAID_INVOICE);
      expect(mocks.saveCheckoutRecord).toHaveBeenCalledWith(PAID_RECORD);
    });

    it("does not call markOrderLightningPaid for a plain fortune purchase", async () => {
      await POST(webhookRequest(webhookPayload()));

      expect(mocks.markOrderLightningPaid).not.toHaveBeenCalled();
    });
  });

  describe("happy path — fortune-pack payment", () => {
    const PACK_RECORD = {
      ...BASE_RECORD,
      purchaseType: "fortune-pack" as const,
      orderId: "order-abc",
    };
    const PAID_PACK_RECORD = { ...PACK_RECORD, state: "PAID" as const };

    beforeEach(() => {
      mocks.getCheckoutRecord.mockResolvedValue(PACK_RECORD);
      mocks.applyInvoiceToRecord.mockReturnValue(PAID_PACK_RECORD);
    });

    it("marks the linked order lightning-paid when pack invoice is paid", async () => {
      const res = await POST(webhookRequest(webhookPayload()));

      expect(res.status).toBe(200);
      expect(mocks.markOrderLightningPaid).toHaveBeenCalledWith("order-abc");
    });

    it("falls back to getOrderIdByStrikeInvoice when orderId is not on the record", async () => {
      const recordWithoutOrderId = { ...PACK_RECORD, orderId: undefined };
      const paidRecordWithoutOrderId = { ...recordWithoutOrderId, state: "PAID" as const };
      mocks.getCheckoutRecord.mockResolvedValue(recordWithoutOrderId);
      mocks.applyInvoiceToRecord.mockReturnValue(paidRecordWithoutOrderId);
      mocks.getOrderIdByStrikeInvoice.mockResolvedValue("order-fallback");

      await POST(webhookRequest(webhookPayload()));

      expect(mocks.getOrderIdByStrikeInvoice).toHaveBeenCalledWith(INVOICE_ID);
      expect(mocks.markOrderLightningPaid).toHaveBeenCalledWith("order-fallback");
    });

    it("does not call markOrderLightningPaid when pack record is still UNPAID", async () => {
      const unpaidPackRecord = { ...PACK_RECORD, state: "UNPAID" as const };
      mocks.applyInvoiceToRecord.mockReturnValue(unpaidPackRecord);

      await POST(webhookRequest(webhookPayload()));

      expect(mocks.markOrderLightningPaid).not.toHaveBeenCalled();
    });
  });

  describe("missing checkout record", () => {
    it("acknowledges the webhook without error when no record is found", async () => {
      mocks.getCheckoutRecord.mockResolvedValue(null);

      const res = await POST(webhookRequest(webhookPayload()));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true });
      expect(mocks.saveCheckoutRecord).not.toHaveBeenCalled();
    });
  });

  describe("Strike API error", () => {
    it("returns 500 so Strike retries delivery", async () => {
      mocks.getStrikeInvoice.mockRejectedValue(new Error("Strike 503"));

      const res = await POST(webhookRequest(webhookPayload()));

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toBe("processing failed");
    });
  });
});
