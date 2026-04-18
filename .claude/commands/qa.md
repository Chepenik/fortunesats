# FortuneSats Daily QA Loop

You are running a focused QA pass on the FortuneSats codebase. Each run should be incremental — pick ONE focus area, analyze it thoroughly, make targeted fixes, and verify the build still passes.

## Focus Areas (rotate through these)

### 1. Silent Error Swallowing → Add Logging
Search for `catch {` and `catch (` blocks that swallow errors silently (no logging, no re-throw). For each one found:
- Add `console.error("[module:function]", error)` with enough context to debug in Vercel logs
- Keep the graceful degradation behavior (don't re-throw in non-critical paths)
- Mark truly non-critical paths with a comment explaining WHY it's safe to swallow

Key files to check:
- `src/lib/leaderboard.ts` — many catch blocks
- `src/lib/ratelimit.ts` — catch block in checkRateLimit
- `src/app/api/fortune/status/route.ts` — multiple catch blocks
- `src/app/api/fortune/claim/route.ts` — multiple catch blocks
- `src/app/api/pack/status/route.ts`
- `src/app/api/pack/fortune/route.ts`

### 2. Redis Cost Reduction
Audit Redis command usage across all endpoints. For each endpoint, count the number of Redis commands per request and look for:
- Redundant reads (reading data that was just written)
- Pipeline opportunities (multiple independent commands that could be batched)
- Missing or ineffective caching (data re-fetched on every request)
- Unnecessary writes (writing unchanged data)

Key files: `src/lib/leaderboard.ts`, `src/lib/activity.ts`, `src/lib/strike.ts`, `src/app/api/leaderboard/route.ts`

### 3. Reliability Hardening
Look for failure modes that could break the user experience:
- Strike webhook reliability (what happens if /api/strike/webhook never fires? polling should still drive payment detection)
- Redis connection failures (does every path degrade gracefully?)
- Race conditions in payment state (concurrent pollers of /api/checkout-status for the same invoice)
- Memory leaks in module-level Maps/Sets (ratelimit ephemeralCache, syncedHashes, etc.)

### 4. Code Simplification
Find opportunities to reduce complexity:
- `fortune-machine.tsx` (827 lines) — can state logic be extracted?
- Duplicated error response patterns across API routes
- Unused exports or dead code
- Overly complex control flow that could be simplified

### 5. Test Coverage
Check which files have tests and which don't. Write tests for the most critical untested paths:
- API route handlers (none tested currently)
- Agent endpoint (`/api/agent/fortune`)
- Fortune enrichment logic (categories, tags, author extraction)
- Config layer
- L402 middleware

## Process

1. **Pick** the focus area that has the most unfixed issues (check git log for recent QA commits)
2. **Analyze** — grep/read the relevant files, identify specific issues
3. **Fix** — make targeted, minimal changes. One concern at a time.
4. **Verify** — run `npx tsc --noEmit` and `npx vitest run` to confirm nothing breaks
5. **Report** — list what you found, what you fixed, and what remains for next pass

## Rules

- Never touch the UI or visual design
- Never add dependencies unless absolutely necessary
- Keep fixes small and reversible
- Always run the type checker and tests after changes
- Don't refactor for aesthetics — only fix real problems
- If a fix is risky, explain the risk and ask before applying
