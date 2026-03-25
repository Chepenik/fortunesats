/**
 * Mempool.space API client for on-chain payment detection.
 *
 * Configurable via:
 *   MEMPOOL_API_URL — defaults to https://mempool.space/api
 */

const API_BASE =
  process.env.MEMPOOL_API_URL?.replace(/\/+$/, "") ||
  "https://mempool.space/api";

/* ─── Types ──────────────────────────────────────────────── */

export interface AddressStats {
  /** Confirmed sats received (funded minus spent) */
  confirmedBalance: number;
  /** Unconfirmed sats received sitting in the mempool */
  mempoolBalance: number;
  /** Number of confirmed txs funding this address */
  confirmedTxCount: number;
  /** Number of mempool txs funding this address */
  mempoolTxCount: number;
}

export interface DetectedTx {
  txid: string;
  /** Total sats sent to the target address in this tx */
  amountSats: number;
  confirmed: boolean;
  blockHeight?: number;
  /** Unix timestamp (seconds) — only present for confirmed txs */
  timestamp?: number;
}

/* ─── API calls ──────────────────────────────────────────── */

/**
 * Fetch aggregate balance stats for an address.
 * Uses the /api/address/{address} endpoint.
 */
export async function getAddressStats(
  address: string,
): Promise<AddressStats> {
  const res = await fetch(`${API_BASE}/address/${address}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(
      `mempool.space /address failed: ${res.status} ${res.statusText}`,
    );
  }
  const data = await res.json();
  return {
    confirmedBalance:
      (data.chain_stats?.funded_txo_sum ?? 0) -
      (data.chain_stats?.spent_txo_sum ?? 0),
    mempoolBalance:
      (data.mempool_stats?.funded_txo_sum ?? 0) -
      (data.mempool_stats?.spent_txo_sum ?? 0),
    confirmedTxCount: data.chain_stats?.funded_txo_count ?? 0,
    mempoolTxCount: data.mempool_stats?.funded_txo_count ?? 0,
  };
}

/**
 * List unconfirmed (mempool) transactions that fund the given address.
 */
export async function getMempoolTransactions(
  address: string,
): Promise<DetectedTx[]> {
  const res = await fetch(`${API_BASE}/address/${address}/txs/mempool`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(
      `mempool.space /txs/mempool failed: ${res.status} ${res.statusText}`,
    );
  }
  const txs: unknown[] = await res.json();
  return parseTxList(txs, address, false);
}

/**
 * List confirmed transactions that fund the given address.
 * Returns most recent first (mempool.space default order).
 */
export async function getConfirmedTransactions(
  address: string,
): Promise<DetectedTx[]> {
  const res = await fetch(`${API_BASE}/address/${address}/txs`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(
      `mempool.space /txs failed: ${res.status} ${res.statusText}`,
    );
  }
  const txs: unknown[] = await res.json();
  return parseTxList(txs, address, true);
}

/**
 * Convenience: check for any payment to {address} with total ≥ {minSats}.
 * Checks mempool first, then confirmed.
 * Returns the first qualifying tx, or null.
 */
export async function findPayment(
  address: string,
  minSats: number,
  excludeTxids?: Set<string>,
): Promise<DetectedTx | null> {
  // Check mempool first for fastest detection
  const mempoolTxs = await getMempoolTransactions(address);
  for (const tx of mempoolTxs) {
    if (tx.amountSats >= minSats && !excludeTxids?.has(tx.txid)) {
      return tx;
    }
  }

  // Then check confirmed
  const confirmedTxs = await getConfirmedTransactions(address);
  for (const tx of confirmedTxs) {
    if (tx.amountSats >= minSats && !excludeTxids?.has(tx.txid)) {
      return tx;
    }
  }

  return null;
}

/**
 * Check whether a specific txid has been confirmed.
 */
export async function isTxConfirmed(
  txid: string,
): Promise<{ confirmed: boolean; blockHeight?: number }> {
  const res = await fetch(`${API_BASE}/tx/${txid}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) return { confirmed: false };
  const data = await res.json();
  return {
    confirmed: !!data.status?.confirmed,
    blockHeight: data.status?.block_height,
  };
}

/**
 * Verify a specific txid pays the expected address with at least minSats.
 * Makes exactly ONE API call to mempool.space — no polling, no rate limit risk.
 */
export async function verifyTxPayment(
  txid: string,
  expectedAddress: string,
  minSats: number,
): Promise<{
  valid: boolean;
  confirmed: boolean;
  amountSats?: number;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/tx/${txid}`, {
    next: { revalidate: 0 },
  });

  if (res.status === 404) {
    return { valid: false, confirmed: false, error: "Transaction not found. It may not have been broadcast yet." };
  }

  if (!res.ok) {
    return { valid: false, confirmed: false, error: `Could not verify transaction (${res.status})` };
  }

  const data = await res.json();

  // Sum all outputs to the expected address
  const amountSats = (data.vout ?? [])
    .filter((v: { scriptpubkey_address?: string }) => v.scriptpubkey_address === expectedAddress)
    .reduce((sum: number, v: { value?: number }) => sum + (v.value ?? 0), 0);

  if (amountSats === 0) {
    return {
      valid: false,
      confirmed: false,
      error: "This transaction does not pay to the correct address.",
    };
  }

  if (amountSats < minSats) {
    return {
      valid: false,
      confirmed: false,
      amountSats,
      error: `Underpayment: received ${amountSats.toLocaleString()} sats, need ${minSats.toLocaleString()} sats.`,
    };
  }

  return {
    valid: true,
    confirmed: !!data.status?.confirmed,
    amountSats,
  };
}

/* ─── Helpers ────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTxList(txs: any[], address: string, confirmed: boolean): DetectedTx[] {
  const results: DetectedTx[] = [];
  for (const tx of txs) {
    const amountSats = (tx.vout ?? [])
      .filter((v: { scriptpubkey_address?: string }) => v.scriptpubkey_address === address)
      .reduce((sum: number, v: { value?: number }) => sum + (v.value ?? 0), 0);

    if (amountSats > 0) {
      results.push({
        txid: tx.txid,
        amountSats,
        confirmed: confirmed && !!tx.status?.confirmed,
        blockHeight: tx.status?.block_height ?? undefined,
        timestamp: tx.status?.block_time ?? undefined,
      });
    }
  }
  return results;
}
