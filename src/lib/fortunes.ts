/* ─── Rarity system ─────────────────────────────────────── */

export type Rarity = "legendary" | "epic" | "rare" | "common";

export interface Fortune {
  text: string;
  rarity: Rarity;
}

export const RARITY_CONFIG = {
  legendary: {
    label: "Legendary",
    color: "#d4a257",
    glowColor: "rgba(212, 162, 87, 0.4)",
    borderClass: "rarity-legendary",
    badgeClass: "bg-gold/15 border-gold/30 text-gold",
  },
  epic: {
    label: "Epic",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.3)",
    borderClass: "rarity-epic",
    badgeClass: "bg-purple-500/10 border-purple-500/25 text-purple-400",
  },
  rare: {
    label: "Rare",
    color: "#60a5fa",
    glowColor: "rgba(96, 165, 250, 0.25)",
    borderClass: "rarity-rare",
    badgeClass: "bg-blue-400/10 border-blue-400/20 text-blue-400",
  },
  common: {
    label: "Common",
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
  { text: "The only true wisdom is in knowing you know nothing. - Socrates", rarity: "legendary" },
  { text: "We suffer more often in imagination than in reality. - Seneca", rarity: "legendary" },
  { text: "Proof of work is truth without permission.", rarity: "legendary" },
  { text: "Fortune favors the bold. - Virgil", rarity: "legendary" },

  // ─── EPIC (strong philosophical) ─────────────────────────
  { text: "The state is the great fictitious entity by which everyone seeks to live at the expense of everyone else. - Frederic Bastiat", rarity: "epic" },
  { text: "No mint or other trusted parties. - Satoshi Nakamoto", rarity: "epic" },
  { text: "He who has a why to live can bear almost any how. - Friedrich Nietzsche", rarity: "epic" },
  { text: "The unexamined life is not worth living. - Socrates", rarity: "epic" },
  { text: "When I let go of what I am, I become what I might be. - Lao Tzu", rarity: "epic" },
  { text: "To live is the rarest thing in the world. Most people exist, that is all. - Oscar Wilde", rarity: "epic" },
  { text: "A hindrance to a given duty becomes a help. - Marcus Aurelius", rarity: "epic" },
  { text: "Low time preference builds cathedrals.", rarity: "epic" },
  { text: "Self-custody begins in the mind.", rarity: "epic" },
  { text: "Truth does not need a marketing budget.", rarity: "epic" },
  { text: "The highest signal is often quiet.", rarity: "epic" },
  { text: "Consensus begins with the courage to verify.", rarity: "epic" },
  { text: "A sovereign life is built one refusal at a time.", rarity: "epic" },
  { text: "Scarcity gives patience a place to live.", rarity: "epic" },
  { text: "Your proof-of-work is the person you become.", rarity: "epic" },
  { text: "The longer road may be the low time preference road.", rarity: "epic" },
  { text: "Sound money asks you to mean what you do.", rarity: "epic" },
  { text: "Wisdom compounds when ego stops spending it.", rarity: "epic" },

  // ─── RARE (solid wisdom) ─────────────────────────────────
  { text: "The soul becomes dyed with the color of its thoughts. - Marcus Aurelius", rarity: "rare" },
  { text: "Begin at once to live, and count each separate day as a separate life. - Seneca", rarity: "rare" },
  { text: "Not what we have but what we enjoy constitutes our abundance. - Epicurus", rarity: "rare" },
  { text: "Nature does not hurry, yet everything is accomplished. - Lao Tzu", rarity: "rare" },
  { text: "The journey of a thousand miles begins with a single step. - Lao Tzu", rarity: "rare" },
  { text: "Mastering others is strength. Mastering yourself is true power. - Lao Tzu", rarity: "rare" },
  { text: "A disciplined mind brings happiness. - Buddha", rarity: "rare" },
  { text: "While we wait for life, life passes. - Seneca", rarity: "rare" },
  { text: "There is no easy way from the earth to the stars. - Seneca", rarity: "rare" },
  { text: "Fix the money, fix the incentives.", rarity: "rare" },
  { text: "Savings are stored time.", rarity: "rare" },
  { text: "Sound money makes honest plans possible.", rarity: "rare" },
  { text: "Freedom compounds.", rarity: "rare" },
  { text: "The signal is there for those willing to tune in.", rarity: "rare" },
  { text: "Build quietly. Let the world notice later.", rarity: "rare" },
  { text: "A sovereign mind is hard to manipulate.", rarity: "rare" },
  { text: "Every sat tells a story.", rarity: "rare" },
  { text: "Value for value. It's that simple.", rarity: "rare" },
  { text: "Pain can be a teacher if ego does not interrupt the lesson.", rarity: "rare" },
  { text: "The future belongs to those who can delay gratification.", rarity: "rare" },
  { text: "A man who can govern himself needs few rulers.", rarity: "rare" },
  { text: "Conviction is forged when comfort is removed.", rarity: "rare" },
  { text: "The quality of your life is hidden in your habits.", rarity: "rare" },
  { text: "Endurance is a form of intelligence.", rarity: "rare" },
  { text: "What is measured improves. What is cherished endures.", rarity: "rare" },
  { text: "Freedom starts with self-command.", rarity: "rare" },
  { text: "Aim at truth, even when it costs.", rarity: "rare" },
  { text: "Reputation is earned in drops and lost in buckets.", rarity: "rare" },
  { text: "The things worth building usually take longer than you hoped.", rarity: "rare" },
  { text: "The answer you seek is already within you. Be still.", rarity: "rare" },
  { text: "Something you lost will soon return in a new form.", rarity: "rare" },
  { text: "A door you thought was closed is quietly opening.", rarity: "rare" },
  { text: "The path reveals itself when you stop demanding to see the end.", rarity: "rare" },
  { text: "You are closer than you think. One more block.", rarity: "rare" },
  { text: "Verify before you trust the voice.", rarity: "rare" },
  { text: "A scarce thing teaches patience.", rarity: "rare" },
  { text: "Keys are held by hand. Sovereignty is held by habit.", rarity: "rare" },
  { text: "The mempool teaches patience without asking permission.", rarity: "rare" },

  // ─── COMMON (sharp one-liners & lighter quotes) ──────────
  { text: "Hard choices, easy life. Easy choices, hard life.", rarity: "common" },
  { text: "Depth beats noise.", rarity: "common" },
  { text: "Calm is a superpower.", rarity: "common" },
  { text: "Pressure reveals character.", rarity: "common" },
  { text: "Small hinges swing big doors.", rarity: "common" },
  { text: "Clarity creates momentum.", rarity: "common" },
  { text: "What you tolerate becomes your standard.", rarity: "common" },
  { text: "What you feed grows.", rarity: "common" },
  { text: "A clear no protects a meaningful yes.", rarity: "common" },
  { text: "The quiet work matters most.", rarity: "common" },
  { text: "Most people quit right before the compounding starts.", rarity: "common" },
  { text: "Real strength is calm under pressure.", rarity: "common" },
  { text: "The seed grows in darkness.", rarity: "common" },
  { text: "Every master was once a beginner.", rarity: "common" },
  { text: "Strong convictions, loosely held.", rarity: "common" },
  { text: "Keep your word, especially to yourself.", rarity: "common" },
  { text: "The wise build before they boast.", rarity: "common" },
  { text: "Most walls are doors in disguise.", rarity: "common" },
  { text: "Discomfort is the tuition for growth.", rarity: "common" },
  { text: "You become credible by keeping promises to yourself.", rarity: "common" },
  { text: "The right path is rarely the crowded one.", rarity: "common" },
  { text: "A little progress, repeated daily, becomes a different life.", rarity: "common" },
  { text: "If at first you don't succeed, refine the approach.", rarity: "common" },
  { text: "This fortune cost 100 sats. The lesson could be worth more.", rarity: "common" },
  { text: "A pleasant surprise is moving in your direction.", rarity: "common" },
  { text: "The next stranger you meet may carry useful truth.", rarity: "common" },
  { text: "Pay attention to your dreams tonight. They are trying to organize something.", rarity: "common" },
  { text: "An old friend is thinking about you right now.", rarity: "common" },
  { text: "A small act of kindness you forgot is still echoing outward.", rarity: "common" },
  { text: "What feels like an ending may only be a turn in the road.", rarity: "common" },
  { text: "Something important is arriving. Make room for it.", rarity: "common" },
  { text: "Trust the detour. It may know the terrain better than you do.", rarity: "common" },
  { text: "The patience you are practicing now will soon pay interest.", rarity: "common" },
  { text: "A decision you have been postponing will grow clearer soon.", rarity: "common" },
  { text: "The right people are moving toward you already.", rarity: "common" },
  { text: "Stack patience before opinions.", rarity: "common" },
  { text: "Noise spends fast. Signal saves.", rarity: "common" },
  { text: "Keep your keys and your counsel close.", rarity: "common" },
  { text: "A small sat can still carry intention.", rarity: "common" },
  { text: "The next block is found by doing the work.", rarity: "common" },
  { text: "Your wallet should not know your excuses.", rarity: "common" },
  { text: "Scarcity makes every yes more honest.", rarity: "common" },
  { text: "A good ritual does not beg for attention.", rarity: "common" },
  { text: "The oracle shows a signal, not a shortcut.", rarity: "common" },
  { text: "Sovereignty starts as a private decision.", rarity: "common" },
  { text: "Low preference days become sovereign years.", rarity: "common" },
  { text: "Spend slowly. Learn quickly.", rarity: "common" },
  { text: "A quiet stack is still a stack.", rarity: "common" },
  { text: "The best receipt is the lesson you keep.", rarity: "common" },
  { text: "Do the work before asking for luck.", rarity: "common" },
  { text: "The fee is small. The signal is yours.", rarity: "common" },
  { text: "Truth travels light.", rarity: "common" },
  { text: "Some doors open only after proof-of-work.", rarity: "common" },
  { text: "Make your future self easier to trust.", rarity: "common" },
  { text: "The code works. Ship it before it changes its mind.", rarity: "common" },
];

