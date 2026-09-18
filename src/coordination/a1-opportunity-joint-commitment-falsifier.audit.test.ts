import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function fit(snapshot: WorldSnapshot, anchor: Vec2): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: snapshot.tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "JOINT_COMMITMENT_FALSIFIER",
    referenceResolutionStatus: "RESOLVED",
    referenceUnresolvedReason: null,
    referenceSourceBasisProvenance: "NOT_REQUIRED",
    referenceSourceBasisSourceTick: null,
    referenceSourceBasisAgeTicksAtCommitment: null,
    referenceBasisProvenance: "NOT_REQUIRED",
    referenceBasisSourceTick: null,
    referenceBasisAgeTicks: null,
    resolvedAnchorWorldPosition: { ...anchor },
    commitmentObjectiveSignature: "objective",
    currentObjectiveSignature: "objective",
    commitmentOrientationRegime: "DIRECTIONAL",
    currentOrientationRegime: "DIRECTIONAL",
    currentSamplingSignature: "sampling",
    semanticStatus: "COMPARABLE",
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus: "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance: 0,
    nearestConfirmedSampleId: "audit",
    nearestConfirmedWorldPosition: { ...anchor },
    nearestConfirmedUtility: 1,
    utilityGapFromCurrentBest: 0,
    confirmedReachableCount: 1,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "joint commitment falsifier fixture"
  };
}

function situation(
  world: LabWorld,
  snapshot: WorldSnapshot,
  intent: MotionIntent
): A1Situation {
  return buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0
      ? null
      : world.latestAuthorityA0StepEvidence()
  });
}

function futureSet(
  world: LabWorld,
  currentFit: A1SpatialCommitmentFitEvidence,
  currentSituation: A1Situation,
  horizonSeconds: number
) {
  const futures = buildA1PlayerFutureHypotheses({
    situation: currentSituation,
    horizonSeconds,
    staticTraversal: (from, to, radius, options) =>
      world.staticCircleTraversal(from, to, radius, options)
  });
  const plan = buildA1PlayerFutureInterventionPlan(futures);
  return buildA1SpatialCommitmentPlayerFutureSetEvidence({
    world,
    fit: currentFit,
    snapshot: world.snapshot(),
    plan
  });
}

describe("A1 commitment anchor conflict versus joint same-physics execution", () => {
  it("falsifies anchor-overlap == immediate joint contact when companion cannot reach the anchor in time", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");
      const anchor = {
        x: player.position.x - 0.604891167664243,
        y: player.position.y + 1.339625322141366
      };
      const currentFit = fit(after, anchor);
      const currentSituation = situation(world, after, playerIntent(-1, 1));
      const set = futureSet(world, currentFit, currentSituation, 0.5);
      const h1Anchor = set.futures.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      if (!h1Anchor || h1Anchor.interventionStatus !== "REHEARSABLE") {
        throw new Error("missing H1");
      }
      expect(h1Anchor.occupancy.status).toBe("SAMPLED_PLAYER_FUTURE_OVERLAP");

      const joint = buildA1SpatialCommitmentJointFutureSetEvidence({
        world,
        fit: currentFit,
        situation: currentSituation,
        playerFutureSet: set
      });
      expect(joint.status).toBe("REHEARSED");
      expect(joint.directRealization.status).toBe("REALIZED");
      expect(joint.directRealization.realization?.family).toBe("COMMITMENT_ANCHOR_DIRECT");
      expect(joint.directRealization.realization?.capabilityClipped).toBe(true);
      expect(joint.directRealization.terminalAnchorError).toBeGreaterThan(3);
      const h1Joint = joint.futures.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      if (!h1Joint || h1Joint.status !== "REHEARSED") throw new Error("missing rehearsed H1");
      expect(h1Joint.anchorOccupancyStatus).toBe("SAMPLED_PLAYER_FUTURE_OVERLAP");
      expect(h1Joint.contactFrameCount).toBe(0);
      expect(joint.contactFutureIds).not.toContain("owner-request-continuation");
      expect(joint.noContactRehearsedFutureIds).toContain("owner-request-continuation");

      console.info(`[A1_COMMITMENT_ANCHOR_OVERLAP_WITHOUT_JOINT_CONTACT] ${JSON.stringify({
        sourceTick: joint.sourceTick,
        anchor,
        directRealization: {
          capabilityClipped: joint.directRealization.realization?.capabilityClipped ?? null,
          commandVelocity: joint.directRealization.realization?.commandVelocity ?? null,
          terminalAnchorError: joint.directRealization.terminalAnchorError
        },
        h1: h1Joint,
        contactFutureIds: joint.contactFutureIds,
        noContactRehearsedFutureIds: joint.noContactRehearsedFutureIds,
        interpretation: "The fresh Owner future crosses the exact commitment anchor, but the physically reachable direct-to-anchor companion counterfactual remains too far away to contact the player in the same 0.5 s horizon. Anchor occupancy conflict is therefore not equivalent to immediate joint interference."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("positive control: detects reciprocal contact when player and commitment realization actually converge in time", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const before = world.snapshot();
      const anchor = { x: 5.5, y: 4 };
      const currentFit = fit(before, anchor);
      const currentSituation = situation(world, before, playerIntent(1, 0));
      const set = futureSet(world, currentFit, currentSituation, 0.75);
      const h1Anchor = set.futures.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      if (!h1Anchor || h1Anchor.interventionStatus !== "REHEARSABLE") {
        throw new Error("missing H1");
      }
      expect(h1Anchor.occupancy.status).toBe("SAMPLED_PLAYER_FUTURE_OVERLAP");

      const joint = buildA1SpatialCommitmentJointFutureSetEvidence({
        world,
        fit: currentFit,
        situation: currentSituation,
        playerFutureSet: set
      });
      expect(joint.status).toBe("REHEARSED");
      expect(joint.directRealization.realization?.capabilityClipped).toBe(false);
      expect(joint.directRealization.terminalAnchorError).toBeLessThan(1e-9);
      const h1Joint = joint.futures.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      if (!h1Joint || h1Joint.status !== "REHEARSED") throw new Error("missing rehearsed H1");
      expect(h1Joint.contactFrameCount).toBeGreaterThan(0);
      expect(h1Joint.firstContactStepIndex).not.toBeNull();
      expect(joint.contactFutureIds).toContain("owner-request-continuation");

      console.info(`[A1_COMMITMENT_JOINT_CONTACT_POSITIVE_CONTROL] ${JSON.stringify({
        sourceTick: joint.sourceTick,
        anchor,
        directRealization: {
          capabilityClipped: joint.directRealization.realization?.capabilityClipped ?? null,
          terminalAnchorError: joint.directRealization.terminalAnchorError
        },
        h1: h1Joint,
        contactFutureIds: joint.contactFutureIds,
        interpretation: "When player and direct commitment realization actually converge in the same physics and time horizon, reciprocal contact frames are observed. Joint rehearsal therefore distinguishes true spatiotemporal interference from anchor-only conflict."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
