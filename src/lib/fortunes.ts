/* ─── Rarity system ─────────────────────────────────────── */

export type Rarity = "legendary" | "epic" | "rare" | "common";

export interface Fortune {
  text: string;
  rarity: Rarity;
}

export interface FortuneReveal extends Fortune {
  luckyNumbers: number[];
}

const oracle = (text: string) => `${text} - FortuneSats Oracle`;
const inspired = (text: string, source: string) => `${text} - Inspired by ${source}`;

export const RARITY_CONFIG = {
  legendary: {
    label: "Legendary",
    revealCopy: "Legendary signal. The oracle does not say this often.",
    color: "#d4a257",
    glowColor: "rgba(212, 162, 87, 0.4)",
    borderClass: "rarity-legendary",
    badgeClass: "bg-gold/15 border-gold/30 text-gold",
  },
  epic: {
    label: "Epic",
    revealCopy: "Epic signal. Keep this one close.",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.3)",
    borderClass: "rarity-epic",
    badgeClass: "bg-purple-500/10 border-purple-500/25 text-purple-400",
  },
  rare: {
    label: "Rare",
    revealCopy: "Rare signal. Scarcity answered.",
    color: "#60a5fa",
    glowColor: "rgba(96, 165, 250, 0.25)",
    borderClass: "rarity-rare",
    badgeClass: "bg-blue-400/10 border-blue-400/20 text-blue-400",
  },
  common: {
    label: "Common",
    revealCopy: "Signal found. Common does not mean disposable.",
    color: "#a8a29e",
    glowColor: "rgba(168, 162, 158, 0.1)",
    borderClass: "rarity-common",
    badgeClass: "bg-stone-400/10 border-stone-400/15 text-stone-400",
  },
} as const;

/* ─── Fortune pool ──────────────────────────────────────── */

/*
 * Source notes for newly verified attributed entries:
 * - Satoshi Nakamoto, Bitcoin P2P e-cash paper, 2008:
 *   https://satoshi.nakamotoinstitute.org/emails/cryptography/1/
 * - Satoshi Nakamoto, P2P Foundation post, 2009:
 *   https://satoshi.nakamotoinstitute.org/quotes/economics/
 * - Satoshi Nakamoto, BitcoinTalk scalability reply, 2010:
 *   https://satoshi.nakamotoinstitute.org/posts/bitcointalk/287/
 * - Nick Szabo, Trusted Third Parties are Security Holes, 2001:
 *   https://nakamotoinstitute.org/library/trusted-third-parties/
 * - Frederic Bastiat, The State, 1848:
 *   https://oll.libertyfund.org/quotes/frederic-bastiat-on-the-state-as-the-great-fiction-by-which-everyone-seeks-to-live-at-the-expense-of-everyone-else-1848
 */
