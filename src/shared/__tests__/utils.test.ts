import { describe, it, expect } from "vitest";
import { delay, withRetry, timeout, safeJsonParse } from "../index";

describe("shared utils", () => {
  it("delay waits approximately given ms", async () => {
    const start = Date.now();
    await delay(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  it("withRetry retries then succeeds", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error("fail");
      return "ok";
    };
    await expect(withRetry(fn, 3, 5)).resolves.toBe("ok");
    expect(attempts).toBe(2);
  });

  it("timeout rejects after ms", async () => {
    await expect(
      timeout(new Promise<string>((res) => setTimeout(() => res("late"), 50)), 10)
    ).rejects.toThrow("Timeout");
  });

  it("safeJsonParse returns fallback on invalid and parses valid", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    expect(safeJsonParse("nope", { a: 2 })).toEqual({ a: 2 });
  });
});
