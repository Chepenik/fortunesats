# Agent Integration Guide

FortuneSats exposes a structured API layer designed for coding agents, AI systems, and automated tooling. This document explains how external agents should interact with the system.

## Philosophy

FortuneSats is human-first at the experience layer and agent-first at the systems layer. The agent API provides the same fortunes available to human users, but in a structured, stable format that machines can parse without scraping the UI.

## Agent Fortune Endpoint

### `GET /api/agent/fortune`

Returns a single fortune with full structured metadata.

#### Basic Request

```bash
curl https://fortunesats.vercel.app/api/agent/fortune
```

#### Response

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

#### Query Parameters

| Parameter  | Type   | Description                                           |
|-----------|--------|-------------------------------------------------------|
| `id`      | string | Fetch a specific fortune by its stable content ID     |
| `category`| string | Filter by category: `stoicism`, `philosophy`, `eastern`, `sovereignty`, `growth`, `fortune`, `wit` |
| `rarity`  | string | Filter by rarity: `legendary`, `epic`, `rare`, `common` |
| `meta`    | string | Set to `"true"` to include pool metadata              |

#### Examples

```bash
# Get a stoicism fortune
curl "https://fortunesats.vercel.app/api/agent/fortune?category=stoicism"

# Get a legendary fortune
curl "https://fortunesats.vercel.app/api/agent/fortune?rarity=legendary"

# Get a specific fortune by ID
curl "https://fortunesats.vercel.app/api/agent/fortune?id=0a3f2k1"

# Include pool metadata
curl "https://fortunesats.vercel.app/api/agent/fortune?meta=true"
```

#### Pool Metadata Response (with `?meta=true`)

```json
{
  "fortune": { ... },
  "pricing": { ... },
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

## Fortune Data Model

Every fortune returned by the agent API includes:

| Field      | Type            | Description                                       |
|-----------|-----------------|---------------------------------------------------|
| `id`      | string          | Stable content-derived ID (7-char base36 hash)    |
| `text`    | string          | Full fortune text, including attribution           |
| `author`  | string \| null  | Extracted author name, or null for original quotes |
| `rarity`  | string          | One of: legendary, epic, rare, common              |
| `category`| string          | Content category (stoicism, philosophy, etc.)      |
| `tags`    | string[]        | Auto-derived content tags                          |

### Rarity Distribution

| Tier      | Drop Rate | Pool Size |
|-----------|-----------|-----------|
| Legendary | 5%        | 8         |
| Epic      | 15%       | 18        |
| Rare      | 30%       | 39        |
| Common    | 50%       | 105       |

### Categories

| Category     | Description                                    |
|-------------|------------------------------------------------|
| `stoicism`  | Marcus Aurelius, Seneca, Epictetus              |
| `philosophy`| Socrates, Plato, Aristotle, Jung, Nietzsche     |
| `eastern`   | Lao Tzu, Buddha, Rumi                           |
| `sovereignty`| Bitcoin, sound money, self-governance          |
| `growth`    | Self-improvement, discipline, habits            |
| `fortune`   | Prediction-style fortune cookie wisdom          |
| `wit`       | Playful, humorous one-liners                    |

## L402 Payment (When Enabled)

When L402 gating is active, agent requests follow this flow:

1. Agent sends `GET /api/agent/fortune`
2. Server responds `402 Payment Required` with a Lightning invoice
3. Agent pays the invoice (100 sats)
4. Agent retries with `Authorization: L402 <macaroon>:<preimage>`
5. Server validates payment and returns the fortune

See [L402 documentation](./l402.md) for full protocol details.

## OpenAPI Specification

A machine-readable API description is available at:

```
GET /api/openapi
```

This can be consumed by agent frameworks, API clients, and tooling to auto-discover available endpoints.

## Rate Limits

| Endpoint             | Limit         |
|---------------------|---------------|
| `/api/agent/fortune` | 30 req/min    |
| `/api/fortune`       | 10 req/min    |
| `/api/leaderboard`   | No limit (cached) |
| `/api/activity`      | No limit (cached) |

## Error Format

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Please try again later."
  }
}
```

Error codes: `rate_limited`, `not_found`, `invalid_category`, `invalid_rarity`, `payment_required`, `agent_api_disabled`, `service_unavailable`.

## Use Cases

- **AI assistants**: Fetch a relevant fortune by category for user interactions
- **Coding agents**: Pull wisdom quotes filtered by theme during development sessions
- **Bot integrations**: Serve fortunes in Telegram, Slack, or Discord bots
- **Data analysis**: Use `?meta=true` to understand the fortune pool composition
- **MCP servers**: Build Model Context Protocol tools that access fortunes programmatically
