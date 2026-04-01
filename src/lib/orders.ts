/**
 * Order storage for on-chain fortune packs.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set.
 * Falls back to an in-memory Map for local development
 * (state is lost on restart — only suitable for dev).
 *
 * Required env vars for production:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { randomUUID, randomBytes } from "crypto";

/* ─── Types ──────────────────────────────────────────────── */

export type OrderStatus = "pending" | "mempool" | "confirmed" | "expired";

export interface Order {
  id: string;
  /** Secret bearer token the buyer uses to access their pack */
  secret: string;
  /** Bitcoin address to pay */
  address: string;
  /** Required payment in sats */
  amountSats: number;
  /** Total fortunes in the pack */
  fortunesTotal: number;
  /** Fortunes not yet claimed */
  fortunesRemaining: number;
  /** Fortunes already revealed (to avoid duplicates) */
  claimedFortunes: string[];
  status: OrderStatus;
  /** Transaction ID once detected */
  txid?: string;
  /** Actual sats received */
  txAmountSats?: number;
  createdAt: string;
  /** When payment was first seen in mempool */
  paidAt?: string;
  /** When tx was confirmed on-chain */
  confirmedAt?: string;
  /** Order expiration (UI guidance — payments after expiry are still honored) */
  expiresAt: string;
}

/* ─── Constants ──────────────────────────────────────────── */

export const PACK_BASE_PRICE_SATS = 10_000;
export const PACK_SIZE = 100;
/** Random offset range added to base price to disambiguate concurrent orders */
const PRICE_OFFSET_MAX = 999;
/** How long an order stays "pending" before the UI shows it as expired */
const ORDER_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Redis key TTL — orders persist for 90 days */
const REDIS_TTL_SECONDS = 90 * 24 * 60 * 60;

/* ─── BTC address ────────────────────────────────────────── */

const BTC_ADDRESS =
  process.env.BTC_ADDRESS ||
  "bc1qycng4mwrwpnxnpadjqanscsmz8pxshkrjmlz60qgtfqslq9swqkq8ksm33";

/* ─── Storage backend ────────────────────────────────────── */

interface OrderStore {
  get(id: string): Promise<Order | null>;
  set(order: Order): Promise<void>;
  getOrderIdsByTxid(txid: string): Promise<string[]>;
  getPendingOrderIds(): Promise<string[]>;
  addToPending(orderId: string): Promise<void>;
  setTxidMapping(txid: string, orderId: string): Promise<void>;
}

/* ── Redis backend ── */

async function createRedisStore(): Promise<OrderStore> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return {
    async get(id) {
      return redis.get<Order>(`order:${id}`);
    },
    async set(order) {
      await redis.set(`order:${order.id}`, order, { ex: REDIS_TTL_SECONDS });
    },
    async getOrderIdsByTxid(txid) {
      const orderId = await redis.get<string>(`txid:${txid}`);
      return orderId ? [orderId] : [];
    },
    async getPendingOrderIds() {
      return (await redis.lrange("pending_orders", 0, -1)) as string[];
    },
    async addToPending(orderId) {
      await redis.rpush("pending_orders", orderId);
    },
    async setTxidMapping(txid, orderId) {
      await redis.set(`txid:${txid}`, orderId, { ex: REDIS_TTL_SECONDS });
      await redis.lrem("pending_orders", 0, orderId);
    },
  };
}

/* ── In-memory backend (dev only) ── */

function createMemoryStore(): OrderStore {
  const orders = new Map<string, Order>();
  const txidMap = new Map<string, string>();
  const pendingIds: string[] = [];

  return {
    async get(id) {
      return orders.get(id) ?? null;
    },
    async set(order) {
      orders.set(order.id, order);
    },
    async getOrderIdsByTxid(txid) {
      const id = txidMap.get(txid);
      return id ? [id] : [];
    },
    async getPendingOrderIds() {
      return [...pendingIds];
    },
    async addToPending(orderId) {
      if (!pendingIds.includes(orderId)) pendingIds.push(orderId);
    },
    async setTxidMapping(txid, orderId) {
      txidMap.set(txid, orderId);
      const idx = pendingIds.indexOf(orderId);
      if (idx >= 0) pendingIds.splice(idx, 1);
    },
  };
}

/* ── Singleton store ── */

let _store: OrderStore | null = null;

async function getStore(): Promise<OrderStore> {
  if (_store) return _store;
  if (process.env.UPSTASH_REDIS_REST_URL) {
    _store = await createRedisStore();
  } else {
    console.warn(
      "[orders] UPSTASH_REDIS_REST_URL not set — using in-memory store (dev only)",
    );
    _store = createMemoryStore();
  }
  return _store;
}

/* ─── Public API ─────────────────────────────────────────── */

