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

export const fortunes: Fortune[] = [
  // ─── LEGENDARY (most profound, iconic) ───────────────────
  { text: "The obstacle is the way. — Marcus Aurelius", rarity: "legendary" },
  { text: "He who has a why to live can bear almost any how. — Nietzsche", rarity: "legendary" },
  { text: "Until you make the unconscious conscious, it will direct your life and you will call it fate. — Jung", rarity: "legendary" },
  { text: "The privilege of a lifetime is to become who you truly are. — Jung", rarity: "legendary" },
  { text: "No tree can grow to heaven unless its roots reach down to hell. — Jung", rarity: "legendary" },
  { text: "Fortune favors the bold. — Virgil", rarity: "legendary" },
  { text: "Let everything happen to you: beauty and terror. Just keep going. No feeling is final. — Rilke", rarity: "legendary" },
  { text: "21 million. No more, no less.", rarity: "legendary" },

  // ─── EPIC (strong philosophical) ─────────────────────────
  { text: "We suffer more in imagination than in reality. — Seneca", rarity: "epic" },
  { text: "It is not because things are difficult that we do not dare. It is because we do not dare that they are difficult. — Seneca", rarity: "epic" },
  { text: "What you seek is seeking you. — Rumi", rarity: "epic" },
  { text: "The wound is the place where the light enters you. — Rumi", rarity: "epic" },
  { text: "The cave you fear to enter holds the treasure you seek. — Joseph Campbell", rarity: "epic" },
  { text: "The unexamined life is not worth living. — Socrates", rarity: "epic" },
  { text: "When I let go of what I am, I become what I might be. — Lao Tzu", rarity: "epic" },
  { text: "There is a crack in everything. That's how the light gets in. — Leonard Cohen", rarity: "epic" },
  { text: "Life can only be understood backwards; but it must be lived forwards. — Kierkegaard", rarity: "epic" },
  { text: "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away. — Saint-Exupéry", rarity: "epic" },
  { text: "To live is the rarest thing in the world. Most people exist, that is all. — Wilde", rarity: "epic" },
  { text: "The happiness of your life depends upon the quality of your thoughts. — Marcus Aurelius", rarity: "epic" },
  { text: "Dwell on the beauty of life. Watch the stars, and see yourself running with them. — Marcus Aurelius", rarity: "epic" },
  { text: "The flame that burns twice as bright burns half as long.", rarity: "epic" },
  { text: "The river cuts through rock not because of its power, but because of its persistence.", rarity: "epic" },
  { text: "It is easier to act your way into a new way of thinking than think your way into a new way of acting.", rarity: "epic" },
  { text: "Proof of work is truth without permission.", rarity: "epic" },
  { text: "Low time preference builds cathedrals.", rarity: "epic" },

  // ─── RARE (solid wisdom) ─────────────────────────────────
  { text: "The soul becomes dyed with the color of its thoughts. — Marcus Aurelius", rarity: "rare" },
  { text: "Begin at once to live, and count each separate day as a separate life. — Seneca", rarity: "rare" },
  { text: "Knowing yourself is the beginning of all wisdom. — Aristotle", rarity: "rare" },
  { text: "Nature does not hurry, yet everything is accomplished. — Lao Tzu", rarity: "rare" },
  { text: "The journey of a thousand miles begins with a single step. — Lao Tzu", rarity: "rare" },
  { text: "Mastering others is strength. Mastering yourself is true power. — Lao Tzu", rarity: "rare" },
  { text: "A disciplined mind brings happiness. — Buddha", rarity: "rare" },
  { text: "What you are is what you have been. What you'll be is what you do now. — Buddha", rarity: "rare" },
  { text: "In the middle of difficulty lies opportunity. — Einstein", rarity: "rare" },
  { text: "Be patient toward all that is unsolved in your heart. — Rilke", rarity: "rare" },
  { text: "While we wait for life, life passes. — Seneca", rarity: "rare" },
  { text: "There is no easy way from the earth to the stars. — Seneca", rarity: "rare" },
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
  { text: "The future is built by those who can delay gratification.", rarity: "rare" },
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
  { text: "The path will reveal itself when you stop trying to see its end.", rarity: "rare" },
  { text: "You are closer than you think. One more step.", rarity: "rare" },
  { text: "The timing isn't late. It's precise.", rarity: "rare" },

  // ─── COMMON (sharp one-liners & lighter quotes) ──────────
  { text: "Hard choices, easy life. Easy choices, hard life.", rarity: "common" },
  { text: "Comparison is the thief of joy.", rarity: "common" },
  { text: "The map is not the territory.", rarity: "common" },
  { text: "You do not rise to your goals. You fall to your systems.", rarity: "common" },
  { text: "Depth beats noise.", rarity: "common" },
  { text: "Calm is a superpower.", rarity: "common" },
  { text: "The way out is through.", rarity: "common" },
  { text: "Pressure makes pearls.", rarity: "common" },
  { text: "Small hinges swing big doors.", rarity: "common" },
  { text: "Clarity creates momentum.", rarity: "common" },
  { text: "What you tolerate becomes your standard.", rarity: "common" },
  { text: "What you feed grows.", rarity: "common" },
  { text: "A clear no protects a meaningful yes.", rarity: "common" },
  { text: "The quiet work matters most.", rarity: "common" },
  { text: "Most people quit right before the compounding starts.", rarity: "common" },
  { text: "Real strength is calm under pressure.", rarity: "common" },
  { text: "The seed grows in darkness.", rarity: "common" },
  { text: "Every master was once a disaster.", rarity: "common" },
  { text: "Strong convictions, loosely held.", rarity: "common" },
  { text: "Keep your word, especially to yourself.", rarity: "common" },
  { text: "The wise build before they boast.", rarity: "common" },
  { text: "Most walls are doors in disguise.", rarity: "common" },
  { text: "Discomfort is the tuition for growth.", rarity: "common" },
  { text: "You become credible by keeping promises to yourself.", rarity: "common" },
  { text: "The right path is rarely the crowded one.", rarity: "common" },
  { text: "A little progress, repeated daily, becomes a different life.", rarity: "common" },
  { text: "There are two types of people: those who can extrapolate from incomplete data.", rarity: "common" },
  { text: "If at first you don't succeed, redefine success.", rarity: "common" },
  { text: "Today's forecast: 100% chance of things happening.", rarity: "common" },
  { text: "The code works. Ship it before it changes its mind.", rarity: "common" },
  { text: "Your future self is already proud of you for being here.", rarity: "common" },
  { text: "The WiFi will be strong wherever you go next.", rarity: "common" },
  { text: "You are someone's favorite notification.", rarity: "common" },
  { text: "Plot twist: you were the main character all along.", rarity: "common" },
  { text: "The universe just winked at you. Did you catch it?", rarity: "common" },
  { text: "The algorithm is about to work in your favor.", rarity: "common" },
  { text: "Not all treasure is silver and gold. Some of it is sats.", rarity: "common" },
  { text: "You're one commit away from something great.", rarity: "common" },
  { text: "If Plan A fails, remember the alphabet has 25 more letters.", rarity: "common" },
  { text: "Be the person your dog thinks you are.", rarity: "common" },
  { text: "Everything is a file if you're brave enough.", rarity: "common" },
  { text: "Your imposter syndrome is lying to you.", rarity: "common" },
  { text: "This fortune cost 100 sats. Your smile? Priceless.", rarity: "common" },
  { text: "Someone, somewhere, is Googling exactly what you know.", rarity: "common" },
  { text: "A pleasant surprise awaits you before the week ends.", rarity: "common" },
  { text: "The next stranger you speak to carries an important message.", rarity: "common" },
  { text: "Pay attention to your dreams tonight. They know something.", rarity: "common" },
  { text: "An old friend is thinking of you at this very moment.", rarity: "common" },
  { text: "A small act of kindness you forgot about is rippling outward.", rarity: "common" },
  { text: "What feels like the end is only a turn in the road.", rarity: "common" },
  { text: "Something important is arriving. Make space for it.", rarity: "common" },
  { text: "Trust the detour. It knows where it's going.", rarity: "common" },
  { text: "The patience you're practicing now will compound soon.", rarity: "common" },
  { text: "A decision you've been avoiding will become obvious by morning.", rarity: "common" },
  { text: "The right people are on their way to you.", rarity: "common" },
];