export const fortunes: Fortune[] = [
  // ─── LEGENDARY (most profound, iconic) ───────────────────
  { text: "The root problem with conventional currency is all the trust that's required to make it work. - Satoshi Nakamoto", rarity: "legendary" },
  { text: "I've been working on a new electronic cash system that's fully peer-to-peer, with no trusted third party. - Satoshi Nakamoto", rarity: "legendary" },
  { text: "Trusted third parties are security holes. - Nick Szabo", rarity: "legendary" },
  { text: "If you don't believe me or don't get it, I don't have time to try to convince you, sorry. - Satoshi Nakamoto", rarity: "legendary" },
  { text: inspired("The first proof of wisdom is knowing what you do not know.", "Socrates"), rarity: "legendary" },
  { text: inspired("Fear spends tomorrow before it arrives.", "Seneca"), rarity: "legendary" },
  { text: oracle("Proof-of-work is truth without permission."), rarity: "legendary" },
  { text: inspired("Fortune favors the one already moving.", "Virgil"), rarity: "legendary" },

  // ─── EPIC (strong philosophical) ─────────────────────────
  { text: "The state is the great fictitious entity by which everyone seeks to live at the expense of everyone else. - Frederic Bastiat", rarity: "epic" },
  { text: "No mint or other trusted parties. - Satoshi Nakamoto", rarity: "epic" },
  { text: inspired("A strong why can carry a hard how.", "Friedrich Nietzsche"), rarity: "epic" },
  { text: inspired("An unexamined life leaks signal.", "Socrates"), rarity: "epic" },
  { text: inspired("Release the false self before it spends your life.", "Lao Tzu"), rarity: "epic" },
  { text: inspired("To live deliberately is rarer than noise admits.", "Oscar Wilde"), rarity: "epic" },
  { text: inspired("The obstacle becomes material for the work.", "Marcus Aurelius"), rarity: "epic" },
  { text: oracle("Low time preference builds cathedrals."), rarity: "epic" },
  { text: oracle("Self-custody begins in the mind."), rarity: "epic" },
  { text: oracle("Truth does not need a marketing budget."), rarity: "epic" },
  { text: oracle("The highest signal is often quiet."), rarity: "epic" },
  { text: oracle("Consensus begins with the courage to verify."), rarity: "epic" },
  { text: oracle("A sovereign life is built one refusal at a time."), rarity: "epic" },
  { text: oracle("Scarcity gives patience a place to live."), rarity: "epic" },
  { text: oracle("Your proof-of-work is the person you become."), rarity: "epic" },
  { text: oracle("The longer road may be the low time preference road."), rarity: "epic" },
  { text: oracle("Sound money asks you to mean what you do."), rarity: "epic" },
  { text: oracle("Wisdom compounds when ego stops spending it."), rarity: "epic" },

  // ─── RARE (solid wisdom) ─────────────────────────────────
  { text: inspired("The mind takes the color of its repeated thoughts.", "Marcus Aurelius"), rarity: "rare" },
  { text: inspired("Live today as if it were a complete block.", "Seneca"), rarity: "rare" },
  { text: inspired("Abundance is not possession. It is enoughness.", "Epicurus"), rarity: "rare" },
  { text: inspired("Nature does not hurry. It still clears every block.", "Lao Tzu"), rarity: "rare" },
  { text: inspired("The long road starts with one honest step.", "Lao Tzu"), rarity: "rare" },
  { text: inspired("Self-command is the deepest form of power.", "Lao Tzu"), rarity: "rare" },
  { text: inspired("A disciplined mind is a quiet treasury.", "Buddha"), rarity: "rare" },
  { text: inspired("While you wait to live, time confirms another block.", "Seneca"), rarity: "rare" },
  { text: inspired("The stars are reached by the difficult path.", "Seneca"), rarity: "rare" },
  { text: oracle("Fix the money, fix the incentives."), rarity: "rare" },
  { text: oracle("Savings are stored time."), rarity: "rare" },
  { text: oracle("Sound money makes honest plans possible."), rarity: "rare" },
  { text: oracle("Freedom compounds."), rarity: "rare" },
  { text: oracle("The signal is there for those willing to tune in."), rarity: "rare" },
  { text: oracle("Build quietly. Let the world notice later."), rarity: "rare" },
  { text: oracle("A sovereign mind is hard to manipulate."), rarity: "rare" },
  { text: oracle("Every sat tells a story."), rarity: "rare" },
  { text: oracle("Value for value. It is that simple."), rarity: "rare" },
  { text: oracle("Pain can teach when ego stops interrupting."), rarity: "rare" },
  { text: oracle("The future belongs to those who can delay gratification."), rarity: "rare" },
  { text: oracle("A person who can govern himself needs fewer rulers."), rarity: "rare" },
  { text: oracle("Conviction is forged when comfort is removed."), rarity: "rare" },
  { text: oracle("The quality of your life hides inside your habits."), rarity: "rare" },
  { text: oracle("Endurance is intelligence under pressure."), rarity: "rare" },
  { text: oracle("What is measured improves. What is cherished endures."), rarity: "rare" },
  { text: oracle("Freedom starts with self-command."), rarity: "rare" },
  { text: oracle("Aim at truth, even when it costs."), rarity: "rare" },
  { text: oracle("Reputation arrives in drops and leaves in buckets."), rarity: "rare" },
  { text: oracle("The thing worth building usually takes longer than hoped."), rarity: "rare" },
  { text: oracle("Stillness is where the oracle gets loud."), rarity: "rare" },
  { text: oracle("What you lost may return as signal."), rarity: "rare" },
  { text: oracle("A closed door may be waiting for proof-of-work."), rarity: "rare" },
  { text: oracle("The path appears after you stop demanding the map."), rarity: "rare" },
  { text: oracle("You are closer than you think. One more block."), rarity: "rare" },
  { text: oracle("Verify before you trust the voice."), rarity: "rare" },
  { text: oracle("A scarce thing teaches patience."), rarity: "rare" },
  { text: oracle("Keys are held by hand. Sovereignty is held by habit."), rarity: "rare" },
  { text: oracle("The mempool teaches patience without asking permission."), rarity: "rare" },

  // ─── COMMON (sharp one-liners & lighter quotes) ──────────
  { text: oracle("Hard choices now. Easier blocks later."), rarity: "common" },
  { text: oracle("Depth beats noise."), rarity: "common" },
  { text: oracle("Calm is portable wealth."), rarity: "common" },
  { text: oracle("Pressure reveals the custody model."), rarity: "common" },
  { text: oracle("Small hinges move heavy doors."), rarity: "common" },
  { text: oracle("Clarity creates momentum."), rarity: "common" },
  { text: oracle("What you tolerate becomes your policy."), rarity: "common" },
  { text: oracle("What you feed grows."), rarity: "common" },
  { text: oracle("A clear no protects a meaningful yes."), rarity: "common" },
  { text: oracle("The quiet work matters most."), rarity: "common" },
  { text: oracle("Most people quit before the compounding starts."), rarity: "common" },
  { text: oracle("Real strength stays calm under pressure."), rarity: "common" },
  { text: oracle("The seed does its work in darkness."), rarity: "common" },
  { text: oracle("Every master began as a blank wallet."), rarity: "common" },
  { text: oracle("Strong convictions, loosely held."), rarity: "common" },
  { text: oracle("Keep your word, especially to yourself."), rarity: "common" },
  { text: oracle("The wise build before they broadcast."), rarity: "common" },
  { text: oracle("Most walls are doors with better security."), rarity: "common" },
  { text: oracle("Discomfort is tuition for sovereignty."), rarity: "common" },
  { text: oracle("You become credible by keeping private promises."), rarity: "common" },
  { text: oracle("The right path is rarely the crowded mempool."), rarity: "common" },
  { text: oracle("Small progress, repeated daily, becomes a new life."), rarity: "common" },
  { text: oracle("If the signal fails, refine the receiver."), rarity: "common" },
  { text: oracle("This fortune cost 100 sats. The lesson may outlive the invoice."), rarity: "common" },
  { text: oracle("A useful surprise is moving in your direction."), rarity: "common" },
  { text: oracle("The next stranger may carry signal."), rarity: "common" },
  { text: oracle("Tonight's dream may be your mind reindexing truth."), rarity: "common" },
  { text: oracle("An old friend may still hold a new lesson."), rarity: "common" },
  { text: oracle("A forgotten kindness is still compounding."), rarity: "common" },
  { text: oracle("An ending may only be a turn in the route."), rarity: "common" },
  { text: oracle("Something important is arriving. Clear the mempool."), rarity: "common" },
  { text: oracle("Trust the detour after you verify the terrain."), rarity: "common" },
  { text: oracle("Patience pays interest in strange units."), rarity: "common" },
  { text: oracle("The postponed decision is asking for a signature."), rarity: "common" },
  { text: oracle("The right people are already routing toward you."), rarity: "common" },
  { text: oracle("Stack patience before opinions."), rarity: "common" },
  { text: oracle("Noise spends fast. Signal saves."), rarity: "common" },
  { text: oracle("Keep your keys and your counsel close."), rarity: "common" },
  { text: oracle("A small sat can still carry intention."), rarity: "common" },
  { text: oracle("The next block is found by doing the work."), rarity: "common" },
  { text: oracle("Your wallet should not know your excuses."), rarity: "common" },
  { text: oracle("Scarcity makes every yes more honest."), rarity: "common" },
  { text: oracle("A good ritual does not beg for attention."), rarity: "common" },
  { text: oracle("The oracle shows signal, not shortcuts."), rarity: "common" },
  { text: oracle("Sovereignty starts as a private decision."), rarity: "common" },
  { text: oracle("Low-preference days become sovereign years."), rarity: "common" },
  { text: oracle("Spend slowly. Learn quickly."), rarity: "common" },
  { text: oracle("A quiet stack is still a stack."), rarity: "common" },
  { text: oracle("The best receipt is the lesson you keep."), rarity: "common" },
  { text: oracle("Do the work before asking for luck."), rarity: "common" },
  { text: oracle("The fee is small. The signal is yours."), rarity: "common" },
  { text: oracle("Truth travels light."), rarity: "common" },
  { text: oracle("Some doors open only after proof-of-work."), rarity: "common" },
  { text: oracle("Make your future self easier to trust."), rarity: "common" },
  { text: oracle("The code works. Ship it before it changes its mind."), rarity: "common" },
];

