import { describe, expect, it, vi } from "vitest";
import type { StaticCircleTraversalResult, StaticTraversalOptions, Vec2 } from "../world/types";
import { bindWorldStaticTraversalQuery } from "./static-traversal-query-adapter";

function result(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: Math.hypot(to.x - from.x, to.y - from.y),
    clear: true,
    blocker: null
  };
}

describe("foundation app traversal-query adapter", () => {
  it("forwards initial-overlap egress options without truncating the query contract", () => {
    const staticCircleTraversal = vi.fn((
      from: Vec2,
      to: Vec2,
      radius: number,
      _options?: StaticTraversalOptions
    ) => result(from, to, radius));
    const query = bindWorldStaticTraversalQuery({ staticCircleTraversal });
    const from = { x: 5.16, y: 4 };
    const to = { x: 4.5, y: 4 };
    const options = { initialOverlap: "allow-egress" as const };

    expect(query(from, to, 0.3, options).clear).toBe(true);
    expect(staticCircleTraversal).toHaveBeenCalledOnce();
    expect(staticCircleTraversal).toHaveBeenCalledWith(from, to, 0.3, options);
  });

  it("preserves ordinary default query semantics when no options are supplied", () => {
    const staticCircleTraversal = vi.fn((
      from: Vec2,
      to: Vec2,
      radius: number,
      _options?: StaticTraversalOptions
    ) => result(from, to, radius));
    const query = bindWorldStaticTraversalQuery({ staticCircleTraversal });
    const from = { x: 1, y: 1 };
    const to = { x: 2, y: 1 };

    query(from, to, 0.3);
    expect(staticCircleTraversal).toHaveBeenCalledWith(from, to, 0.3, undefined);
  });
});
