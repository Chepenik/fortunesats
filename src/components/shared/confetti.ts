import confetti from "canvas-confetti";
import type { Rarity } from "@/lib/fortunes";

/** Full celebration burst (used for pack payment confirmation) */
export function fireConfetti() {
  const gold = "#d4a257";
  const red = "#c41e3a";
  const cyan = "#00c8d4";

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: [gold, red, cyan, "#fff"],
    scalar: 1.2,
  });

  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: [gold, red],
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: [gold, cyan],
    });
  }, 250);

  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { y: 0.5 },
      colors: [gold, "#fff"],
      scalar: 0.8,
    });
  }, 500);
}

/** Rarity-scaled confetti for individual fortune reveals */
export function fireRarityConfetti(rarity: Rarity) {
  if (rarity === "legendary") {
    const gold = "#d4a257";
    const brightGold = "#ffd700";
    const warmGold = "#e8a838";
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.55 }, colors: [gold, brightGold, warmGold, "#fff8e1"], scalar: 1.3 });
    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: [gold, brightGold] });
      confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: [warmGold, brightGold] });
    }, 200);
    setTimeout(() => {
      confetti({ particleCount: 40, spread: 100, origin: { y: 0.5 }, colors: [gold, brightGold, "#fff"], scalar: 0.9 });
    }, 450);
  } else if (rarity === "epic") {
    const purple = "#a855f7";
    const violet = "#8b5cf6";
    const lilac = "#c084fc";
    confetti({ particleCount: 50, spread: 65, origin: { y: 0.6 }, colors: [purple, violet, lilac, "#fff"], scalar: 1.1 });
    setTimeout(() => {
      confetti({ particleCount: 25, angle: 70, spread: 45, origin: { x: 0.1, y: 0.6 }, colors: [purple, violet] });
      confetti({ particleCount: 25, angle: 110, spread: 45, origin: { x: 0.9, y: 0.6 }, colors: [lilac, purple] });
    }, 200);
  } else {
    const gold = "#d4a257";
    const red = "#c41e3a";
    const cyan = "#00c8d4";
    confetti({ particleCount: 60, spread: 65, origin: { y: 0.6 }, colors: [gold, red, cyan, "#fff"], scalar: 1.1 });
    setTimeout(() => {
      confetti({ particleCount: 30, angle: 60, spread: 50, origin: { x: 0, y: 0.65 }, colors: [gold, red] });
      confetti({ particleCount: 30, angle: 120, spread: 50, origin: { x: 1, y: 0.65 }, colors: [gold, cyan] });
    }, 200);
  }
}

/** Smaller rarity confetti for pack fortune reveals (no confetti for rare/common) */
export function firePackRarityConfetti(rarity: Rarity) {
  if (rarity === "legendary") {
    const gold = "#d4a257";
    const brightGold = "#ffd700";
    const warmGold = "#e8a838";
    confetti({ particleCount: 80, spread: 75, origin: { y: 0.55 }, colors: [gold, brightGold, warmGold, "#fff8e1"], scalar: 1.2 });
    setTimeout(() => {
      confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: [gold, brightGold] });
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: [warmGold, brightGold] });
    }, 200);
  } else if (rarity === "epic") {
    const purple = "#a855f7";
    const violet = "#8b5cf6";
    const lilac = "#c084fc";
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 }, colors: [purple, violet, lilac, "#fff"], scalar: 1.1 });
    setTimeout(() => {
      confetti({ particleCount: 20, angle: 70, spread: 40, origin: { x: 0.1, y: 0.6 }, colors: [purple, violet] });
      confetti({ particleCount: 20, angle: 110, spread: 40, origin: { x: 0.9, y: 0.6 }, colors: [lilac, purple] });
    }, 200);
  }
}