/* ─── Seasonal bonus pool ───────────────────────────────── */

/**
 * Seasonal fortunes are mixed into the main pool when the
 * SEASONAL_POOL_ENABLED flag is true. Edit this array to rotate
 * seasonal content without touching the core fortune pool.
 */
export const seasonalFortunes: Fortune[] = [
  { text: oracle("Spring cleans more than houses. Let an old key turn."), rarity: "rare" },
  { text: oracle("The equinox reminds us: balance is motion under discipline."), rarity: "epic" },
  { text: oracle("Plant now. The harvest keeps its own chain."), rarity: "common" },
  { text: oracle("A season of building begins. Sign the first block."), rarity: "common" },
  { text: oracle("Even the sun takes turns. Rest is not retreat."), rarity: "rare" },
];

export const FORTUNE_POOL_TOTAL = fortunes.length;

export const FORTUNE_POOL_TOTALS = {
  legendary: fortunes.filter((f) => f.rarity === "legendary").length,
  epic: fortunes.filter((f) => f.rarity === "epic").length,
  rare: fortunes.filter((f) => f.rarity === "rare").length,
  common: fortunes.filter((f) => f.rarity === "common").length,
} satisfies Record<Rarity, number>;

export const BASE_RARITY_WEIGHTS = {
  legendary: 0.08,
  epic: 0.17,
  rare: 0.35,
  common: 0.40,
} satisfies Record<Rarity, number>;

