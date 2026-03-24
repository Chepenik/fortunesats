export { POST } from "@moneydevkit/nextjs/server/route";

// Give MDK's LDK node time to build + sync (takes ~10-20s on cold start)
export const maxDuration = 60;
