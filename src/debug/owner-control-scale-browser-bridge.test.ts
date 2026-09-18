import { describe, expect, it } from "vitest";
import { scaleOwnerControlMove, validateOwnerControlScale } from "./owner-control-scale-browser-bridge";

describe("Owner control scale apparatus", () => {
  it("preserves ordinary runtime input at scale 1", () => {
    expect(scaleOwnerControlMove({ x: 0.6, y: -0.8 }, 1)).toEqual({ x: 0.6, y: -0.8 });
  });

  it("scales the Owner MotionIntent magnitude without changing direction", () => {
    expect(scaleOwnerControlMove({ x: 1, y: 0 }, 0.2)).toEqual({ x: 0.2, y: 0 });
    expect(scaleOwnerControlMove({ x: 0, y: -1 }, 0.4)).toEqual({ x: 0, y: -0.4 });
  });

  it("accepts only finite [0,1] test scales", () => {
    expect(validateOwnerControlScale(0)).toBe(0);
    expect(validateOwnerControlScale(0.2)).toBe(0.2);
    expect(validateOwnerControlScale(1)).toBe(1);
    expect(() => validateOwnerControlScale(-0.1)).toThrow();
    expect(() => validateOwnerControlScale(1.01)).toThrow();
    expect(() => validateOwnerControlScale(Number.NaN)).toThrow();
  });
});