export const LUCKY_PRIME_MIN = 2;
export const LUCKY_PRIME_MAX = 997;
export const LUCKY_PRIME_COUNT_MIN = 3;
export const LUCKY_PRIME_COUNT_MAX = 5;

const LUCKY_PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
  53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113,
  127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199,
  211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293,
  307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397,
  401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499,
  503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599,
  601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691,
  701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797,
  809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887,
  907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997,
] as const;

/* ─── Pre-computed pools for O(1) selection ─────────────── */

import { getFlags } from "@/lib/flags";

function buildPools(base: Fortune[]): Record<Rarity, Fortune[]> {
  return {
    legendary: base.filter((f) => f.rarity === "legendary"),
    epic: base.filter((f) => f.rarity === "epic"),
    rare: base.filter((f) => f.rarity === "rare"),
    common: base.filter((f) => f.rarity === "common"),
  };
}

const pools = buildPools(fortunes);

/** Get the active fortune list (main + seasonal when enabled). */
function getActiveFortunes(): Fortune[] {
  const { seasonalPoolEnabled } = getFlags();
  return seasonalPoolEnabled ? [...fortunes, ...seasonalFortunes] : fortunes;
}

/** Get rarity pools, including seasonal when enabled. */
function getActivePools(): Record<Rarity, Fortune[]> {
  const { seasonalPoolEnabled } = getFlags();
  if (!seasonalPoolEnabled) return pools;
  return buildPools([...fortunes, ...seasonalFortunes]);
}

/**
 * Weighted random fortune selection.
 * Rarity determines the *probability* of being selected, not pool size:
 *   Base rates: Legendary 8%, Epic 17%, Rare 35%, Common 40%.
 * This keeps common most likely while cutting "three common in a row" odds
 * from 12.5% to 6.4%, which makes live reveals feel less punishing without
 * turning high tiers into participation trophies.
 */
export function getRarityWeights(legendaryRateMultiplier = 1): Record<Rarity, number> {
  const legendaryRate = BASE_RARITY_WEIGHTS.legendary * legendaryRateMultiplier;
  const remaining = 1 - legendaryRate;
  const nonLegendaryBase =
    BASE_RARITY_WEIGHTS.epic + BASE_RARITY_WEIGHTS.rare + BASE_RARITY_WEIGHTS.common;

  return {
    legendary: legendaryRate,
    epic: BASE_RARITY_WEIGHTS.epic * (remaining / nonLegendaryBase),
    rare: BASE_RARITY_WEIGHTS.rare * (remaining / nonLegendaryBase),
    common: BASE_RARITY_WEIGHTS.common * (remaining / nonLegendaryBase),
  };
}

