# Agent Integration Guide

FortuneSats isn't just for humans. If you're building an AI agent, a Telegram bot, a Discord integration, or anything that can make HTTP requests — you can pull fortunes programmatically.

Same fortunes, same rarity system, same 100-sat price. Just structured JSON instead of animations and confetti.

---

## Philosophy

FortuneSats is **human-first** at the experience layer and **agent-first** at the systems layer. The agent API serves the exact same fortune pool as the UI — 170 fortunes across 4 rarity tiers — but in a format machines can parse without scraping HTML.

No API key needed. No signup. Just `curl` and go.

---

## The Fortune Endpoint

### `GET /api/agent/fortune`

Pull a random fortune with full metadata.

```bash
curl https://fortunesats.com/api/agent/fortune
```

```json
{
  "fortune": {
    "id": "0a3f2k1",
    "text": "The obstacle is the way. -- Marcus Aurelius",
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

### Query Parameters

| Parameter | Type | What It Does |
|-----------|------|-------------|
| `id` | string | Fetch a specific fortune by its stable content ID |
| `category` | string | Filter by category (see table below) |
| `rarity` | string | Filter by rarity: `legendary`, `epic`, `rare`, `common` |
| `meta` | `"true"` | Include pool metadata in the response |

### Examples

```bash
# Stoic wisdom only
curl "https://fortunesats.com/api/agent/fortune?category=stoicism"

# I'm feeling lucky -- legendary or bust
curl "https://fortunesats.com/api/agent/fortune?rarity=legendary"

# Give me that exact fortune again
curl "https://fortunesats.com/api/agent/fortune?id=0a3f2k1"

# What's in the pool?
curl "https://fortunesats.com/api/agent/fortune?meta=true"
```

### Pool Metadata Response (`?meta=true`)

```json
{
  "fortune": { "..." },
  "pricing": { "..." },
  "meta": {
    "total": 170,
    "categories": {
      "stoicism": 20,
      "philosophy": 15,
      "eastern": 10,
      "sovereignty": 15,
      "growth": 50,
      "fortune": 30,
      "wit": 30
    },
    "rarities": {
      "legendary": 8,
      "epic": 18,
      "rare": 39,
      "common": 105
    }
  }
}
```

---

## Fortune Data Model

Every fortune comes with:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable content-derived ID (7-char base36 hash) -- won't change between deploys |
| `text` | string | Full fortune text, including attribution |
| `author` | string \| null | Author name, or `null` for original/anonymous quotes |
| `rarity` | string | `legendary`, `epic`, `rare`, or `common` |
| `category` | string | Content category (see below) |
| `tags` | string[] | Auto-derived content tags for filtering and context |

### Rarity Tiers

| Tier | Drop Rate | Pool Size | Vibe |
|------|-----------|-----------|------|
| Legendary | 5% | 8 | The ones you screenshot |
| Epic | 15% | 18 | Worth sharing |
| Rare | 30% | 39 | Solid pull |
| Common | 50% | 105 | Still wise, still good |

### Categories

| Category | What You'll Find |
|----------|-----------------|
| `stoicism` | Marcus Aurelius, Seneca, Epictetus |
| `philosophy` | Socrates, Plato, Aristotle, Jung, Nietzsche |
| `eastern` | Lao Tzu, Buddha, Rumi |
| `sovereignty` | Bitcoin, sound money, self-governance |
| `growth` | Self-improvement, discipline, habits |
| `fortune` | Classic fortune-cookie predictions |
| `wit` | Playful, sharp one-liners |

---

## L402: Pay-Per-Fortune for Machines

When L402 gating is active (`FS_L402=true`), agents pay sats just like humans:

1. `GET /api/agent/fortune` -- request a fortune
2. Receive `402 Payment Required` with a Lightning invoice
3. Pay the invoice (100 sats) via any Lightning wallet
4. Retry with `Authorization: L402 <macaroon>:<preimage>`
5. Receive the fortune

The `pricing.l402_enabled` field in every response tells you whether L402 is active.

Full protocol details: [L402 Documentation](./l402.md)

---

## OpenAPI Spec

Machine-readable API description for auto-discovery:

```bash
curl https://fortunesats.com/api/openapi
```

Feed this to your agent framework, API client, or MCP server to auto-generate tool definitions.

---

## Rate Limits

Be nice to the oracle.

| Endpoint | Limit |
|----------|-------|
| `/api/agent/fortune` | 30 req/min |
| `/api/fortune` | 10 req/min |
| `/api/leaderboard` | No limit (cached) |
| `/api/activity` | No limit (cached) |

---

## Error Handling

All errors return consistent JSON:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Please try again later."
  }
}
```

**Error codes:** `rate_limited`, `not_found`, `invalid_category`, `invalid_rarity`, `payment_required`, `agent_api_disabled`, `service_unavailable`

---

## Ideas for What to Build

- **AI assistants** -- Serve a daily fortune to users based on their vibe
- **Telegram / Discord / Slack bots** -- Fortune-of-the-day channels
- **Coding agents** -- Pull a wisdom quote when a build fails (you'll need it)
- **Data dashboards** -- Use `?meta=true` to visualize the fortune pool
- **MCP servers** -- Expose fortunes as tools for AI agent ecosystems
- **Daily digest apps** -- Curate fortunes by category and email them out

---

## Related Docs

- [Architecture](./architecture.md) -- How the whole system fits together
- [L402 Payment Protocol](./l402.md) -- Machine payment deep dive
- [Product Principles](./product-principles.md) -- Why things are the way they are
