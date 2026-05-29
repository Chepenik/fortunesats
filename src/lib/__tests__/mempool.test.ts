import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyTxPayment, isTxConfirmed } from "@/lib/mempool";

const TARGET = "bc1qtest000000000000000000000000000000000000";
const TXID = "a".repeat(64);

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => body,
    }),
  );
}

function makeTx(
  vout: Array<{ scriptpubkey_address: string; value: number }>,
  confirmed = false,
  blockHeight?: number,
) {
  return {
    txid: TXID,
    vout,
    status: { confirmed, block_height: blockHeight },
  };
}

afterEach(() => vi.restoreAllMocks());

/* ─── verifyTxPayment ──────────────────────────────────────── */

describe("verifyTxPayment", () => {
  it("returns invalid for 404 (tx not broadcast yet)", async () => {
    mockFetch(404, null);
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("returns invalid on API error (non-404)", async () => {
    mockFetch(500, null);
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/500/);
  });

  it("returns invalid when no output pays the target address", async () => {
    mockFetch(200, makeTx([{ scriptpubkey_address: "bc1qOTHER", value: 10_000 }]));
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/correct address/i);
  });

  it("returns invalid for underpayment with the received amount", async () => {
    mockFetch(200, makeTx([{ scriptpubkey_address: TARGET, value: 5_000 }]));
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(false);
    expect(r.amountSats).toBe(5_000);
    expect(r.error).toMatch(/underpayment/i);
  });

  it("returns valid + unconfirmed for exact mempool payment", async () => {
    mockFetch(200, makeTx([{ scriptpubkey_address: TARGET, value: 10_000 }]));
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(true);
    expect(r.confirmed).toBe(false);
    expect(r.amountSats).toBe(10_000);
  });

  it("returns valid + confirmed when tx is in a block", async () => {
    mockFetch(200, makeTx([{ scriptpubkey_address: TARGET, value: 10_000 }], true, 850_000));
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(true);
    expect(r.confirmed).toBe(true);
    expect(r.amountSats).toBe(10_000);
  });

  it("accepts overpayment", async () => {
    mockFetch(200, makeTx([{ scriptpubkey_address: TARGET, value: 15_000 }]));
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(true);
    expect(r.amountSats).toBe(15_000);
  });

  it("sums multiple outputs to the same address", async () => {
    mockFetch(
      200,
      makeTx([
        { scriptpubkey_address: TARGET, value: 4_000 },
        { scriptpubkey_address: "bc1qOTHER", value: 99_999 },
        { scriptpubkey_address: TARGET, value: 7_000 },
      ]),
    );
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(true);
    expect(r.amountSats).toBe(11_000);
  });

  it("ignores outputs to other addresses when summing", async () => {
    mockFetch(
      200,
      makeTx([
        { scriptpubkey_address: "bc1qOTHER1", value: 5_000 },
        { scriptpubkey_address: TARGET, value: 10_000 },
        { scriptpubkey_address: "bc1qOTHER2", value: 5_000 },
      ]),
    );
    const r = await verifyTxPayment(TXID, TARGET, 10_000);
    expect(r.valid).toBe(true);
    expect(r.amountSats).toBe(10_000);
  });
});

/* ─── isTxConfirmed ────────────────────────────────────────── */

describe("isTxConfirmed", () => {
  it("returns confirmed=false when API call fails", async () => {
    mockFetch(404, null);
    const r = await isTxConfirmed(TXID);
    expect(r.confirmed).toBe(false);
  });

  it("returns confirmed=false for mempool tx", async () => {
    mockFetch(200, { status: { confirmed: false } });
    const r = await isTxConfirmed(TXID);
    expect(r.confirmed).toBe(false);
    expect(r.blockHeight).toBeUndefined();
  });

  it("returns confirmed=true with block height for a mined tx", async () => {
    mockFetch(200, { status: { confirmed: true, block_height: 850_000 } });
    const r = await isTxConfirmed(TXID);
    expect(r.confirmed).toBe(true);
    expect(r.blockHeight).toBe(850_000);
  });
});
