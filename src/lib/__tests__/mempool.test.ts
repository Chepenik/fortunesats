import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyTxPayment, isTxConfirmed } from "@/lib/mempool";

function makeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "Error",
    json: () => Promise.resolve(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

/* ─── verifyTxPayment ─────────────────────────────────────── */

describe("verifyTxPayment", () => {
  const ADDR = "bc1qtest";
  const TXID = "a".repeat(64);

  it("returns not-found error on 404", async () => {
    vi.stubGlobal("fetch", makeFetch(404, {}));
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("returns generic error on non-ok status", async () => {
    vi.stubGlobal("fetch", makeFetch(503, {}));
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/503/);
  });

  it("returns error when no output pays the expected address", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, {
        vout: [{ scriptpubkey_address: "bc1qother", value: 50_000 }],
        status: { confirmed: false },
      }),
    );
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/correct address/i);
  });

  it("returns underpayment error when amount is below minimum", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, {
        vout: [{ scriptpubkey_address: ADDR, value: 50 }],
        status: { confirmed: false },
      }),
    );
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(false);
    expect(r.amountSats).toBe(50);
    expect(r.error).toMatch(/underpayment/i);
  });

  it("returns valid and confirmed=false for a mempool tx", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, {
        vout: [{ scriptpubkey_address: ADDR, value: 100 }],
        status: { confirmed: false },
      }),
    );
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(true);
    expect(r.confirmed).toBe(false);
    expect(r.amountSats).toBe(100);
  });

  it("returns valid and confirmed=true for a mined tx", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, {
        vout: [{ scriptpubkey_address: ADDR, value: 200 }],
        status: { confirmed: true },
      }),
    );
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(true);
    expect(r.confirmed).toBe(true);
    expect(r.amountSats).toBe(200);
  });

  it("sums multiple outputs to the same address", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, {
        vout: [
          { scriptpubkey_address: ADDR, value: 60 },
          { scriptpubkey_address: "bc1qother", value: 9_999 },
          { scriptpubkey_address: ADDR, value: 60 },
        ],
        status: { confirmed: false },
      }),
    );
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(true);
    expect(r.amountSats).toBe(120);
  });

  it("accepts exact minimum payment", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, {
        vout: [{ scriptpubkey_address: ADDR, value: 100 }],
        status: { confirmed: false },
      }),
    );
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(true);
    expect(r.amountSats).toBe(100);
  });

  it("ignores missing vout field gracefully", async () => {
    vi.stubGlobal("fetch", makeFetch(200, { status: { confirmed: false } }));
    const r = await verifyTxPayment(TXID, ADDR, 100);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/correct address/i);
  });
});

/* ─── isTxConfirmed ──────────────────────────────────────── */

describe("isTxConfirmed", () => {
  const TXID = "b".repeat(64);

  it("returns confirmed=false when API returns non-ok status", async () => {
    vi.stubGlobal("fetch", makeFetch(500, {}));
    const r = await isTxConfirmed(TXID);
    expect(r.confirmed).toBe(false);
    expect(r.blockHeight).toBeUndefined();
  });

  it("returns confirmed=false for an unconfirmed tx", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, { status: { confirmed: false } }),
    );
    const r = await isTxConfirmed(TXID);
    expect(r.confirmed).toBe(false);
  });

  it("returns confirmed=true with blockHeight for a mined tx", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(200, { status: { confirmed: true, block_height: 850_000 } }),
    );
    const r = await isTxConfirmed(TXID);
    expect(r.confirmed).toBe(true);
    expect(r.blockHeight).toBe(850_000);
  });
});
