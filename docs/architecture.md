# Architecture

FortuneSats is a four-layer cake. Each layer has one job and talks to the others through clean interfaces. No spaghetti, no surprises.

```
  +-----------------------------------------+
  |       Human Experience Layer            |  Next.js pages, 3D dragon, animations
  |       "Make it feel like magic"         |  Ritual: pay -> reveal -> collect
  +-----------------------------------------+
  |       Agent Interface Layer             |  /api/agent/* endpoints, OpenAPI
  |       "Make it parseable"               |  Structured JSON, stable IDs, filters
  +-----------------------------------------+
  |       Access / Payment Layer            |  Strike (Lightning), rate limits, device auth
  |       "Make them pay (fairly)"          |  /api/checkout, /api/strike/webhook
  +-----------------------------------------+
  |       Shared Domain Layer               |  Fortunes, rarity, config, Redis state
  |       "The source of truth"             |  Leaderboard, activity, collections
  +-----------------------------------------+
```

---

## Human Experience Layer

This is what people see. It's designed to feel like a premium ritual, not a web app.

**Key files:**
- `src/app/page.tsx` -- Homepage with 3D dragon, fortune machine, activity feed
- `src/components/fortune-machine.tsx` -- The core pay-and-reveal experience
- `src/components/fortune-pack.tsx` -- On-chain 100-fortune pack purchase
- `src/app/collection/page.tsx` -- Personal fortune collection
- `src/app/leaderboard/page.tsx` -- Global rankings

**Rules of this layer:**
- Never expose implementation complexity to the user
- Every interaction should feel intentional and premium
- Animations and rarity reveals are the product, not decoration
- If it needs explanation, it's too complex

---

## Agent Interface Layer

This layer serves machines. Structured, filterable, documented JSON.

**Key files:**
- `src/app/api/agent/fortune/route.ts` -- Structured fortune endpoint with filtering
- `src/app/api/openapi/route.ts` -- Machine-readable API specification

**Rules of this layer:**
- Responses are stable and predictable (consistent schema, stable IDs)
- Filtering is explicit (query parameters, not URL guessing)
- Errors are machine-parseable (`{ error: { code, message } }`)
- Documentation lives next to the code (OpenAPI at `/api/openapi`)

---

## Access / Payment Layer

This layer decides who gets in and how they pay.

**Key files:**
- `src/lib/strike.ts` -- Strike API client, HMAC webhook verification, Redis record helpers
- `src/app/api/checkout/route.ts` -- Creates Strike invoices for fortunes and gifts
- `src/app/api/strike/webhook/route.ts` -- Receives `invoice.updated` events
- `src/lib/agent-payment.ts` -- Pass-through wrapper (agent API is currently free)
- `src/lib/ratelimit.ts` -- Per-endpoint rate limiting (Upstash)
- `src/lib/device-id.ts` -- Cookie-based device identity
- `src/lib/config.ts` -- Central config including feature flags

**Payment methods:**

| Method | Who | Price | Speed |
|--------|-----|-------|-------|
| Lightning (Strike) | Humans | 100 sats/fortune, 200 sats/gift | Instant |
| Lightning (Strike) | Humans | 10,000 sats/pack | Instant |
| On-chain Bitcoin | Humans | ~10,000 sats/pack | ~10 min confirmation |
| Agent API | Machines | Free | Instant |

**Rules of this layer:**
- Payment is value exchange, not a paywall
- The Strike webhook is authoritative but optional — client polling against `getStrikeInvoice` provides the same guarantee if the webhook is unregistered
- Rate limiting is defense-in-depth, not revenue protection

---

## Shared Domain Layer

The foundation. Business logic that both humans and agents share.

**Key files:**
- `src/lib/fortunes.ts` -- Fortune pool (170 items), rarity system, enriched agent model
- `src/lib/config.ts` -- Pricing, rarity weights, feature flags
- `src/lib/leaderboard.ts` -- Redis sorted sets for global rankings
- `src/lib/activity.ts` -- Activity feed (Redis list)
- `src/lib/collection.ts` -- Client-side fortune collection (localStorage)
- `src/lib/streak.ts` -- Client-side streak tracking (localStorage)
- `src/lib/redis.ts` -- Shared Upstash Redis singleton

**Data flow:**
```
Fortune Pool (170 items, in-memory)
    |-- getRandomFortune()        -> Human API -> UI
    |-- getRandomAgentFortune()   -> Agent API -> JSON
    |-- agentFortuneById          -> Agent API (by ID lookup)
    +-- getUniqueRandomFortune()  -> Pack API -> UI

Leaderboard (Redis sorted sets)
    |-- recordFortuneReveal()     -> Called after payment verification
    +-- getLeaderboard()          -> Leaderboard page + API

Activity Feed (Redis list)
    |-- recordActivity()          -> Called after fortune reveal
    +-- getActivity()             -> Homepage feed + API
```

---

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Framework | Next.js 16 (App Router) | Server Components, streaming, edge-ready |
| Hosting | Vercel (Fluid Compute) | Zero-config deploys, global edge |
| Database | Upstash Redis | Sorted sets, hashes, lists -- perfect for leaderboards |
| Lightning | Strike API | Custodial Lightning with clean webhook semantics |
| On-chain | mempool.space API | Real-time transaction verification |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first + accessible components |
| 3D | Three.js via React Three Fiber | Declarative 3D for the dragon guardian |
| Analytics | Vercel Analytics | Privacy-friendly, zero-config |
| Testing | Vitest | Fast, modern, ESM-native |

---

## Configuration

All runtime config lives in `src/lib/config.ts` with environment variable overrides:

| Variable | Default | What It Controls |
|----------|---------|-----------------|
| `FS_FORTUNE_PRICE` | `100` | Single fortune price (sats) |
| `FS_PACK_PRICE` | `10000` | Pack base price (sats) |
| `FS_PACK_SIZE` | `100` | Fortunes per pack |
| `FS_AGENT_API` | `true` | Enable agent API endpoints |

---

## Future Directions

Some things we'd love to build (PRs welcome):

- **MCP server** -- Expose fortunes as an MCP resource for AI agent ecosystems
- **Telegram bot** -- Chat SDK integration for fortune delivery via Telegram
- **Edge Config feature flags** -- Move flags to Vercel Edge Config for instant toggling
- **Agent billing** -- Wire paid Strike invoices into the agent API when demand warrants
- **Durable workflows** -- Workflow DevKit for multi-step agent interactions
- **Fortune submissions** -- Let the community contribute wisdom

---

## Related Docs

- [Agent Integration Guide](./agent.md) -- API reference for machines
- [Product Principles](./product-principles.md) -- Design guardrails
