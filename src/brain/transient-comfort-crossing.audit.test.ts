import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { evaluateR1SpatialLocomotion } from "./r1-hard-comfort-spatial";

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

describe("behavior-forensics: transient static comfort crossing", () => {
  it("can rehabilitate a hard-clear move whose swept comfort envelope is blocked while its endpoint is comfort-clear", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "transient comfort crossing",
      width: 8,
      height: 5,
      actors: [
        { id: "player", position: { x: 6.5, y: 4 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 2, y: 2 }, radius: 0.3, speed: 3 }
      ],
      obstacles: [
        { id: "near-path", x: 2.55, y: 2.34, width: 0.25, height: 0.25 }
      ]
    };
    const physical = await RapierPhysicalWorld.create(spec);
    try {
      const snapshot: WorldSnapshot = {
        tick: 0,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors: physical.snapshot(),
        obstacles: spec.obstacles
      };
      const companion = actor(snapshot, "companion");
      const target = { x: 5, y: 2 };
      const query = (
        from: Vec2,
        to: Vec2,
        radius: number,
        options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]
      ) => physical.staticCircleTraversal(from, to, radius, options);
      const routePlan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        clearance: 0,
        query
      });
      expect(routePlan.status).toBe("direct");

      const evaluation = evaluateR1SpatialLocomotion({
        snapshot,
        relationshipTarget: target,
        routePlan,
        query,
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius),
        previousMove: { x: 0, y: 0 }
      });

      const candidate = evaluation.decision.candidates.find((entry) => entry.id === "d0.s0.70");
      expect(candidate).toBeDefined();
      const hardTraversal = query(companion.position, candidate!.predictedPosition, companion.radius);
      const comfortTraversal = query(companion.position, candidate!.predictedPosition, companion.radius + 0.08);
      const comfortEndpoint = physical.staticCircleOccupancy(candidate!.predictedPosition, companion.radius + 0.08);

      console.info("TRANSIENT_COMFORT_CROSSING", JSON.stringify({
        candidateId: candidate!.id,
        hardTraversalClear: hardTraversal.clear,
        comfortTraversalClear: comfortTraversal.clear,
        comfortEndpointClear: comfortEndpoint.clear,
        rehabilitated: evaluation.repair.rehabilitatedCandidateIds.includes(candidate!.id),
        comfortViolatedEndpoint: evaluation.repair.comfortViolatedCandidateIds.includes(candidate!.id),
        selectedCandidateId: evaluation.decision.selectedCandidateId,
        selectedState: evaluation.decision.state,
        score: candidate!.score
      }));

      expect(hardTraversal.clear).toBe(true);
      expect(comfortTraversal.clear).toBe(false);
      expect(comfortEndpoint.clear).toBe(true);
      expect(evaluation.repair.rehabilitatedCandidateIds).toContain(candidate!.id);
      expect(evaluation.repair.comfortViolatedCandidateIds).not.toContain(candidate!.id);
    } finally {
      physical.dispose();
    }
  });
});