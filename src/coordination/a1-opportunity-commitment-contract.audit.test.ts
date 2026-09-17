import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  a1RelationshipObjectiveSignature,
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";
import {
  buildA1SpatialCommitmentFitEvidence,
  type A1SpatialCommitmentDeclaration
} from "./a1-spatial-commitment-evidence";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(id: "player" | "companion", position: Vec2): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(tick: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 40,
    height: 32,
    actors: [actor("player", { x: 20, y: 16 }), actor("companion", { x: 15, y: 16 })],
    obstacles: []
  };
}

function noOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "commitment contract audit: directionless controlled ring"
  };
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: distance(from, to),
    clear: true,
    blocker: null
  };
}

const OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

const OTHER_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.8, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

const SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [1.45],
  nearBestUtilityWindow: 0
};

function observe(tick: number, routeBudget: number) {
  const field = sampleA1RelationshipSemanticField({
    orientation: noOrientation(tick),
    objective: OBJECTIVE,
    sampling: SAMPLING
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshot(tick),
    query: clearTraversal,
    routeBudget,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  return { field, projection, accessibility };
}

function projectedWorldPosition(observation: ReturnType<typeof observe>, sampleId: string): Vec2 {
  const sample = observation.projection.samples.find((candidate) => candidate.sampleId === sampleId);
  if (!sample) throw new Error(`Commitment contract audit lost ${sampleId}.`);
  return sample.worldPosition;
}

function declaration(
  sourceTick: number,
  objectiveSignature: string
): A1SpatialCommitmentDeclaration {
  return {
    kind: "A1_SPATIAL_COMMITMENT_DECLARATION",
    sourceTick,
    objectiveSignature,
    orientationRegime: "DIRECTIONLESS",
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "AUDIT_CONTROL"
  };
}

describe("A1 observational spatial commitment fit contract", () => {
  it("reports exact sampled-mesh pressure only under complete coverage", () => {
    const observation = observe(0, 16);
    const anchor = projectedWorldPosition(observation, "r0.b2");
    const evidence = buildA1SpatialCommitmentFitEvidence({
      declaration: declaration(0, observation.field.objectiveSignature),
      resolvedAnchorWorldPosition: anchor,
      ...observation
    });

    expect(evidence.semanticStatus).toBe("COMPARABLE");
    expect(evidence.coverage).toBe("COMPLETE");
    expect(evidence.pressureStatus).toBe("EXACT_ON_SAMPLED_MESH");
    expect(evidence.sampledPressureDistance).toBeLessThanOrEqual(1e-12);
    expect(evidence.nearestConfirmedSampleId).toBe("r0.b2");
    expect(evidence.samplingTruth).toBe("SAMPLED_MESH_ONLY");
  });

  it("downgrades nearest-confirmed pressure to an upper bound under partial coverage", () => {
    const full = observe(0, 16);
    const partial = observe(1, 4);
    const anchor = projectedWorldPosition(full, "r0.b2");
    const evidence = buildA1SpatialCommitmentFitEvidence({
      declaration: declaration(0, partial.field.objectiveSignature),
      resolvedAnchorWorldPosition: anchor,
      ...partial
    });

    expect(partial.accessibility.untestedSampleIds).toContain("r0.b2");
    expect(evidence.semanticStatus).toBe("COMPARABLE");
    expect(evidence.coverage).toBe("PARTIAL");
    expect(evidence.pressureStatus).toBe("CONFIRMED_UPPER_BOUND");
    expect(evidence.sampledPressureDistance).toBeGreaterThan(1);
    expect(evidence.untestedCount).toBeGreaterThan(0);
  });

  it("refuses spatial pressure interpretation when commitment meaning changed", () => {
    const observation = observe(2, 16);
    const anchor = projectedWorldPosition(observation, "r0.b2");
    const evidence = buildA1SpatialCommitmentFitEvidence({
      declaration: declaration(0, a1RelationshipObjectiveSignature(OTHER_OBJECTIVE)),
      resolvedAnchorWorldPosition: anchor,
      ...observation
    });

    expect(evidence.semanticStatus).toBe("OBJECTIVE_CHANGED");
    expect(evidence.pressureStatus).toBe("NON_COMPARABLE");
    expect(evidence.sampledPressureDistance).toBeNull();
    expect(evidence.nearestConfirmedSampleId).toBeNull();
    expect(evidence.utilityGapFromCurrentBest).toBeNull();
  });

  it("emits one machine-readable evidence marker spanning the three epistemic states", () => {
    const full = observe(3, 16);
    const partial = observe(4, 4);
    const anchor = projectedWorldPosition(full, "r0.b2");
    const exact = buildA1SpatialCommitmentFitEvidence({
      declaration: declaration(3, full.field.objectiveSignature),
      resolvedAnchorWorldPosition: anchor,
      ...full
    });
    const bounded = buildA1SpatialCommitmentFitEvidence({
      declaration: declaration(3, partial.field.objectiveSignature),
      resolvedAnchorWorldPosition: anchor,
      ...partial
    });
    const changedMeaning = buildA1SpatialCommitmentFitEvidence({
      declaration: declaration(3, a1RelationshipObjectiveSignature(OTHER_OBJECTIVE)),
      resolvedAnchorWorldPosition: anchor,
      ...full
    });

    console.info(`[A1_SPATIAL_COMMITMENT_FIT_CONTRACT] ${JSON.stringify({
      exact,
      partialUpperBound: bounded,
      objectiveChanged: changedMeaning
    })}`);
  });
});