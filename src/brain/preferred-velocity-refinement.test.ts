import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { Vec2, WorldSnapshot } from "../world/types";
import { evaluateSpatialLocomotion } from "./spatial-locomotion";
import { refinePreferredVelocity } from "./preferred-velocity-refinement";

function angleError(a: Vec2, b: Vec2): number {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const dot = (a.x * b.x + a.y * b.y) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function buildInput(world: LabWorld, snapshot: WorldSnapshot, target: Vec2) {
  const companion = snapshot.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("missing companion");
  const query = (from: Vec2, to: Vec2, radius: number) => world.staticCircleTraversal(from, to, radius);
  const routePlan = planStaticShadowRoute({ snapshot, start: companion.position, target, radius: companion.radius, query });
  return { snapshot, relationshipTarget: target, routePlan, query };
}

describe("S4 preferred velocity refinement", () => {
  it("can interpolate between coarse headings and move closer to the exact route direction", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.snapshot();
      const target = { x: 4, y: 3.47 };
      const input = buildInput(world, snapshot, target);
      const decision = evaluateSpatialLocomotion(input);
      const refinement = refinePreferredVelocity(decision, input.query);
      const companion = snapshot.actors.find((actor) => actor.id === "companion")!;
      const exact = { x: target.x - companion.position.x, y: target.y - companion.position.y };
      expect(angleError(refinement.refinedMove, exact)).toBeLessThanOrEqual(angleError(refinement.coarseMove, exact) + 1e-9);
      expect(refinement.staticClear).toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("never accepts a refinement whose short-horizon whole-body traversal is blocked", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const snapshot = world.snapshot();
      const target = { x: 3, y: 4 };
      const input = buildInput(world, snapshot, target);
      const decision = evaluateSpatialLocomotion(input);
      const refinement = refinePreferredVelocity(decision, input.query);
      if (refinement.source === "weighted-local-refinement") {
        expect(refinement.staticClear).toBe(true);
      } else {
        expect(refinement.refinedMove).toEqual(refinement.coarseMove);
      }
    } finally {
      world.dispose();
    }
  });

  it("is deterministic for identical spatial evidence", async () => {
    const world = await LabWorld.create("doorway");
    try {
      const snapshot = world.snapshot();
      const input = buildInput(world, snapshot, { x: 4.7, y: 4.2 });
      const decisionA = evaluateSpatialLocomotion(input);
      const decisionB = evaluateSpatialLocomotion(input);
      const a = refinePreferredVelocity(decisionA, input.query);
      const b = refinePreferredVelocity(decisionB, input.query);
      expect(a).toEqual(b);
    } finally {
      world.dispose();
    }
  });
});
