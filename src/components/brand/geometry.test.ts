import { describe, expect, it } from "vitest";
import { actorFrame, scatterStars, seededRandom } from "./geometry";

describe("actorFrame", () => {
  it("lifts a top actor out of the edge by the requested share", () => {
    expect(actorFrame("top-right", 0.75, 32)).toMatchObject({ top: "0", right: "32px", translate: "0 -75%" });
  });

  it("centers edge actors along their edge", () => {
    expect(actorFrame("bottom", 0.4).translate).toBe("-50% 40%");
    expect(actorFrame("left", 0.5).translate).toBe("-50% -50%");
  });

  it("clamps the overlap between 0 and 1", () => {
    expect(actorFrame("right", 3).translate).toBe("100% -50%");
    expect(actorFrame("top", -1).translate).toBe("-50% -0%");
  });

  it("enters from inside the card", () => {
    expect(actorFrame("top").enterFrom.y).toBeGreaterThan(0);
    expect(actorFrame("bottom-left").enterFrom.y).toBeLessThan(0);
    expect(actorFrame("left").enterFrom.x).toBeGreaterThan(0);
  });
});

describe("scatterStars", () => {
  it("is deterministic so server and client render the same sky", () => {
    expect(scatterStars(7, 40)).toEqual(scatterStars(7, 40));
    expect(scatterStars(7, 40)).not.toEqual(scatterStars(8, 40));
  });

  it("keeps every star inside the canvas", () => {
    for (const star of scatterStars(3, 200, 400, 300)) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(400);
      expect(star.y).toBeLessThanOrEqual(300);
      expect(star.r).toBeGreaterThan(0.5);
      expect(star.o).toBeLessThanOrEqual(1);
    }
  });

  it("draws values in [0, 1)", () => {
    const next = seededRandom(1);
    for (let i = 0; i < 500; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
