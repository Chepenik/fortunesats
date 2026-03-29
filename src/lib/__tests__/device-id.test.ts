import { describe, it, expect } from "vitest";
import { getDisplayName } from "@/lib/device-id";

describe("getDisplayName", () => {
  it("generates a deterministic pseudonym from a UUID", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const name1 = getDisplayName(id);
    const name2 = getDisplayName(id);
    expect(name1).toBe(name2); // deterministic
    expect(name1).toMatch(/^\w+-\w+-[A-F0-9]{4}$/); // Adjective-Noun-XXXX format
  });

  it("generates different names for different UUIDs", () => {
    const name1 = getDisplayName("11111111-1111-1111-1111-111111111111");
    const name2 = getDisplayName("22222222-2222-2222-2222-222222222222");
    expect(name1).not.toBe(name2);
  });
});
