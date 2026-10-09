import { describe, expect, it } from "vitest";
import { addMonths, dayDisabled, formatSlot, monthGrid, nextBusinessDay, parseLocal, parseTime, snapMinutes, timeSlots, toLocalInput } from "./datetime";

describe("nextBusinessDay", () => {
  it("is tomorrow at 10:00 on a weekday", () => {
    expect(toLocalInput(nextBusinessDay(new Date(2026, 9, 6, 15, 30)))).toBe("2026-10-07T10:00");
  });

  it("skips the weekend from Friday and Saturday", () => {
    expect(toLocalInput(nextBusinessDay(new Date(2026, 9, 9, 9, 0)))).toBe("2026-10-12T10:00");
    expect(toLocalInput(nextBusinessDay(new Date(2026, 9, 10, 23, 59)))).toBe("2026-10-12T10:00");
    expect(toLocalInput(nextBusinessDay(new Date(2026, 9, 11, 0, 1)))).toBe("2026-10-12T10:00");
  });

  it("crosses month and year ends", () => {
    expect(toLocalInput(nextBusinessDay(new Date(2026, 11, 31, 12, 0)))).toBe("2027-01-01T10:00");
  });
});

describe("parseLocal", () => {
  it("round-trips with toLocalInput", () => {
    const date = parseLocal("2026-10-12T09:45");
    expect(date?.getHours()).toBe(9);
    expect(toLocalInput(date)).toBe("2026-10-12T09:45");
  });

  it("accepts a date alone as midnight", () => {
    expect(toLocalInput(parseLocal("2026-02-03"))).toBe("2026-02-03T00:00");
  });

  it("rejects impossible or malformed dates", () => {
    expect(parseLocal("2026-02-30T10:00")).toBeNull();
    expect(parseLocal("2026-13-01T10:00")).toBeNull();
    expect(parseLocal("2026-10-12T24:00")).toBeNull();
    expect(parseLocal("12/10/2026")).toBeNull();
    expect(parseLocal("")).toBeNull();
  });
});

describe("parseTime", () => {
  it("reads 24 hour and am/pm times", () => {
    expect(parseTime("14:30")).toBe(870);
    expect(parseTime("9")).toBe(540);
    expect(parseTime("2:15 pm")).toBe(855);
    expect(parseTime("12am")).toBe(0);
    expect(parseTime("12:00 PM")).toBe(720);
  });

  it("rejects nonsense", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("13 pm")).toBeNull();
    expect(parseTime("10:75")).toBeNull();
    expect(parseTime("soon")).toBeNull();
  });
});

describe("time slots", () => {
  it("has 96 slots of 15 minutes", () => {
    const slots = timeSlots();
    expect(slots).toHaveLength(96);
    expect(slots[1] - slots[0]).toBe(15);
    expect(formatSlot(600)).toBe("10:00 AM");
  });

  it("snaps typed times to the nearest step inside the day", () => {
    expect(snapMinutes(607)).toBe(600);
    expect(snapMinutes(608)).toBe(615);
    expect(snapMinutes(24 * 60 - 1)).toBe(24 * 60 - 15);
  });
});

describe("calendar", () => {
  it("builds a six week grid that starts on Sunday", () => {
    const grid = monthGrid(new Date(2026, 9, 15));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(0);
    expect(toLocalInput(grid[0])).toBe("2026-09-27T00:00");
    expect(grid.some((d) => d.getMonth() === 9 && d.getDate() === 31)).toBe(true);
  });

  it("keeps the day when moving months, clamped to the month's length", () => {
    expect(toLocalInput(addMonths(new Date(2026, 0, 31, 10, 0), 1))).toBe("2026-02-28T10:00");
  });

  it("disables days outside the range but not the boundary days", () => {
    const min = new Date(2026, 9, 9, 15, 0);
    const max = new Date(2026, 9, 20, 8, 0);
    expect(dayDisabled(new Date(2026, 9, 8), min, max)).toBe(true);
    expect(dayDisabled(new Date(2026, 9, 9), min, max)).toBe(false);
    expect(dayDisabled(new Date(2026, 9, 20), min, max)).toBe(false);
    expect(dayDisabled(new Date(2026, 9, 21), min, max)).toBe(true);
  });
});
