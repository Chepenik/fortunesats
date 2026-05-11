<p align="center">
  <img src="https://img.shields.io/badge/sats-100%20per%20fortune-orange?style=for-the-badge&logo=bitcoin" alt="100 sats per fortune" />
  <img src="https://img.shields.io/badge/fortunes-119-blueviolet?style=for-the-badge" alt="119 core fortunes" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/github/stars/Chepenik/fortunesats?style=for-the-badge" alt="GitHub Stars" />
</p>

# FortuneSats

**Pay sats. Receive wisdom.**

Request a fortune, pay 100 sats over Lightning, and reveal a piece of collectible Bitcoin wisdom. Maybe common, maybe legendary. The ritual is small, strange, and real.

It's a ritual, not a transaction.

**[Try it live](https://fortunesats.com)**

---

## What Is This?

FortuneSats is a fortune oracle built on Bitcoin. Think fortune cookies meeting the Lightning Network: 119 core fortunes across stoicism, philosophy, eastern wisdom, Bitcoin sovereignty, growth, fate, and wit, each assigned a rarity tier for collection.

### The Experience

1. Request a fortune
2. Pay 100 sats via Lightning (instant, global, no account needed)
3. Watch the reveal animation
4. Discover your fortune's rarity
5. Add it to your collection
6. Come back tomorrow to keep your streak

### The Numbers

| Rarity | Drop Rate | How It Feels |
|--------|-----------|-------------|
| **Legendary** | 8% | The oracle does not say this often |
| **Epic** | 17% | Keep this one close |
| **Rare** | 35% | Scarce signal |
| **Common** | 40% | Common does not mean disposable |

---

## Features

- **119 core fortunes** across 7 categories and 4 rarity tiers
- **Lucky prime numbers** attached to every reveal
- **Lightning payments**: 100 sats, settled in seconds
- **Bitcoin fortune packs**: 100 prepaid fortunes for 10,000 sats via Lightning or on-chain Bitcoin
- **Personal collection**: track every fortune you reveal
- **Streak system**: consecutive daily reveals
- **Global leaderboard**: ranked by fortunes revealed, sats sent, legendary count, and streaks
- **Live activity feed**: watch fortunes open in real time
- **Shareable fortune cards** with auto-generated OG images
- **3D dragon** because every oracle needs a guardian
- **Agent API** for structured fortune retrieval

---

## Run It Yourself

FortuneSats is open source. Fork it, remix it, run your own oracle.

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- An [Upstash Redis](https://upstash.com/) instance (free tier works)
- A [Strike](https://strike.me/) API key with invoice + webhook scopes (for Lightning payments)
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
| `STRIKE_API_KEY` | Strike API key (Lightning invoices + webhook management) |
| `STRIKE_API_BASE_URL` | Usually `https://api.strike.me/v1` |
| `STRIKE_WEBHOOK_SECRET` | HMAC-SHA256 secret you picked at webhook registration |
| `BTC_ADDRESS` | Your Bitcoin address (on-chain pack payments) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start revealing fortunes.

### Other Commands

```bash
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Lint the codebase
npm run test     # Run tests
```

---

## For Agents and Bots

FortuneSats has a structured API designed for AI agents, bots, and automated systems. Machines get the same fortunes humans do: structured, filterable, and documented.

### Quick Example

```bash
curl https://fortunesats.com/api/agent/fortune
```

```json
{
  "fortune": {
    "id": "0a3f2k1",
    "text": "Trusted third parties are security holes. - Nick Szabo",
    "author": "Nick Szabo",
    "rarity": "legendary",
    "category": "sovereignty",
    "luckyNumbers": [13, 233, 887],
    "tags": ["sovereignty", "attributed"]
  },
  "pricing": {
    "amount": 100,
    "currency": "SAT"
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

Full details: **[Agent Integration Guide](docs/agent.md)**

---

## Architecture

```
  +-----------------------------------------+
  |       Human Experience Layer            |  Pages, 3D dragon, animations, ritual
  +-----------------------------------------+
  |       Agent Interface Layer             |  /api/agent/*, OpenAPI spec, JSON
  +-----------------------------------------+
  |       Access / Payment Layer            |  Strike (Lightning), rate limits, device auth
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
| Lightning | [Strike](https://strike.me/) |
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

When L402 is enabled, agents pay sats for fortunes just like humans do: no accounts, no API keys, no subscriptions. Just Lightning.

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