export function selectRarity(roll: number, weights: Record<Rarity, number> = BASE_RARITY_WEIGHTS): Rarity {
  const legendaryCeil = weights.legendary;
  const epicCeil = legendaryCeil + weights.epic;
  const rareCeil = epicCeil + weights.rare;

  if (roll < legendaryCeil) return "legendary";
  if (roll < epicCeil) return "epic";
  if (roll < rareCeil) return "rare";
  return "common";
}

function pickFromPool(activePools: Record<Rarity, Fortune[]>, rarity: Rarity): Fortune[] {
  if (activePools[rarity].length > 0) return activePools[rarity];
  return activePools.common.length > 0
    ? activePools.common
    : [...activePools.legendary, ...activePools.epic, ...activePools.rare, ...activePools.common];
}

export function getRandomFortune(): Fortune {
  const { legendaryRateMultiplier } = getFlags();
  const activePools = getActivePools();

  const roll = Math.random();
  const rarity = selectRarity(roll, getRarityWeights(legendaryRateMultiplier));
  const pool = pickFromPool(activePools, rarity);

  return pool[Math.floor(Math.random() * pool.length)];
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function isPrimeNumber(n: number): boolean {
  return Number.isInteger(n) && n >= LUCKY_PRIME_MIN && LUCKY_PRIMES.includes(n as typeof LUCKY_PRIMES[number]);
}

export function getLuckyPrimeNumbers(seed: string): number[] {
  const source = seed.trim().length > 0 ? seed : "fortunesats";
  const count = LUCKY_PRIME_COUNT_MIN + (hashSeed(`${source}:count`) % (LUCKY_PRIME_COUNT_MAX - LUCKY_PRIME_COUNT_MIN + 1));
  const selected = new Set<number>();
  let state = hashSeed(`${source}:prime`);

  while (selected.size < count) {
    state = nextRandom(state);
    selected.add(LUCKY_PRIMES[state % LUCKY_PRIMES.length]);
  }

  return [...selected];
}

export function withLuckyPrimeNumbers(fortune: Fortune, seed: string): FortuneReveal {
  return {
    ...fortune,
    luckyNumbers: getLuckyPrimeNumbers(`${fortune.text}:${seed}`),
  };
}

/* ─── Enriched fortune model (agent layer) ─────────────────── */

export type Category =
  | "stoicism"
  | "philosophy"
  | "eastern"
  | "sovereignty"
  | "growth"
  | "fortune"
  | "wit";

export interface AgentFortune {
  id: string;
  text: string;
  author: string | null;
  rarity: Rarity;
  category: Category;
  luckyNumbers: number[];
  tags: string[];
}

/** Stable content-derived ID (7-char base36 hash). */
function fortuneId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Extract author from "text - Author" format, with legacy dash support. */
function extractAuthor(text: string): string | null {
  const match = text.match(/\s+[—–-]\s+([A-Z][^—–-]{0,59})$/);
  if (!match) return null;
  const candidate = match[1].trim();
  // Only treat as author if it looks like a name (starts uppercase, no sentence-length)
  if (candidate.length > 0 && candidate.length < 60 && /^[A-Z]/.test(candidate)) {
    return candidate;
  }
  return null;
}

/** Remove trailing attribution so category keywords don't see source labels. */
function extractQuote(text: string): string {
  return text.replace(/\s+[—–-]\s+[A-Z][^—–-]{0,59}$/, "").trim();
}

/** Infer category from content and authorship. */
function inferCategory(text: string, author: string | null): Category {
  const lower = text.toLowerCase();

  // Author-based classification
  if (author) {
    const sovereigntyAuthors = ["Satoshi Nakamoto", "Nick Szabo", "Frederic Bastiat"];
    if (sovereigntyAuthors.some((s) => author.includes(s))) return "sovereignty";

    const stoics = ["Marcus Aurelius", "Seneca", "Epictetus"];
    if (stoics.some((s) => author.includes(s))) return "stoicism";

    const eastern = ["Lao Tzu", "Buddha", "Confucius"];
    if (eastern.some((e) => author.includes(e))) return "eastern";

    const philosophers = [
      "Socrates", "Plato", "Aristotle", "Nietzsche", "Kierkegaard",
      "Virgil", "Oscar Wilde", "Epicurus",
    ];
    if (philosophers.some((p) => author.includes(p))) return "philosophy";
  }

  // Content-based classification
  const sovereigntyKw = [
    "sats", " sat ", "money", "currency", "bitcoin", "proof of work",
    "proof-of-work", "time preference", "trusted third", "peer-to-peer",
    "mint", "state", "mempool", "keys", "wallet", "scarcity", "stack",
    "fix the", "savings", "sound money", "freedom compounds",
    "sovereign", "value for value", "consensus", "self-custody",
  ];
  if (sovereigntyKw.some((k) => lower.includes(k))) return "sovereignty";

  const fortuneKw = [
    "will soon", "is moving", "is arriving", "tonight", "right now",
    "soon return", "quietly opening", "are moving toward", "soon pay",
    "grow clearer", "make room", "echoing outward", "thinking about you",
  ];
  if (fortuneKw.some((k) => lower.includes(k))) return "fortune";

  const witKw = [
    "dog thinks", "alphabet has range", "algorithm", "notification",
    "plot twist", "commit", "ship it", "imposter syndrome",
    "brave enough", "extrapolate", "forecast",
  ];
  if (witKw.some((k) => lower.includes(k))) return "wit";

  return "growth";
}

/** Derive tags from content, author, and classification. */
function inferTags(text: string, author: string | null, category: Category): string[] {
  const tags: string[] = [category];
  const lower = text.toLowerCase();

  if (author) {
    tags.push("attributed");
    if (author.startsWith("Inspired by ")) tags.push("inspired");
    if (author === "FortuneSats Oracle") tags.push("oracle");
  } else {
    tags.push("original");
  }

  if (lower.includes("mind") || lower.includes("thought")) tags.push("mindset");
  if (lower.includes("time") || lower.includes("patience") || lower.includes("wait")) tags.push("patience");
  if (lower.includes("strength") || lower.includes("power") || lower.includes("endur")) tags.push("strength");
  if (lower.includes("wisdom") || lower.includes("knowledge") || lower.includes("learn")) tags.push("wisdom");

  return tags;
}

/** Enrich a base Fortune into an AgentFortune. */
function enrichFortune(f: Fortune): AgentFortune {
  const author = extractAuthor(f.text);
  const quote = extractQuote(f.text);
  const category = inferCategory(quote, author);
  return {
    id: fortuneId(f.text),
    text: f.text,
    author,
    rarity: f.rarity,
    category,
    luckyNumbers: getLuckyPrimeNumbers(f.text),
    tags: inferTags(quote, author, category),
  };
}

/**
 * All fortunes with enriched metadata for agent consumption.
 * Computed once at module load time.
 */
export const agentFortunes: AgentFortune[] = fortunes.map(enrichFortune);

/** Lookup an enriched fortune by its stable ID. */
export const agentFortuneById = new Map<string, AgentFortune>(
  agentFortunes.map((f) => [f.id, f]),
);

/** Get a random enriched fortune (same weighted selection as getRandomFortune). */
export function getRandomAgentFortune(): AgentFortune {
  const base = getRandomFortune();
  return enrichFortune(base);
}

/**
 * Get a random fortune that hasn't been claimed yet.
 * Falls back to any random fortune if all have been seen.
 */
export function getUniqueRandomFortune(claimed: string[]): Fortune {
  const claimedSet = new Set(claimed);
  const all = getActiveFortunes();
  const available = all.filter((f) => !claimedSet.has(f.text));
  if (available.length === 0) {
    return getRandomFortune();
  }

  const { legendaryRateMultiplier } = getFlags();
  const weights = getRarityWeights(legendaryRateMultiplier);

  // Weighted selection from available pool
  const availPools: Record<Rarity, Fortune[]> = {
    legendary: available.filter((f) => f.rarity === "legendary"),
    epic: available.filter((f) => f.rarity === "epic"),
    rare: available.filter((f) => f.rarity === "rare"),
    common: available.filter((f) => f.rarity === "common"),
  };

  const roll = Math.random();
  const rarity = selectRarity(roll, weights);
  let pool = availPools[rarity];

  if (pool.length === 0) {
    // Fallback: pick from whatever's available
    pool = available;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
