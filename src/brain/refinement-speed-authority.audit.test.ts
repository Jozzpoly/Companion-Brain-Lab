import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { ScenarioId, Vec2 } from "../world/types";
import { refinePreferredVelocity } from "./preferred-velocity-refinement";
import { evaluateSpatialLocomotion } from "./spatial-locomotion";

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

describe("behavior-forensics: refinement speed authority", () => {
  it("characterizes how much weighted NATURAL refinement changes coarse speed", async () => {
    const records: Array<{
      scenario: ScenarioId;
      target: Vec2;
      coarse: number;
      refined: number;
      delta: number;
      ratio: number;
      source: string;
      candidate: string;
    }> = [];

    for (const scenario of ["open", "pillar", "doorway", "head-on"] as const) {
      const world = await LabWorld.create(scenario);
      try {
        const snapshot = world.snapshot();
        const companion = snapshot.actors.find((actor) => actor.id === "companion");
        if (!companion) throw new Error("missing companion");
        const query = (
          from: Vec2,
          to: Vec2,
          radius: number,
          options?: Parameters<LabWorld["staticCircleTraversal"]>[3]
        ) => world.staticCircleTraversal(from, to, radius, options);

        for (let x = 1; x <= 11; x += 1) {
          for (let y = 1; y <= 7; y += 1) {
            const target = { x, y };
            const route = planStaticShadowRoute({
              snapshot,
              start: companion.position,
              target,
              radius: companion.radius,
              query
            });
            if (route.status !== "direct" && route.status !== "routed") continue;
            const decision = evaluateSpatialLocomotion({
              snapshot,
              relationshipTarget: target,
              routePlan: route,
              query
            });
            const refinement = refinePreferredVelocity(decision, query);
            const coarse = magnitude(refinement.coarseMove);
            const refined = magnitude(refinement.refinedMove);
            if (coarse < 0.05) continue;
            records.push({
              scenario,
              target,
              coarse,
              refined,
              delta: refined - coarse,
              ratio: refined / coarse,
              source: refinement.source,
              candidate: decision.selectedCandidateId
            });
          }
        }
      } finally {
        world.dispose();
      }
    }

    const weighted = records.filter((record) => record.source === "weighted-local-refinement");
    const ranked = [...weighted]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 12);
    console.info("REFINEMENT_SPEED_AUTHORITY", JSON.stringify({
      evaluated: records.length,
      weighted: weighted.length,
      maximumAbsoluteDelta: ranked[0]?.delta ?? 0,
      examples: ranked
    }));

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => Number.isFinite(record.ratio))).toBe(true);
    expect(weighted.length).toBeGreaterThan(0);
  });
});