/* ─── Pre-computed pools for O(1) selection ─────────────── */

const pools: Record<Rarity, Fortune[]> = {
  legendary: fortunes.filter((f) => f.rarity === "legendary"),
  epic: fortunes.filter((f) => f.rarity === "epic"),
  rare: fortunes.filter((f) => f.rarity === "rare"),
  common: fortunes.filter((f) => f.rarity === "common"),
};

/**
 * Weighted random fortune selection.
 * Rarity determines the *probability* of being selected, not pool size:
 *   Legendary: 5%, Epic: 15%, Rare: 30%, Common: 50%
 */
export function getRandomFortune(): Fortune {
  const roll = Math.random();
  let pool: Fortune[];

  if (roll < 0.05) {
    pool = pools.legendary;
  } else if (roll < 0.20) {
    pool = pools.epic;
  } else if (roll < 0.50) {
    pool = pools.rare;
  } else {
    pool = pools.common;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get a random fortune that hasn't been claimed yet.
 * Falls back to any random fortune if all have been seen.
 */
export function getUniqueRandomFortune(claimed: string[]): Fortune {
  const claimedSet = new Set(claimed);
  const available = fortunes.filter((f) => !claimedSet.has(f.text));
  if (available.length === 0) {
    return getRandomFortune();
  }

  // Weighted selection from available pool
  const availPools: Record<Rarity, Fortune[]> = {
    legendary: available.filter((f) => f.rarity === "legendary"),
    epic: available.filter((f) => f.rarity === "epic"),
    rare: available.filter((f) => f.rarity === "rare"),
    common: available.filter((f) => f.rarity === "common"),
  };

  const roll = Math.random();
  let pool: Fortune[];

  if (roll < 0.05 && availPools.legendary.length > 0) {
    pool = availPools.legendary;
  } else if (roll < 0.20 && availPools.epic.length > 0) {
    pool = availPools.epic;
  } else if (roll < 0.50 && availPools.rare.length > 0) {
    pool = availPools.rare;
  } else if (availPools.common.length > 0) {
    pool = availPools.common;
  } else {
    // Fallback: pick from whatever's available
    pool = available;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
