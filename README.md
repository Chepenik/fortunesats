# FortuneSats

Pay sats. Receive wisdom. 170 fortunes across 4 rarity tiers, delivered through Lightning and on-chain Bitcoin.

## What It Is

FortuneSats is a fortune oracle built on Bitcoin. Drop 100 sats, pull a fortune. Some are common, some are legendary. Collect them, track your streak, climb the leaderboard.

The experience is intentional: pay, wait, reveal, react. It's a ritual, not a transaction.

**Live:** [fortunesats.vercel.app](https://fortunesats.vercel.app)

## Product Philosophy

- **Human-first at the experience layer.** The UI is a premium, playful ritual. No dashboards, no settings pages, no developer controls visible to users.
- **Agent-first at the systems layer.** Structured APIs, stable identifiers, machine-readable specs. External AI systems and coding agents can interact cleanly.
- **Native monetization at the access layer.** Agent endpoints are designed for L402 payment gating — machines pay sats for access, just like humans do.

## Quick Start

```bash
git clone https://github.com/your-repo/fortunesats.git
cd fortunesats
npm install
cp .env.example .env.local
# Fill in MDK_ACCESS_TOKEN, MDK_MNEMONIC, BTC_ADDRESS, UPSTASH_REDIS_* vars
npm run dev
```

## For Humans

Visit the app. Pay 100 sats via Lightning. Receive a fortune. That's it.

**Features:**
- 170 curated fortunes across 4 rarity tiers (Legendary 5%, Epic 15%, Rare 30%, Common 50%)
- Lightning payments (100 sats per fortune)
- On-chain Bitcoin packs (100 fortunes for ~10,000 sats)
- Personal collection tracking
- Streak system (consecutive daily pulls)
- Global leaderboard (fortunes revealed, sats spent, legendary count, streaks)
- Live activity feed
- Shareable fortune cards with OG images

## For Agents

FortuneSats exposes a structured API layer for coding agents, AI systems, bots, and automated tooling.

### Get a Fortune

```bash
curl https://fortunesats.vercel.app/api/agent/fortune
```

```json
{
  "fortune": {
    "id": "0a3f2k1",
    "text": "The obstacle is the way. — Marcus Aurelius",
    "author": "Marcus Aurelius",
    "rarity": "legendary",
    "category": "stoicism",
    "tags": ["stoicism", "attributed", "strength"]
  },
  "pricing": {
    "amount": 100,
    "currency": "SAT",
    "l402_enabled": false
  }
}
```

### Filter by Category or Rarity

```bash
# Stoic wisdom
curl "https://fortunesats.vercel.app/api/agent/fortune?category=stoicism"

# Only legendary fortunes
curl "https://fortunesats.vercel.app/api/agent/fortune?rarity=legendary"

# Pool metadata
curl "https://fortunesats.vercel.app/api/agent/fortune?meta=true"
```

### OpenAPI Spec

```bash
curl https://fortunesats.vercel.app/api/openapi
```

Full agent integration guide: [docs/agent.md](docs/agent.md)

## L402 and Machine Payments

When L402 is enabled, agent endpoints require Lightning payment:

1. Agent requests `GET /api/agent/fortune`
2. Server responds `402` with a Lightning invoice
3. Agent pays the invoice (100 sats)
4. Agent retries with `Authorization: L402 <macaroon>:<preimage>`
5. Server validates and returns the fortune

L402 is currently designed but not active (`FS_L402=false`). The abstraction layer is in place and ready to wire into MoneyDevKit when needed.

Full L402 documentation: [docs/l402.md](docs/l402.md)

## Architecture

```
┌──────────────────────────────────┐
│     Human Experience Layer       │  Pages, components, animations
├──────────────────────────────────┤
│     Agent Interface Layer        │  /api/agent/*, OpenAPI spec
├──────────────────────────────────┤
│     Access / Payment Layer       │  L402, rate limits, device auth
├──────────────────────────────────┤
│     Shared Domain Layer          │  Fortunes, rarity, config, Redis
└──────────────────────────────────┘
```

Full architecture documentation: [docs/architecture.md](docs/architecture.md)

## Configuration

Environment variable overrides for runtime config:

| Variable           | Default | Description                    |
|--------------------|---------|---------------------------------|
| `FS_FORTUNE_PRICE` | 100     | Single fortune price (sats)    |
| `FS_PACK_PRICE`    | 10000   | Pack base price (sats)         |
| `FS_PACK_SIZE`     | 100     | Fortunes per pack              |
| `FS_AGENT_API`     | true    | Enable agent API               |
| `FS_L402`          | false   | Enable L402 payment gating     |

## Tech Stack

| Concern        | Technology                     |
|---------------|--------------------------------|
| Framework     | Next.js 16 (App Router)        |
| Hosting       | Vercel                         |
| Database      | Upstash Redis                  |
| Lightning     | MoneyDevKit (L402)             |
| On-chain      | mempool.space API              |
| UI            | Tailwind CSS v4, shadcn/ui     |
| 3D            | React Three Fiber              |

## Documentation

- [Agent Integration Guide](docs/agent.md) — How agents interact with FortuneSats
- [Architecture](docs/architecture.md) — System layer diagram and data flow
- [Product Principles](docs/product-principles.md) — Human-centric design constraints
- [L402 Payment Protocol](docs/l402.md) — Machine payment flow and integration
