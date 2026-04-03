# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Crucial

CRITICAL: Ground Answers in Code
Never answer questions about the codebase, architecture, or design without reading the actual code first.
Do not speculate, assume, or guess based on naming conventions, memory, or intuition.
Read the files. Trace execution paths. Verify behavior.
Every answer must be backed by evidence from the code itself. No exceptions.
Always ground responses in firsthand inspection:
Read relevant files
Follow the code path
Confirm actual behavior
Then respond with confidence
Reliability principle:
An answer is only valid if it is supported by code you have directly inspected.
Response Discipline
If asked: “Does X do Y?”
→ Read X before answering
If asked: “Why does Z happen?”
→ Trace the execution path before answering
If asked about design decisions
→ Inspect the implementation before explaining
Failure Rule
Being confidently wrong is worse than pausing to verify.
Default to: “Let me check the code” rather than guessing.
Code Philosophy
Research before implementation:
Use code search or documentation for unfamiliar APIs
Do not rely on assumptions
Summary Heuristic

No code read = no answer given.

## Commands

```bash
npm run dev          # Local dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests (vitest)
npx vitest run src/lib/__tests__/device-id.test.ts   # Single test file
npx vitest --watch   # Watch mode
```

## Architecture

FortuneSats is a Bitcoin fortune oracle — pay 100 sats, get a fortune. Four-layer architecture:

1. **Human Experience** (`src/app/`, `src/components/`) — Pages and UI. The fortune-pulling ritual (pay → reveal → collect) is the core product. Components use `"use client"` only when needed. The 3D dragon lives in `src/components/dragon/`.

2. **Agent Interface** (`src/app/api/agent/`) — Structured JSON API for machines. `GET /api/agent/fortune` with optional `?category=`, `?rarity=`, `?meta=true` filters. OpenAPI spec at `/api/openapi`.

3. **Access/Payment** (`src/lib/ratelimit.ts`, `src/lib/device-id.ts`) — Lightning via MoneyDevKit checkout flow (human) or L402 (agents, off by default: `FS_L402=false`), on-chain packs via mempool.space. Rate limiting uses Upstash with `ephemeralCache` to reduce Redis calls.

4. **Shared Domain** (`src/lib/`) — Fortune pool (170 fortunes, weighted rarity in `fortunes.ts`), config/pricing (`config.ts`), feature flags (`flags.ts`), Redis-backed leaderboard/activity, client-side collections/streaks in localStorage.

## Key Patterns

- **Idempotency**: All payment-triggered side effects (leaderboard writes, activity recording) use Redis `SET NX` flags (`src/lib/idempotency.ts`) to prevent duplicates in distributed serverless. Always use `recordFortuneOnce()` / `recordSatsOnce()`, never call `recordFortuneReveal()` directly from endpoints.

- **Payment flows**: Lightning fortunes use the MDK checkout flow: `useCheckout().createCheckout()` → `/checkout/[id]` (MDK `<Checkout>` component) → `/fortune/success` (verifies via `getCheckout()`, delivers fortune via `POST /api/fortune/deliver`). Free promo fortunes go directly through `GET /api/fortune`. On-chain packs: order creation at `/api/pack`, mempool polling at `/api/pack/status`, per-fortune claim at `/api/pack/fortune`.

- **Device identity**: HttpOnly cookie `fsd` (UUID), optional initials cookie `fsi` (2-4 letters, blocklist filtered). Display names: `{initials}-{hex}` or `{adjective}-{noun}-{hex}`.

- **Redis data model**: Leaderboard uses sorted sets (`lb:fortunes`, `lb:sats`, `lb:legendary`, `lb:streak`), device metadata in hashes (`lb:device:{id}`), activity in a capped list (`activity:recent`), idempotency flags with TTLs. Pipeline Redis operations — don't make multiple round trips.

- **Non-critical Redis**: Leaderboard/activity writes catch and log errors silently — they must never break the payment flow.

- **Config**: All pricing, rarity weights, and feature flags live in `src/lib/config.ts` and `src/lib/flags.ts`, overridable via environment variables.

## Tech Stack

Next.js 16 (App Router, React 19), Upstash Redis, MoneyDevKit (Lightning/L402), mempool.space (on-chain), Tailwind CSS v4 + shadcn/ui, React Three Fiber (3D), Vitest. Path alias: `@/*` → `./src/*`. Hosted on Vercel.

## Testing

Tests live in `src/lib/__tests__/`. They mock Redis via `vi.mock("@/lib/redis")` with an in-memory Map. Key test areas: idempotency (duplicate payment handling), device identity, collection storage, pack orders, payment state sync. When writing new tests, follow the existing mock Redis pattern.

## Next.js Config

`next.config.ts` wraps with MoneyDevKit's `withMdkCheckout` plugin. Security headers configured (X-Frame-Options, HSTS, etc.).
