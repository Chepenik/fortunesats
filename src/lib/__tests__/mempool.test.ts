import { describe, it, expect, vi, afterEach } from "vitest";

import {
  verifyTxPayment,
  isTxConfirmed,
  getAddressStats,
  getMempoolTransactions,
  findPayment,
} from "@/lib/mempool";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status: number, data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : status >= 500 ? "Server Error" : "OK",
    json: async () => data,
  });
}

// ─── verifyTxPayment ─────────────────────────────────────────────────────────

describe("verifyTxPayment", () => {
  const txid = "a".repeat(64);
  const address = "bc1qtest123";
  const minSats = 10_000;

  it("returns valid=true when tx pays correct address above minimum", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      vout: [
        { scriptpubkey_address: address, value: 10_500 },
        { scriptpubkey_address: "bc1qother", value: 500 },
      ],
      status: { confirmed: true, block_height: 800_000 },
    }));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(true);
    expect(result.confirmed).toBe(true);
    expect(result.amountSats).toBe(10_500);
    expect(result.error).toBeUndefined();
  });

  it("sums multiple outputs to the same address", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      vout: [
        { scriptpubkey_address: address, value: 5_000 },
        { scriptpubkey_address: address, value: 6_000 },
      ],
      status: { confirmed: false },
    }));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(true);
    expect(result.amountSats).toBe(11_000);
    expect(result.confirmed).toBe(false);
  });

  it("returns valid=false when tx pays nothing to expected address", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      vout: [{ scriptpubkey_address: "bc1qother", value: 20_000 }],
      status: { confirmed: false },
    }));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/correct address/i);
  });

  it("returns valid=false with underpayment error when amount is short", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      vout: [{ scriptpubkey_address: address, value: 5_000 }],
      status: { confirmed: false },
    }));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(false);
    expect(result.amountSats).toBe(5_000);
    expect(result.error).toMatch(/Underpayment/i);
  });

  it("returns valid=false when txid is not found (404)", async () => {
    vi.stubGlobal("fetch", mockFetch(404, {}));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(false);
    expect(result.confirmed).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("returns valid=false with status code on non-404 API error", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/503/);
  });

  it("handles missing vout field gracefully", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: { confirmed: false } }));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/correct address/i);
  });

  it("accepts exact minimum amount", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      vout: [{ scriptpubkey_address: address, value: minSats }],
      status: { confirmed: true },
    }));
    const result = await verifyTxPayment(txid, address, minSats);
    expect(result.valid).toBe(true);
    expect(result.amountSats).toBe(minSats);
  });
});

// ─── isTxConfirmed ───────────────────────────────────────────────────────────

describe("isTxConfirmed", () => {
  const txid = "b".repeat(64);

  it("returns confirmed=true with blockHeight for a confirmed tx", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      status: { confirmed: true, block_height: 850_000 },
    }));
    const result = await isTxConfirmed(txid);
    expect(result.confirmed).toBe(true);
    expect(result.blockHeight).toBe(850_000);
  });

  it("returns confirmed=false for an unconfirmed tx", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: { confirmed: false } }));
    const result = await isTxConfirmed(txid);
    expect(result.confirmed).toBe(false);
    expect(result.blockHeight).toBeUndefined();
  });

  it("returns confirmed=false on API error without throwing", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    const result = await isTxConfirmed(txid);
    expect(result.confirmed).toBe(false);
  });
});

// ─── getAddressStats ─────────────────────────────────────────────────────────

describe("getAddressStats", () => {
  const address = "bc1qtest123";

  it("computes confirmed and mempool balances correctly", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      chain_stats: { funded_txo_sum: 50_000, spent_txo_sum: 10_000, funded_txo_count: 5 },
      mempool_stats: { funded_txo_sum: 3_000, spent_txo_sum: 0, funded_txo_count: 1 },
    }));
    const stats = await getAddressStats(address);
    expect(stats.confirmedBalance).toBe(40_000); // 50k - 10k
    expect(stats.mempoolBalance).toBe(3_000);
    expect(stats.confirmedTxCount).toBe(5);
    expect(stats.mempoolTxCount).toBe(1);
  });

  it("handles zero balances", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0, funded_txo_count: 0 },
      mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, funded_txo_count: 0 },
    }));
    const stats = await getAddressStats(address);
    expect(stats.confirmedBalance).toBe(0);
    expect(stats.mempoolBalance).toBe(0);
  });

  it("throws on API failure", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    await expect(getAddressStats(address)).rejects.toThrow(/mempool\.space/);
  });
});

// ─── getMempoolTransactions ──────────────────────────────────────────────────

describe("getMempoolTransactions", () => {
  const address = "bc1qtest456";

  it("returns parsed transactions paying to the target address", async () => {
    vi.stubGlobal("fetch", mockFetch(200, [
      {
        txid: "tx1" + "0".repeat(60),
        vout: [
          { scriptpubkey_address: address, value: 8_000 },
          { scriptpubkey_address: "bc1qother", value: 2_000 },
        ],
        status: { confirmed: false },
      },
    ]));
    const txs = await getMempoolTransactions(address);
    expect(txs).toHaveLength(1);
    expect(txs[0].txid).toBe("tx1" + "0".repeat(60));
    expect(txs[0].amountSats).toBe(8_000);
    expect(txs[0].confirmed).toBe(false);
  });

  it("filters out txs that don't pay to the target address", async () => {
    vi.stubGlobal("fetch", mockFetch(200, [
      {
        txid: "tx2" + "0".repeat(60),
        vout: [{ scriptpubkey_address: "bc1qother", value: 5_000 }],
        status: { confirmed: false },
      },
    ]));
    const txs = await getMempoolTransactions(address);
    expect(txs).toHaveLength(0);
  });

  it("throws on API failure", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    await expect(getMempoolTransactions(address)).rejects.toThrow(/mempool\.space/);
  });
});

// ─── findPayment ─────────────────────────────────────────────────────────────

describe("findPayment", () => {
  const address = "bc1qfind";
  const minSats = 5_000;
  const txid = "found" + "0".repeat(59);

  it("returns the first mempool tx that meets the minimum", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => [{
          txid,
          vout: [{ scriptpubkey_address: address, value: 6_000 }],
          status: { confirmed: false },
        }],
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await findPayment(address, minSats);
    expect(result).not.toBeNull();
    expect(result?.txid).toBe(txid);
    expect(result?.amountSats).toBe(6_000);
  });

  it("falls through to confirmed txs when mempool is empty", async () => {
    const confirmedTxid = "confirmed" + "0".repeat(55);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => [{
          txid: confirmedTxid,
          vout: [{ scriptpubkey_address: address, value: 10_000 }],
          status: { confirmed: true, block_height: 800_000 },
        }],
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await findPayment(address, minSats);
    expect(result?.txid).toBe(confirmedTxid);
    expect(result?.confirmed).toBe(true);
  });

  it("returns null when no qualifying tx exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    }));
    const result = await findPayment(address, minSats);
    expect(result).toBeNull();
  });

  it("skips txids in the excludeTxids set", async () => {
    const exclude = new Set([txid]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => [{
          txid,
          vout: [{ scriptpubkey_address: address, value: 6_000 }],
          status: { confirmed: false },
        }],
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await findPayment(address, minSats, exclude);
    expect(result).toBeNull();
  });
});