/* ─── Seasonal bonus pool ───────────────────────────────── */

/**
 * Seasonal fortunes are mixed into the main pool when the
 * SEASONAL_POOL_ENABLED flag is true. Edit this array to rotate
 * seasonal content without touching the core fortune pool.
 */
export const seasonalFortunes: Fortune[] = [
  { text: "Spring cleans more than houses. Let something old fall away.", rarity: "rare" },
  { text: "The equinox reminds us: balance is not stillness, it is motion.", rarity: "epic" },
  { text: "Plant now. The harvest has its own calendar.", rarity: "common" },
  { text: "A season of building begins. Trust what you start this week.", rarity: "common" },
  { text: "Even the sun takes turns. Rest is not retreat.", rarity: "rare" },
];

export const FORTUNE_POOL_TOTAL = fortunes.length;

export const FORTUNE_POOL_TOTALS = {
  legendary: fortunes.filter((f) => f.rarity === "legendary").length,
  epic: fortunes.filter((f) => f.rarity === "epic").length,
  rare: fortunes.filter((f) => f.rarity === "rare").length,
  common: fortunes.filter((f) => f.rarity === "common").length,
} satisfies Record<Rarity, number>;

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
 *   Base rates: Legendary 5%, Epic 15%, Rare 30%, Common 50%
 *   legendaryRateMultiplier scales the legendary threshold (clamped 0.5-4.0).
 */
