/**
 * Strike API client + Redis persistence + webhook verification.
 *
 * Invariants (do not relax):
 *  - Every Strike HTTP call is wrapped in a 10s timeout.
 *  - Webhook signatures are verified with constant-time HMAC-SHA256 over the
 *    raw JSON body (hex-encoded, header `x-webhook-signature`).
 *  - BTC amounts are passed as decimal strings with exactly 8 fractional
 *    digits — never floats.
 *  - Never log BOLT11, quote IDs, or full webhook payloads at info level.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getRedis } from "@/lib/redis";

/* ─── Types ──────────────────────────────────────────────── */

export type StrikeInvoiceState = "UNPAID" | "PENDING" | "PAID" | "CANCELLED";

export interface StrikeAmount {
  amount: string;
  currency: "BTC" | "USD" | "USDT" | "EUR" | "GBP";
}

export interface StrikeInvoice {
  invoiceId: string;
  correlationId?: string;
  description?: string;
  amount: StrikeAmount;
  state: StrikeInvoiceState;
  created: string;
  issuerId?: string;
  receiverId?: string;
}

export interface StrikeQuote {
  quoteId: string;
  description?: string;
  lnInvoice: string;
  onchainAddress?: string;
  expiration: string;
  expirationInSec: number;
  targetAmount?: StrikeAmount;
  sourceAmount: StrikeAmount;
}

export interface StrikeWebhookPayload {
  id: string;
  eventType: string;
  webhookVersion: string;
  data: { entityId: string; changes?: string[] };
  created: string;
  deliverySuccess?: boolean;
}

export type PurchaseType = "fortune" | "gift" | "fortune-pack";

export interface StrikeCheckoutRecord {
  invoiceId: string;
  correlationId: string;
  purchaseType: PurchaseType;
  amountSats: number;
  amountBtc: string;
  description: string;
  state: StrikeInvoiceState;
  latestQuoteId?: string;
  latestLnInvoice?: string;
  quoteExpiresAt?: number;
  createdAt: number;
  lastSyncedAt: number;
  paidAt?: number;
  /** Where the checkout client should redirect once state transitions to PAID. */
  successPath?: string;
  /** Set for purchaseType==="fortune-pack" so the webhook can mark the pack order paid. */
  orderId?: string;
}

/* ─── Config ─────────────────────────────────────────────── */

const STRIKE_TIMEOUT_MS = 10_000;
const RECORD_TTL_SEC = 30 * 24 * 60 * 60;
const WEBHOOK_DEDUPE_TTL_SEC = 14 * 24 * 60 * 60;
const QUOTE_LOCK_TTL_SEC = 10;

function strikeBaseUrl(): string {
  return process.env.STRIKE_API_BASE_URL?.replace(/\/+$/, "") ?? "https://api.strike.me/v1";
}

function strikeApiKey(): string {
  const key = process.env.STRIKE_API_KEY;
  if (!key) throw new Error("STRIKE_API_KEY is not set");
  return key;
}

/* ─── Sats ↔ BTC (integer-only, no floats) ───────────────── */

export function satsToBtcAmount(sats: number): string {
  if (!Number.isInteger(sats) || sats < 0) {
    throw new Error(`Invalid sats: ${sats}`);
  }
  const whole = Math.floor(sats / 100_000_000);
  const fraction = sats % 100_000_000;
  return `${whole}.${fraction.toString().padStart(8, "0")}`;
}

export function btcAmountToSats(amount: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(amount)) return null;
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > 8) return null;
  const w = Number(whole);
  const f = Number(frac.padEnd(8, "0"));
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(f)) return null;
  const total = w * 100_000_000 + f;
  return Number.isSafeInteger(total) ? total : null;
}

/* ─── Correlation IDs ────────────────────────────────────── */

