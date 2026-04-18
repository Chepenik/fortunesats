import { getRandomAgentFortune, agentFortunes, agentFortuneById } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { withAgentPayment, agentError } from "@/lib/agent-payment";
import { config } from "@/lib/config";

/**
 * Agent-facing fortune endpoint.
 *
 * Returns structured JSON designed for machine consumption.
 *
 * Query parameters:
 *   ?id=<fortune_id>       — fetch a specific fortune by ID
 *   ?category=<category>   — random fortune filtered by category
 *   ?rarity=<rarity>       — random fortune filtered by rarity
 *   ?meta=true             — include pool metadata (total count, categories, rarities)
 */
const handler = async (req: Request): Promise<Response> => {
  if (!config.features.agentApi) {
    return agentError("agent_api_disabled", "Agent API is currently disabled.", 503);
  }

  const limited = await checkRateLimit(req, { prefix: "agent-fortune", limit: 30, window: "1 m" });
  if (limited) return limited;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const category = url.searchParams.get("category");
  const rarity = url.searchParams.get("rarity");
  const includeMeta = url.searchParams.get("meta") === "true";

  // Fetch by ID
  if (id) {
    const fortune = agentFortuneById.get(id);
    if (!fortune) {
      return agentError("not_found", `No fortune found with id "${id}".`, 404);
    }
    return Response.json({
      fortune,
      ...(includeMeta && { meta: poolMeta() }),
    });
  }

  // Filtered random selection
  let pool = agentFortunes;

  if (category) {
    const filtered = pool.filter((f) => f.category === category);
    if (filtered.length === 0) {
      return agentError(
        "invalid_category",
        `Unknown category "${category}". Valid: stoicism, philosophy, eastern, sovereignty, growth, fortune, wit.`,
        400,
      );
    }
    pool = filtered;
  }

  if (rarity) {
    const filtered = pool.filter((f) => f.rarity === rarity);
    if (filtered.length === 0) {
      return agentError(
        "invalid_rarity",
        `Unknown or empty rarity "${rarity}". Valid: legendary, epic, rare, common.`,
        400,
      );
    }
    pool = filtered;
  }

  // If both filters applied, pick from the intersection; otherwise weighted random
  const fortune =
    category || rarity
      ? pool[Math.floor(Math.random() * pool.length)]
      : getRandomAgentFortune();

  return Response.json({
    fortune,
    pricing: {
      amount: config.pricing.fortuneSingle,
      currency: "SAT",
    },
    ...(includeMeta && { meta: poolMeta() }),
  });
};

function poolMeta() {
  const categories: Record<string, number> = {};
  const rarities: Record<string, number> = {};

  for (const f of agentFortunes) {
    categories[f.category] = (categories[f.category] || 0) + 1;
    rarities[f.rarity] = (rarities[f.rarity] || 0) + 1;
  }

  return {
    total: agentFortunes.length,
    categories,
    rarities,
  };
}

export const GET = withAgentPayment(handler);