export async function createOrder(): Promise<Order> {
  const store = await getStore();
  const now = new Date();

  const offset = Math.floor(Math.random() * PRICE_OFFSET_MAX) + 1;
  const order: Order = {
    id: randomUUID(),
    secret: randomBytes(24).toString("base64url"),
    address: BTC_ADDRESS,
    amountSats: PACK_BASE_PRICE_SATS + offset,
    fortunesTotal: PACK_SIZE,
    fortunesRemaining: PACK_SIZE,
    claimedFortunes: [],
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ORDER_TTL_MS).toISOString(),
  };

  await store.set(order);
  await store.addToPending(order.id);

  // Initialize atomic claim counter (used by claimFortuneAtomic)
  try {
    const { getRedis } = await import("@/lib/redis");
    const redis = getRedis();
    if (redis) {
      await redis.set(`pack:remaining:${order.id}`, PACK_SIZE, { ex: REDIS_TTL_SECONDS });
    }
  } catch (e) {
    console.error("[orders:createOrder] Failed to init claim counter:", e);
  }

  return order;
}

export async function getOrder(
  orderId: string,
  secret: string,
): Promise<Order | null> {
  const store = await getStore();
  const order = await store.get(orderId);
  if (!order || order.secret !== secret) return null;
  return order;
}

export async function getOrderUnsafe(orderId: string): Promise<Order | null> {
  const store = await getStore();
  return store.get(orderId);
}

export async function updateOrder(
  orderId: string,
  updates: Partial<Order>,
): Promise<Order | null> {
  const store = await getStore();
  const order = await store.get(orderId);
  if (!order) return null;

  const updated = { ...order, ...updates, id: order.id, secret: order.secret };
  await store.set(updated);
  return updated;
}

export async function markOrderPaid(
  orderId: string,
  txid: string,
  txAmountSats: number,
): Promise<Order | null> {
  const store = await getStore();
  const order = await store.get(orderId);
  if (!order) return null;
  // Idempotent: if already paid/confirmed, return current state without overwriting.
  // Prevents race where two concurrent requests with different txids corrupt the order.
  if (order.status !== "pending") return order;

  const updated: Order = {
    ...order,
    status: "mempool",
    txid,
    txAmountSats,
    paidAt: order.paidAt ?? new Date().toISOString(),
  };

  await store.set(updated);
  await store.setTxidMapping(txid, orderId);
  return updated;
}

export async function markOrderConfirmed(
  orderId: string,
): Promise<Order | null> {
  const store = await getStore();
  const order = await store.get(orderId);
  if (!order || (order.status !== "mempool" && order.status !== "confirmed"))
    return null;

  const updated: Order = {
    ...order,
    status: "confirmed",
    confirmedAt: order.confirmedAt ?? new Date().toISOString(),
  };

  await store.set(updated);
  return updated;
}

export async function isTxidAssigned(txid: string): Promise<boolean> {
  const store = await getStore();
  const ids = await store.getOrderIdsByTxid(txid);
  return ids.length > 0;
}

export async function getPendingOrdersList(): Promise<string[]> {
  const store = await getStore();
  return store.getPendingOrderIds();
}

export async function claimFortune(
  orderId: string,
  secret: string,
  fortune: string,
): Promise<{ success: boolean; fortunesRemaining: number; error?: string }> {
  const store = await getStore();
  const order = await store.get(orderId);

  if (!order || order.secret !== secret) {
    return { success: false, fortunesRemaining: 0, error: "Invalid order" };
  }

  if (order.status !== "mempool" && order.status !== "confirmed") {
    return {
      success: false,
      fortunesRemaining: order.fortunesRemaining,
      error: "Order not yet paid",
    };
  }

  if (order.fortunesRemaining <= 0) {
    return { success: false, fortunesRemaining: 0, error: "All fortunes claimed" };
  }

  // Atomic decrement via Redis counter (prevents race conditions on concurrent claims)
  let atomicRemaining: number | null = null;
  try {
    const { getRedis } = await import("@/lib/redis");
    const redis = getRedis();
    if (redis) {
      // Ensure counter exists (backward compat for pre-migration orders)
      await redis.set(`pack:remaining:${orderId}`, order.fortunesRemaining, { nx: true });

      atomicRemaining = await redis.decr(`pack:remaining:${orderId}`);
      if (atomicRemaining < 0) {
        // Undo: over-claimed — restore counter
        await redis.incr(`pack:remaining:${orderId}`);
        return { success: false, fortunesRemaining: 0, error: "All fortunes claimed" };
      }
    }
  } catch (e) {
    console.error("[orders:claimFortune] Atomic counter error:", e);
    // Fall through to non-atomic path
  }

  const remaining = atomicRemaining ?? order.fortunesRemaining - 1;

  const updated: Order = {
    ...order,
    fortunesRemaining: remaining,
    claimedFortunes: [...order.claimedFortunes, fortune],
  };

  await store.set(updated);
  return { success: true, fortunesRemaining: updated.fortunesRemaining };
}