export function makeCorrelationId(): string {
  const id = `fortunesats-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
  return id.slice(0, 40);
}

/* ─── Webhook signature verification ─────────────────────── */

export function verifyStrikeWebhookSignature(
  body: unknown,
  signature: string | null,
  secret: string | undefined = process.env.STRIKE_WEBHOOK_SECRET,
): boolean {
  if (!signature || !secret) return false;
  const content = JSON.stringify(body);
  const expected = createHmac("sha256", secret).update(content).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ─── HTTP client with 10s timeout ───────────────────────── */

async function strikeFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STRIKE_TIMEOUT_MS);

  try {
    const res = await fetch(`${strikeBaseUrl()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${strikeApiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Strike ${init.method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new Error(`Strike ${init.method} ${path} timed out after ${STRIKE_TIMEOUT_MS}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Strike endpoints ───────────────────────────────────── */

export interface CreateInvoiceInput {
  correlationId: string;
  description: string;
  amountSats: number;
}

export async function createStrikeInvoice(input: CreateInvoiceInput): Promise<StrikeInvoice> {
  return strikeFetch<StrikeInvoice>("/invoices", {
    method: "POST",
    body: {
      correlationId: input.correlationId,
      description: input.description,
      amount: { amount: satsToBtcAmount(input.amountSats), currency: "BTC" },
    },
  });
}

export async function createStrikeQuote(invoiceId: string): Promise<StrikeQuote> {
  return strikeFetch<StrikeQuote>(`/invoices/${encodeURIComponent(invoiceId)}/quote`, {
    method: "POST",
    body: {},
  });
}

export async function getStrikeInvoice(invoiceId: string): Promise<StrikeInvoice> {
  return strikeFetch<StrikeInvoice>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "GET",
  });
}

/* ─── Redis persistence ──────────────────────────────────── */

function recordKey(invoiceId: string): string {
  return `strike-invoice:${invoiceId}`;
}

function webhookEventKey(eventId: string): string {
  return `strike-webhook-event:${eventId}`;
}

function quoteLockKey(invoiceId: string): string {
  return `strike-quote-lock:${invoiceId}`;
}

export async function saveCheckoutRecord(record: StrikeCheckoutRecord): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(recordKey(record.invoiceId), record, { ex: RECORD_TTL_SEC });
}

export async function getCheckoutRecord(invoiceId: string): Promise<StrikeCheckoutRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<StrikeCheckoutRecord>(recordKey(invoiceId))) ?? null;
}

/**
 * Mark a webhook event as seen using SET NX. Returns true if we are the
 * first handler (and therefore should process the event).
 */
export async function claimWebhookEvent(eventId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const acquired = await redis.set(webhookEventKey(eventId), Date.now(), {
    nx: true,
    ex: WEBHOOK_DEDUPE_TTL_SEC,
  });
  return acquired !== null;
}

/**
 * Acquire a 10s NX lock around quote refresh so concurrent pollers don't
 * burn multiple quotes for the same invoice.
 */
export async function acquireQuoteLock(invoiceId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const acquired = await redis.set(quoteLockKey(invoiceId), Date.now(), {
    nx: true,
    ex: QUOTE_LOCK_TTL_SEC,
  });
  return acquired !== null;
}

/* ─── State reconciliation ───────────────────────────────── */

/**
 * Fold a Strike invoice response into the existing checkout record.
 * Sets `paidAt` on the UNPAID→PAID transition and updates `state` + sync ts.
 */
export function applyInvoiceToRecord(
  record: StrikeCheckoutRecord,
  invoice: StrikeInvoice,
  now: number = Date.now(),
): StrikeCheckoutRecord {
  const next: StrikeCheckoutRecord = {
    ...record,
    state: invoice.state,
    lastSyncedAt: now,
  };
  if (invoice.state === "PAID" && record.state !== "PAID" && !record.paidAt) {
    next.paidAt = now;
  }
  return next;
}

/**
 * Attach a new quote to the record (only meaningful while UNPAID).
 */
export function applyQuoteToRecord(
  record: StrikeCheckoutRecord,
  quote: StrikeQuote,
  now: number = Date.now(),
): StrikeCheckoutRecord {
  return {
    ...record,
    latestQuoteId: quote.quoteId,
    latestLnInvoice: quote.lnInvoice,
    quoteExpiresAt: Math.floor(new Date(quote.expiration).getTime() / 1000),
    lastSyncedAt: now,
  };
}
