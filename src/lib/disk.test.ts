import { describe, expect, it } from "vitest";
import { pickToStop } from "./disk";

describe("disk guard", () => {
  it("stops the largest sandbox only once free space drops under the reserve", () => {
    const usage = [
      { sessionId: "a", bytes: 300 },
      { sessionId: "b", bytes: 9_000 },
      { sessionId: "c", bytes: 50 },
    ];
    expect(pickToStop(usage, 5_000, 2_000)).toBeNull();
    expect(pickToStop(usage, 1_000, 2_000)?.sessionId).toBe("b");
    expect(pickToStop([], 0, 2_000)).toBeNull();
  });
});
