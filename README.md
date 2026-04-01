<p align="center">
  <img src="https://img.shields.io/badge/sats-100%20per%20fortune-orange?style=for-the-badge&logo=bitcoin" alt="100 sats per fortune" />
  <img src="https://img.shields.io/badge/fortunes-170-blueviolet?style=for-the-badge" alt="170 fortunes" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/github/stars/Chepenik/fortunesats?style=for-the-badge" alt="GitHub Stars" />
</p>

# FortuneSats

**Pay sats. Receive wisdom.**

Drop 100 sats into the machine. Pull the lever. A fortune appears — maybe common, maybe legendary. Collect them all, climb the leaderboard, keep your streak alive.

It's a ritual, not a transaction.

**[Try it live](https://fortunesats.com)**

---

## What Is This?

FortuneSats is a fortune oracle built on Bitcoin. Think fortune cookies meets the Lightning Network. 170 handpicked fortunes spanning stoicism, philosophy, eastern wisdom, Bitcoin sovereignty, growth, classic fortune-cookie vibes, and sharp wit — each assigned a rarity tier that makes every pull feel like opening a loot box (except the loot is wisdom, and you pay in sats).

### The Experience

1. Visit the app
2. Pay 100 sats via Lightning (instant, global, no account needed)
3. Watch the reveal animation
4. Discover your fortune's rarity
5. Add it to your collection
6. Come back tomorrow to keep your streak

### The Numbers

| Rarity | Drop Rate | How It Feels |
|--------|-----------|-------------|
| **Legendary** | 5% | You just found a golden ticket |
| **Epic** | 15% | Tell your friends about this one |
| **Rare** | 30% | A solid pull, respect |
| **Common** | 50% | Wisdom is wisdom, no shame |

---

## Features

- **170 curated fortunes** across 7 categories and 4 rarity tiers
- **Lightning payments** — 100 sats, settled in seconds
- **On-chain Bitcoin packs** — 100 fortunes for ~10,000 sats (for the committed)
- **Personal collection** — track every fortune you've pulled
- **Streak system** — consecutive daily pulls, don't break the chain
- **Global leaderboard** — ranked by fortunes revealed, sats spent, legendary count, and streaks
- **Live activity feed** — watch fortunes get pulled in real time
- **Shareable fortune cards** with auto-generated OG images
- **3D dragon** — because every oracle needs a guardian
- **Agent API** — machines can pull fortunes too (and pay for them)

---

## Run It Yourself

FortuneSats is open source. Fork it, remix it, run your own oracle.

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- An [Upstash Redis](https://upstash.com/) instance (free tier works)
- A [MoneyDevKit](https://moneydevkit.com/) account (for Lightning payments)
- A Bitcoin address (for on-chain pack payments)

### Setup

```bash
# Clone the repo
git clone https://github.com/Chepenik/fortunesats.git
cd fortunesats

# Install dependencies
npm install

# Copy the example env file
cp .env.example .env.local
```

### Environment Variables

Fill in your `.env.local` with the following:

| Variable | What It Does |
|----------|-------------|
| `MDK_ACCESS_TOKEN` | MoneyDevKit access token (Lightning payments) |
| `MDK_MNEMONIC` | MoneyDevKit wallet mnemonic |
| `BTC_ADDRESS` | Your Bitcoin address (on-chain pack payments) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start pulling fortunes.

### Other Commands

```bash
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Lint the codebase
npm run test     # Run tests
```

---

## For Agents and Bots

FortuneSats has a structured API designed for AI agents, bots, and automated systems. Machines get the same fortunes humans do — structured, filterable, and documented.

### Quick Example

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

### Filter It

```bash
# Only stoic wisdom
curl "https://fortunesats.com/api/agent/fortune?category=stoicism"

# Only legendary fortunes
curl "https://fortunesats.com/api/agent/fortune?rarity=legendary"

# Full pool metadata
curl "https://fortunesats.com/api/agent/fortune?meta=true"
```

### OpenAPI Spec

```bash
curl https://fortunesats.com/api/openapi
```

Full details: **[Agent Integration Guide](docs/agent.md)** | **[L402 Payment Protocol](docs/l402.md)**

---

## Architecture

```
  +-----------------------------------------+
  |       Human Experience Layer            |  Pages, 3D dragon, animations, ritual
  +-----------------------------------------+
  |       Agent Interface Layer             |  /api/agent/*, OpenAPI spec, JSON
  +-----------------------------------------+
  |       Access / Payment Layer            |  L402, rate limits, device auth
  +-----------------------------------------+
  |       Shared Domain Layer               |  Fortunes, rarity, config, Redis
  +-----------------------------------------+
```

Full breakdown: **[Architecture](docs/architecture.md)**

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Hosting | [Vercel](https://vercel.com/) |
| Database | [Upstash Redis](https://upstash.com/) |
| Lightning | [MoneyDevKit](https://moneydevkit.com/) (L402) |
| On-chain | [mempool.space](https://mempool.space/) API |
| UI | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| 3D | [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) |
| Testing | [Vitest](https://vitest.dev/) |

---

## Configuration

Tune the oracle via environment variables:

| Variable | Default | What It Does |
|----------|---------|-------------|
| `FS_FORTUNE_PRICE` | `100` | Price per fortune (sats) |
| `FS_PACK_PRICE` | `10000` | Price per 100-fortune pack (sats) |
| `FS_PACK_SIZE` | `100` | Fortunes per pack |
| `FS_AGENT_API` | `true` | Enable the agent API |
| `FS_L402` | `false` | Enable L402 payment gating for agents |

---

## L402: Machine Payments

When L402 is enabled, agents pay sats for fortunes just like humans do — no accounts, no API keys, no subscriptions. Just Lightning.

1. Agent requests a fortune
2. Server responds `402 Payment Required` with a Lightning invoice
3. Agent pays 100 sats
4. Agent retries with proof of payment
5. Fortune delivered

Currently designed but not active (`FS_L402=false`). The plumbing is ready. Full details: **[L402 Documentation](docs/l402.md)**

---

## Contributing

Contributions are welcome! Whether it's a new fortune, a bug fix, or a wild new feature idea:

1. Fork the repo
2. Create a branch (`git checkout -b my-feature`)
3. Make your changes
4. Run tests (`npm run test`)
5. Open a PR

If you're adding fortunes, check `src/lib/fortunes.ts` for the format and rarity guidelines.

---

## Docs

| Document | What's Inside |
|----------|--------------|
| [Agent Integration Guide](docs/agent.md) | How machines interact with FortuneSats |
| [Architecture](docs/architecture.md) | System layers, data flow, tech decisions |
| [Product Principles](docs/product-principles.md) | Design philosophy and guardrails |
| [L402 Payment Protocol](docs/l402.md) | Machine payment flow and integration |

---

## License

MIT -- do whatever you want with it. If you build something cool, let us know.

---

<p align="center">
  <strong>Built with sats and stubbornness.</strong><br/>
  <a href="https://fortunesats.com">fortunesats.com</a>
</p>
