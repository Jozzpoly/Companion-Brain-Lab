import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type {
  ActorSnapshot,
  StaticCircleOccupancyResult,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { LabWorld } from "../world/world";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";

function snapshot(id: "open" | "pillar", tick = 0): WorldSnapshot {
  const spec = scenario(id);
  const actors: ActorSnapshot[] = spec.actors.map((actor) => ({
    id: actor.id,
    position: { ...actor.position },
    radius: actor.radius,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  }));
  return {
    tick,
    scenarioId: id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

function fit(
  tick: number,
  anchor: Vec2 | null,
  unresolved = false
): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "MATERIAL_AUDIT_CONTROL",
    referenceResolutionStatus: unresolved ? "UNRESOLVED" : "RESOLVED",
    referenceUnresolvedReason: unresolved ? "CURRENT_BASIS_MISSING" : null,
    referenceSourceBasisProvenance: "NOT_REQUIRED",
    referenceSourceBasisSourceTick: null,
    referenceSourceBasisAgeTicksAtCommitment: null,
    referenceBasisProvenance: unresolved ? "UNRESOLVED" : "NOT_REQUIRED",
    referenceBasisSourceTick: null,
    referenceBasisAgeTicks: null,
    resolvedAnchorWorldPosition: anchor ? { ...anchor } : null,
    commitmentObjectiveSignature: "objective",
    currentObjectiveSignature: "objective",
    commitmentOrientationRegime: "DIRECTIONLESS",
    currentOrientationRegime: "DIRECTIONLESS",
    currentSamplingSignature: "sampling",
    semanticStatus: "COMPARABLE",
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus: unresolved ? "NON_COMPARABLE" : "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance: unresolved ? null : 0,
    nearestConfirmedSampleId: unresolved ? null : "audit",
    nearestConfirmedWorldPosition: unresolved || !anchor ? null : { ...anchor },
    nearestConfirmedUtility: unresolved ? null : 1,
    utilityGapFromCurrentBest: unresolved ? null : 0,
    confirmedReachableCount: unresolved ? 0 : 1,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "material audit fixture"
  };
}

function blockedTraversal(
  from: Vec2,
  to: Vec2,
  radius: number
): StaticCircleTraversalResult {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance,
    clear: false,
    blocker: {
      label: "synthetic.wall",
      distance: 0.1,
      fraction: distance > 0 ? Math.min(1, 0.1 / distance) : 0,
      hitCenter: { ...from },
      contactPoint: { ...from },
      normal: { x: -1, y: 0 }
    }
  };
}

describe("A1 exact-anchor material qualification", () => {
  it("proves an exact open-world anchor is physically represented independently of sampled mesh proximity", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = snapshot("open");
      const anchor = { x: 4, y: 4 };
      const evidence = buildA1SpatialCommitmentMaterialEvidence({
        fit: fit(before.tick, anchor),
        snapshot: before,
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });

      expect(evidence.status).toBe("STATIC_ROUTE_REACHABLE");
      expect(evidence.occupancyTargetClear).toBe(true);
      expect(evidence.hardRouteReachable).toBe(true);
      expect(evidence.hardRouteTruth?.hardStatus).toBe("direct");
    } finally {
      world.dispose();
    }
  });

  it("proves a pillar-interior anchor is materially blocked at the exact target rather than merely absent from relational samples", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const before = snapshot("pillar");
      const anchor = { x: 6, y: 4 };
      const evidence = buildA1SpatialCommitmentMaterialEvidence({
        fit: fit(before.tick, anchor),
        snapshot: before,
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });

      expect(evidence.status).toBe("STATIC_TARGET_BLOCKED");
      expect(evidence.targetOccupancy?.clear).toBe(false);
      expect(evidence.targetOccupancy?.blockers).toContain("pillar.center");
      expect(evidence.hardRouteTruth?.hardStatus).toBe("invalid-target");
      expect(evidence.hardRouteReachable).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("keeps clear-target route failure distinct from target occupancy failure", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = snapshot("open");
      const anchor = { x: 4, y: 4 };
      const evidence = buildA1SpatialCommitmentMaterialEvidence({
        fit: fit(before.tick, anchor),
        snapshot: before,
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
        query: blockedTraversal
      });

      expect(evidence.status).toBe("STATIC_ROUTE_UNREACHABLE");
      expect(evidence.occupancyTargetClear).toBe(true);
      expect(evidence.routerTargetClear).toBe(true);
      expect(evidence.hardRouteTruth?.hardStatus).toBe("unreachable");
      expect(evidence.hardRouteReachable).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("surfaces disagreement between live occupancy and router target validity instead of choosing one", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const before = snapshot("pillar");
      const anchor = { x: 6, y: 4 };
      const fakeClearOccupancy = (center: Vec2, radius: number): StaticCircleOccupancyResult => ({
        center: { ...center },
        radius,
        clear: true,
        blockers: []
      });
      const evidence = buildA1SpatialCommitmentMaterialEvidence({
        fit: fit(before.tick, anchor),
        snapshot: before,
        occupancy: fakeClearOccupancy,
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });

      expect(evidence.status).toBe("STATIC_QUERY_DISAGREEMENT");
      expect(evidence.occupancyTargetClear).toBe(true);
      expect(evidence.routerTargetClear).toBe(false);
      expect(evidence.hardRouteTruth?.hardStatus).toBe("invalid-target");
    } finally {
      world.dispose();
    }
  });

  it("performs no material query when the spatial reference itself is unresolved", () => {
    const before = snapshot("open", 5);
    let queryCount = 0;
    const evidence = buildA1SpatialCommitmentMaterialEvidence({
      fit: fit(before.tick, null, true),
      snapshot: before,
      occupancy: () => {
        queryCount += 1;
        throw new Error("occupancy must not run");
      },
      query: () => {
        queryCount += 1;
        throw new Error("traversal must not run");
      }
    });

    expect(evidence.status).toBe("REFERENCE_UNRESOLVED");
    expect(evidence.targetOccupancy).toBeNull();
    expect(evidence.hardRouteTruth).toBeNull();
    expect(queryCount).toBe(0);
  });

  it("emits machine-readable exact-anchor evidence without movement authority", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const before = snapshot("pillar");
      const anchors = [
        { label: "clear", anchor: { x: 4.8, y: 4 } },
        { label: "blocked", anchor: { x: 6, y: 4 } }
      ];
      const specimens = anchors.map(({ label, anchor }) => ({
        label,
        evidence: buildA1SpatialCommitmentMaterialEvidence({
          fit: fit(before.tick, anchor),
          snapshot: before,
          occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
          query: (from, to, radius, options) =>
            world.staticCircleTraversal(from, to, radius, options)
        })
      }));

      console.info(`[A1_SPATIAL_COMMITMENT_MATERIAL_EVIDENCE] ${JSON.stringify({
        specimens,
        interpretation: "Exact-anchor static occupancy and deterministic route truth are independent of relational sampling. A blocked exact anchor can therefore be established materially, while clear-but-route-unreachable and query disagreement remain separate evidence states. No movement policy or authority is produced."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
