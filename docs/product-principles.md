# Product Principles

These principles exist to keep FortuneSats honest as it grows. Features come and go, but the soul of the product should stay the same.

Read this before proposing a new feature. Read it again before shipping one.

---

## Core Identity

FortuneSats is a fortune oracle. You pay sats, you receive wisdom. The interaction is a ritual, not a transaction.

If someone asks "what does it do?" the answer should fit in one breath: *"You pay 100 sats and get a fortune."*

---

## The Five Constraints

### 1. Simplicity over features

Every screen does one thing well. If a feature requires an explanation, it's too complex. If it needs a settings page, it probably shouldn't exist.

The best new feature is often removing an existing one.

### 2. Ritual over utility

The sequence is sacred: **pay -> wait -> reveal -> react**

It should feel like cracking open a fortune cookie, not calling an API. The wait builds anticipation. The reveal creates a moment. The rarity creates a reaction. Skip any step and the magic dies.

### 3. Delight over decoration

Animations, rarity reveals, confetti, and the 3D dragon aren't there to look cool. They exist because they make the moment feel *special*. Every visual element earns its place by contributing to the emotional arc of pulling a fortune.

If an animation doesn't serve the moment, cut it. If it does, make it excellent.

### 4. Premium over busy

The app should feel premium and minimal. Think luxury vending machine, not SaaS dashboard.

No admin panels. No settings pages. No onboarding flows. No "getting started" wizards. No notification badges. The product speaks for itself.

### 5. Quiet confidence

FortuneSats doesn't need to explain itself. It doesn't need to convince you to use it. It doesn't need a landing page hero section with three bullet points and a CTA.

You show up, you pay, you get wisdom. That's the pitch and the product.

---

## The Agent Layer: Present but Invisible

The agent infrastructure should stay under the hood:

- **No agent dashboards** in the UI
- **No API documentation links** on the homepage
- **No developer controls** visible to casual users
- **No toggle switches** or config panels in the product

Humans interact with the oracle. Machines interact with the API. These two worlds don't need to see each other.

---

## Payment Philosophy

- **Value for value.** 100 sats is a real payment. It's not a demo, a loss leader, or a gamification hook. It's the price of a fortune. Fair and simple.

- **Lightning first.** Instant, global, permissionless. The payment should feel as fast as the fortune reveal.

- **L402 for machines.** When agents pay, they pay the same way: real sats for real value. No free tiers for bots, no premium tiers for enterprises. One price, one experience.

- **Never extractive.** The price should feel fair and fun. If someone feels "charged," we've failed.

---

## The Feature Litmus Test

Before adding anything, ask:

1. **Does this make the fortune moment better?** If it doesn't touch the core ritual, it better have a very good reason to exist.

2. **Does this make the app feel busier or heavier?** Every new element adds cognitive load. What are you removing to make room?

3. **Would a first-time visitor understand this without explanation?** If they need to read instructions, it's not ready.

4. **Does this serve the product or the developer?** Cool tech is not a feature. If the user can't feel it, it doesn't belong in the UI.

Fail any of these? Reconsider. Fail two or more? Kill it.

---

## What FortuneSats Is Not

- **Not a quote database.** It's an experience that happens to contain quotes.
- **Not a developer tool.** The API exists, but it's not the product.
- **Not a gamification platform.** The leaderboard and collections serve the ritual. The moment you optimize for "engagement," you've lost the plot.
- **Not a crypto project.** It's a product that uses Bitcoin as a payment rail. The tech is invisible. The wisdom is the point.

---

## Related Docs

- [Architecture](./architecture.md) -- How these principles manifest in code
- [Agent Integration Guide](./agent.md) -- The invisible-to-users API layer
- [L402 Payment Protocol](./l402.md) -- Payment philosophy in practice
