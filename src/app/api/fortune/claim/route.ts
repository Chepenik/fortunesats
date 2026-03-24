import { getRandomFortune } from "@/lib/fortunes";

/**
 * Fallback fortune endpoint for when the MDK webhook flow is broken
 * (LDK node sync timeout on Vercel Serverless). The user has already
 * paid MDK — this just delivers the fortune they're owed.
 */
export async function GET() {
  return Response.json({
    fortune: getRandomFortune(),
    timestamp: new Date().toISOString(),
  });
}
