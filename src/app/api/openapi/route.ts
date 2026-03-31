import { config } from "@/lib/config";

/**
 * OpenAPI 3.1 specification for FortuneSats.
 *
 * Serves a machine-readable description of available endpoints.
 * Agents, CLI tools, and external systems can consume this to
 * understand how to interact with the FortuneSats API.
 */
export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "FortuneSats API",
      version: "0.1.0",
      description:
        "Pay sats, receive wisdom. FortuneSats is a human-centered fortune oracle with agent-ready infrastructure and L402 payment gating.",
      contact: {
        name: "FortuneSats",
        url: "https://fortunesats.vercel.app",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: "https://fortunesats.vercel.app",
        description: "Production",
      },
    ],
    paths: {
      "/api/agent/fortune": {
        get: {
          operationId: "getAgentFortune",
          summary: "Get a fortune (agent-facing)",
          description:
            "Returns a structured fortune with full metadata. Supports filtering by category, rarity, or fetching by ID. When L402 is enabled, requires Lightning payment.",
          tags: ["Agent", "Fortune"],
          parameters: [
            {
              name: "id",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Fetch a specific fortune by its stable ID.",
            },
            {
              name: "category",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit"],
              },
              description: "Filter by fortune category.",
            },
            {
              name: "rarity",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["legendary", "epic", "rare", "common"],
              },
              description: "Filter by rarity tier.",
            },
            {
              name: "meta",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["true"] },
              description: "Include pool metadata (counts by category and rarity).",
            },
          ],
          responses: {
            "200": {
              description: "A fortune with structured metadata.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      fortune: { $ref: "#/components/schemas/AgentFortune" },
                      pricing: { $ref: "#/components/schemas/Pricing" },
                      meta: { $ref: "#/components/schemas/PoolMeta" },
                    },
                    required: ["fortune"],
                  },
                },
              },
            },
            "400": { description: "Invalid query parameter." },
            "402": {
              description: "Payment required (L402). Pay the Lightning invoice to access.",
            },
            "404": { description: "Fortune not found (when using ?id=)." },
            "429": { description: "Rate limited. Retry after the specified delay." },
            "503": { description: "Agent API disabled or temporarily unavailable." },
          },
          security: config.features.l402 ? [{ l402: [] }] : [],
        },
      },
      "/api/fortune": {
        get: {
          operationId: "getFortune",
          summary: "Get a fortune (human-facing, L402 required)",
          description:
            "The primary fortune endpoint. Requires a 100 sat Lightning payment via MoneyDevKit L402. Returns fortune text and rarity.",
          tags: ["Human", "Fortune"],
          responses: {
            "200": {
              description: "Fortune delivered after payment.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      fortune: { type: "string" },
                      rarity: { type: "string", enum: ["legendary", "epic", "rare", "common"] },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "402": { description: "Payment required." },
            "429": { description: "Rate limited." },
          },
          security: [{ l402: [] }],
        },
      },
      "/api/fortune/status": {
        get: {
          operationId: "getFortuneStatus",
          summary: "Check payment status",
          description: "Poll whether a Lightning payment has been received. Returns the fortune if paid.",
          tags: ["Human", "Fortune"],
          parameters: [
            {
              name: "paymentHash",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "The payment hash from the invoice.",
            },
          ],
          responses: {
            "200": { description: "Payment status (paid: true/false, fortune if paid)." },
            "400": { description: "Missing or invalid paymentHash." },
            "429": { description: "Rate limited." },
          },
        },
      },
      "/api/leaderboard": {
        get: {
          operationId: "getLeaderboard",
          summary: "Get leaderboard rankings",
          description:
            "Returns top entries across four dimensions: fortunes revealed, sats spent, legendary pulls, and streak.",
          tags: ["Public"],
          responses: {
            "200": { description: "Leaderboard data with four ranked lists." },
          },
        },
      },
      "/api/activity": {
        get: {
          operationId: "getActivity",
          summary: "Get recent activity feed",
          description: "Returns the 10 most recent fortune reveals across all users.",
          tags: ["Public"],
          responses: {
            "200": { description: "Array of recent activity events." },
          },
        },
      },
      "/api/health": {
        get: {
          operationId: "getHealth",
          summary: "Health check",
          tags: ["Public"],
          responses: {
            "200": { description: "Service is healthy." },
          },
        },
      },
      "/api/openapi": {
        get: {
          operationId: "getOpenApiSpec",
          summary: "This OpenAPI specification",
          tags: ["Public"],
          responses: {
            "200": { description: "OpenAPI 3.1 JSON specification." },
          },
        },
      },
    },
    components: {
      schemas: {
        AgentFortune: {
          type: "object",
          properties: {
            id: { type: "string", description: "Stable content-derived ID." },
            text: { type: "string", description: "The fortune text, including attribution if present." },
            author: {
              type: ["string", "null"],
              description: "Attributed author, or null for original fortunes.",
            },
            rarity: {
              type: "string",
              enum: ["legendary", "epic", "rare", "common"],
              description: "Rarity tier. Legendary (5%), Epic (15%), Rare (30%), Common (50%).",
            },
            category: {
              type: "string",
              enum: ["stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit"],
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Auto-derived content tags.",
            },
          },
          required: ["id", "text", "rarity", "category", "tags"],
        },
        Pricing: {
          type: "object",
          properties: {
            amount: { type: "integer", description: "Price in satoshis." },
            currency: { type: "string", enum: ["SAT"] },
            l402_enabled: { type: "boolean", description: "Whether L402 payment gating is active." },
          },
        },
        PoolMeta: {
          type: "object",
          properties: {
            total: { type: "integer" },
            categories: {
              type: "object",
              additionalProperties: { type: "integer" },
            },
            rarities: {
              type: "object",
              additionalProperties: { type: "integer" },
            },
          },
        },
      },
      securitySchemes: {
        l402: {
          type: "http",
          scheme: "L402",
          description:
            "L402 payment authentication. Send a Lightning payment, then authenticate with Authorization: L402 <macaroon>:<preimage>.",
        },
      },
    },
    tags: [
      { name: "Agent", description: "Machine-facing endpoints with structured responses." },
      { name: "Human", description: "Human-facing endpoints (browser/app flow)." },
      { name: "Fortune", description: "Fortune retrieval and payment." },
      { name: "Public", description: "Publicly accessible, no payment required." },
    ],
  };

  return Response.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