export function getRandomFortune(): Fortune {
  const { legendaryRateMultiplier } = getFlags();
  const activePools = getActivePools();

  const legendaryRate = 0.05 * legendaryRateMultiplier;
  // Compress remaining rates proportionally into the leftover space
  const remaining = 1 - legendaryRate;
  const epicCeil = legendaryRate + 0.15 * (remaining / 0.95);
  const rareCeil = epicCeil + 0.30 * (remaining / 0.95);

  const roll = Math.random();
  let pool: Fortune[];

  if (roll < legendaryRate && activePools.legendary.length > 0) {
    pool = activePools.legendary;
  } else if (roll < epicCeil && activePools.epic.length > 0) {
    pool = activePools.epic;
  } else if (roll < rareCeil && activePools.rare.length > 0) {
    pool = activePools.rare;
  } else {
    pool = activePools.common;
  }

  return pool[Math.floor(Math.random() * pool.length)];
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

  if (author) tags.push("attributed");
  else tags.push("original");

  if (lower.includes("mind") || lower.includes("thought")) tags.push("mindset");
  if (lower.includes("time") || lower.includes("patience") || lower.includes("wait")) tags.push("patience");
  if (lower.includes("strength") || lower.includes("power") || lower.includes("endur")) tags.push("strength");
  if (lower.includes("wisdom") || lower.includes("knowledge") || lower.includes("learn")) tags.push("wisdom");

  return tags;
}

/** Enrich a base Fortune into an AgentFortune. */
function enrichFortune(f: Fortune): AgentFortune {
  const author = extractAuthor(f.text);
  const category = inferCategory(f.text, author);
  return {
    id: fortuneId(f.text),
    text: f.text,
    author,
    rarity: f.rarity,
    category,
    tags: inferTags(f.text, author, category),
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
  const legendaryRate = 0.05 * legendaryRateMultiplier;
  const remaining = 1 - legendaryRate;
  const epicCeil = legendaryRate + 0.15 * (remaining / 0.95);
  const rareCeil = epicCeil + 0.30 * (remaining / 0.95);

  // Weighted selection from available pool
  const availPools: Record<Rarity, Fortune[]> = {
    legendary: available.filter((f) => f.rarity === "legendary"),
    epic: available.filter((f) => f.rarity === "epic"),
    rare: available.filter((f) => f.rarity === "rare"),
    common: available.filter((f) => f.rarity === "common"),
  };

  const roll = Math.random();
  let pool: Fortune[];

  if (roll < legendaryRate && availPools.legendary.length > 0) {
    pool = availPools.legendary;
  } else if (roll < epicCeil && availPools.epic.length > 0) {
    pool = availPools.epic;
  } else if (roll < rareCeil && availPools.rare.length > 0) {
    pool = availPools.rare;
  } else if (availPools.common.length > 0) {
    pool = availPools.common;
  } else {
    // Fallback: pick from whatever's available
    pool = available;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
