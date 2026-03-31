# Architecture

FortuneSats is structured in four layers. Each layer has a clear responsibility and communicates through well-defined interfaces.

```
┌─────────────────────────────────────────────┐
│           Human Experience Layer            │
│   Next.js pages, components, animations     │
│   Ritual flow: pay → reveal → collect       │
├─────────────────────────────────────────────┤
│           Agent Interface Layer             │
│   /api/agent/* endpoints, OpenAPI spec      │
│   Structured JSON, stable IDs, filtering    │
├─────────────────────────────────────────────┤
│          Access / Payment Layer             │
│   L402 gating, rate limiting, device auth   │
│   MoneyDevKit, withAgentPayment wrapper     │
├─────────────────────────────────────────────┤
│           Shared Domain Layer               │
│   Fortunes, rarity, config, Redis state     │
│   Leaderboard, activity, collections        │
└─────────────────────────────────────────────┘
```

## Human Experience Layer

The top layer is what humans see and interact with. It prioritizes ritual, delight, and simplicity.

**Key files:**
- `src/app/page.tsx` — Homepage with 3D dragon, fortune machine, activity feed
- `src/components/fortune-machine.tsx` — The core pay-and-reveal ritual
- `src/components/fortune-pack.tsx` — On-chain 100-fortune pack purchase
- `src/app/collection/page.tsx` — Personal fortune collection
- `src/app/leaderboard/page.tsx` — Global rankings

**Principles:**
- Never expose implementation complexity to the user
- Every interaction should feel intentional and premium
- Animations and rarity reveals are part of the product, not decoration

## Agent Interface Layer

The agent layer serves machines. It returns structured, filterable, documented JSON.

**Key files:**
- `src/app/api/agent/fortune/route.ts` — Structured fortune endpoint
- `src/app/api/openapi/route.ts` — Machine-readable API spec

**Principles:**
- Responses are stable and predictable (consistent schema, stable IDs)
- Filtering is explicit (query parameters, not URL guessing)
- Errors are machine-parseable (consistent `{ error: { code, message } }` format)
- Documentation is co-located (OpenAPI served at `/api/openapi`)

## Access / Payment Layer

This layer controls who can access what and how they pay.

**Key files:**
- `src/lib/l402.ts` — L402 payment gate abstraction for agent endpoints
- `src/lib/ratelimit.ts` — Per-endpoint rate limiting (Upstash)
- `src/lib/device-id.ts` — Cookie-based device identity
- `src/lib/payment-store.ts` — Lightning payment state (Redis-backed MDK sync)
- `src/lib/config.ts` — Central config including feature flags

**Payment methods:**
- Lightning (L402 via MoneyDevKit): 100 sats per fortune, instant
- On-chain Bitcoin: 10,000 sats for a 100-fortune pack, mempool.space verification
- Agent L402 (when enabled): Same Lightning flow, machine-to-machine

**Principles:**
- Payment is value exchange, not a paywall
- L402 is opt-in and additive — the agent API works without it during development
- Rate limiting is defense-in-depth, not payment-critical

## Shared Domain Layer

The bottom layer holds business logic shared by both human and agent surfaces.

**Key files:**
- `src/lib/fortunes.ts` — Fortune pool, rarity system, enriched agent model
- `src/lib/config.ts` — Pricing, rarity weights, feature flags
- `src/lib/leaderboard.ts` — Redis sorted sets for rankings
- `src/lib/activity.ts` — Activity feed (Redis list)
- `src/lib/collection.ts` — Client-side fortune collection (localStorage)
- `src/lib/streak.ts` — Client-side streak tracking (localStorage)
- `src/lib/redis.ts` — Shared Upstash Redis singleton

**Data flow:**
```
Fortune Pool (170 items, in-memory)
    ├── getRandomFortune()        → Human API → UI
    ├── getRandomAgentFortune()   → Agent API → JSON
    ├── agentFortuneById          → Agent API (by ID lookup)
    └── getUniqueRandomFortune()  → Pack API → UI

Leaderboard (Redis sorted sets)
    ├── recordFortuneReveal()     → Called after payment verification
    └── getLeaderboard()          → Leaderboard page + API

Activity Feed (Redis list)
    ├── recordActivity()          → Called after fortune reveal
    └── getActivity()             → Homepage feed + API
```

## Tech Stack

| Concern        | Technology                              |
|---------------|----------------------------------------|
| Framework     | Next.js 16 (App Router)                |
| Hosting       | Vercel (Fluid Compute)                 |
| Database      | Upstash Redis (sorted sets, hashes, lists) |
| Lightning     | MoneyDevKit (L402/LDK)                 |
| On-chain      | mempool.space API                      |
| Styling       | Tailwind CSS v4, shadcn/ui             |
| 3D            | Three.js via React Three Fiber         |
| Analytics     | Vercel Analytics                       |

## Configuration

All runtime config lives in `src/lib/config.ts` and can be overridden via environment variables:

| Variable           | Default | Description                    |
|--------------------|---------|---------------------------------|
| `FS_FORTUNE_PRICE` | 100     | Single fortune price (sats)    |
| `FS_PACK_PRICE`    | 10000   | Pack base price (sats)         |
| `FS_PACK_SIZE`     | 100     | Fortunes per pack              |
| `FS_AGENT_API`     | true    | Enable agent API endpoints     |
| `FS_L402`          | false   | Enable L402 payment gating     |

## Future Directions

- **Vercel Flags integration**: Move feature flags to Edge Config for instant toggling
- **MCP server**: Expose fortunes as an MCP resource for AI agent ecosystems
- **Telegram bot**: Chat SDK integration for fortune delivery via Telegram
- **Deeper L402**: Full MDK integration for agent payment validation
- **Durable workflows**: Workflow DevKit for multi-step agent interactions
