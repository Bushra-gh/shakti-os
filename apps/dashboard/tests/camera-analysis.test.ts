import { describe, expect, it } from "vitest";
import { frameChangeScore } from "../lib/camera-analysis";

describe("camera frame analysis", () => {
  it("returns no change for identical frames", () => {
    const frame = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(frameChangeScore(frame, new Uint8ClampedArray(frame))).toBe(0);
  });

  it("normalizes RGB changes while ignoring alpha", () => {
    const previous = new Uint8ClampedArray([0, 0, 0, 10]);
    const current = new Uint8ClampedArray([255, 255, 255, 200]);
    expect(frameChangeScore(previous, current)).toBe(1);
  });

  it("does not compare frames with different dimensions", () => {
    expect(frameChangeScore(new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray())).toBe(0);
  });
});
