import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";
import { buildA1SpatialCommitmentDeliberationFrame } from "./a1-spatial-commitment-deliberation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function fit(
  snapshot: WorldSnapshot,
  anchor: Vec2 | null,
  semanticStatus: A1SpatialCommitmentFitEvidence["semanticStatus"] = "COMPARABLE"
): A1SpatialCommitmentFitEvidence {
  const unresolved = anchor === null;
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: snapshot.tick,
    commitmentSourceTick: 0,
    referenceFrame: unresolved ? "PLAYER_RIGID" : "WORLD_FIXED",
    anchorProvenance: "DELIBERATION_AUDIT",
    referenceResolutionStatus: unresolved ? "UNRESOLVED" : "RESOLVED",
    referenceUnresolvedReason: unresolved ? "CURRENT_BASIS_MISSING" : null,
    referenceSourceBasisProvenance: unresolved
      ? "CANONICAL_SEMANTIC_ORIENTATION"
      : "NOT_REQUIRED",
    referenceSourceBasisSourceTick: unresolved ? 0 : null,
    referenceSourceBasisAgeTicksAtCommitment: unresolved ? 0 : null,
    referenceBasisProvenance: unresolved ? "UNRESOLVED" : "NOT_REQUIRED",
    referenceBasisSourceTick: null,
    referenceBasisAgeTicks: null,
    resolvedAnchorWorldPosition: anchor ? { ...anchor } : null,
    commitmentObjectiveSignature: "objective",
    currentObjectiveSignature: "objective",
    commitmentOrientationRegime: "DIRECTIONAL",
    currentOrientationRegime:
      semanticStatus === "ORIENTATION_REGIME_CHANGED" ? "DIRECTIONLESS" : "DIRECTIONAL",
    currentSamplingSignature: "sampling",
    semanticStatus,
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus:
      unresolved || semanticStatus !== "COMPARABLE"
        ? "NON_COMPARABLE"
        : "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance:
      unresolved || semanticStatus !== "COMPARABLE" ? null : 0,
    nearestConfirmedSampleId:
      unresolved || semanticStatus !== "COMPARABLE" ? null : "audit",
    nearestConfirmedWorldPosition:
      unresolved || semanticStatus !== "COMPARABLE" ? null : { ...anchor! },
    nearestConfirmedUtility:
      unresolved || semanticStatus !== "COMPARABLE" ? null : 1,
    utilityGapFromCurrentBest:
      unresolved || semanticStatus !== "COMPARABLE" ? null : 0,
    confirmedReachableCount:
      unresolved || semanticStatus !== "COMPARABLE" ? 0 : 1,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "deliberation audit fixture"
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

function fullReview(
  world: LabWorld,
  currentFit: A1SpatialCommitmentFitEvidence,
  currentSituation: A1Situation,
  horizonSeconds: number
) {
  const hypotheses = buildA1PlayerFutureHypotheses({
    situation: currentSituation,
    horizonSeconds,
    staticTraversal: (from, to, radius, options) =>
      world.staticCircleTraversal(from, to, radius, options)
  });
  const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const playerFutureSet = buildA1SpatialCommitmentPlayerFutureSetEvidence({
    world,
    fit: currentFit,
    snapshot: world.snapshot(),
    plan
  });
  const jointFutureSet = buildA1SpatialCommitmentJointFutureSetEvidence({
    world,
    fit: currentFit,
    situation: currentSituation,
    playerFutureSet
  });
  return buildA1SpatialCommitmentReviewEvidence(
    currentFit,
    null,
    null,
    playerFutureSet,
    jointFutureSet
  );
}

function option(
  frame: ReturnType<typeof buildA1SpatialCommitmentDeliberationFrame>,
  name: "MAINTAIN_COMMITMENT" | "DEFER_EXECUTION" | "YIELD_TO_OWNER_FLOW" | "REFRAME_COMMITMENT"
) {
  const value = frame.options.find((candidate) => candidate.option === name);
  if (!value) throw new Error(`missing deliberation option ${name}`);
  return value;
}

describe("A1 spatial commitment shadow deliberation", () => {
  it("does not turn Owner anchor overlap into yield evidence when same-physics joint execution has no contact", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");
      const currentFit = fit(after, {
        x: player.position.x - 0.604891167664243,
        y: player.position.y + 1.339625322141366
      });
      const currentSituation = situation(world, after, playerIntent(-1, 1));
      const review = fullReview(world, currentFit, currentSituation, 0.5);
      const frame = buildA1SpatialCommitmentDeliberationFrame(review);

      expect(review.playerFutureOverlapIds).toContain("owner-request-continuation");
      expect(review.jointNoContactRehearsedFutureIds).toContain("owner-request-continuation");
      const yieldOption = option(frame, "YIELD_TO_OWNER_FLOW");
      expect(yieldOption.reasonsForConsideration).not.toContain("OWNER_REQUEST_JOINT_CONTACT");
      expect(yieldOption.reasonsAgainstPrematureConclusion).toContain(
        "OWNER_REQUEST_ANCHOR_OVERLAP_WITHOUT_JOINT_CONTACT"
      );
      expect(option(frame, "MAINTAIN_COMMITMENT").reasonsForConsideration).toEqual(
        expect.arrayContaining([
          "SEMANTIC_COMPARABILITY_PRESENT",
          "REFERENCE_REMAINS_RESOLVED"
        ])
      );
      expect(frame.rightOfWayPriorityClaim).toBe("NONE_NOT_ESTABLISHED");
      expect(frame.decisionClaim).toBe("NONE_DELIBERATION_ONLY");
      expect(frame.selectionClaim).toBe("NONE");
      expect(frame.runtimeAuthorityClaim).toBe("NONE");
    } finally {
      world.dispose();
    }
  });

  it("opens yield-to-owner-flow as a deliberation hypothesis only when Owner future has reciprocal joint contact", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const before = world.snapshot();
      const currentFit = fit(before, { x: 5.5, y: 4 });
      const currentSituation = situation(world, before, playerIntent(1, 0));
      const review = fullReview(world, currentFit, currentSituation, 0.75);
      const frame = buildA1SpatialCommitmentDeliberationFrame(review);
      const yieldOption = option(frame, "YIELD_TO_OWNER_FLOW");

      expect(review.jointContactFutureIds).toContain("owner-request-continuation");
      expect(yieldOption.reasonsForConsideration).toContain("OWNER_REQUEST_JOINT_CONTACT");
      expect(option(frame, "DEFER_EXECUTION").reasonsForConsideration).toContain(
        "OWNER_REQUEST_JOINT_CONTACT"
      );
      expect(frame.rightOfWayPriorityClaim).toBe("NONE_NOT_ESTABLISHED");
      expect(frame.optionOrderingClaim).toBe("NONE_ARRAY_ORDER_NOT_PREFERENCE");
      expect(frame.evidenceInterpretationClaim).toBe(
        "REASONS_FOR_CONSIDERATION_NOT_ACTION_JUSTIFICATION"
      );

      console.info(`[A1_SPATIAL_COMMITMENT_DELIBERATION_OWNER_CONTACT] ${JSON.stringify({
        sourceTick: frame.sourceTick,
        ownerRequestFutureId: frame.ownerRequestFutureId,
        options: frame.options,
        rightOfWayPriorityClaim: frame.rightOfWayPriorityClaim,
        decisionClaim: frame.decisionClaim,
        selectionClaim: frame.selectionClaim,
        runtimeAuthorityClaim: frame.runtimeAuthorityClaim,
        interpretation: "Reciprocal same-physics contact under the Owner-request future makes yield/defer questions worth deliberating, but the frame establishes no right-of-way priority, probability, ranking, selected response or movement authority."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("raises reframe consideration on semantic regime break without fabricating an execution decision", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const currentFit = fit(
        before,
        { x: 4, y: 4 },
        "ORIENTATION_REGIME_CHANGED"
      );
      const review = buildA1SpatialCommitmentReviewEvidence(currentFit);
      const frame = buildA1SpatialCommitmentDeliberationFrame(review);
      const reframe = option(frame, "REFRAME_COMMITMENT");

      expect(reframe.reasonsForConsideration).toContain(
        "SEMANTIC_ORIENTATION_REGIME_CHANGED"
      );
      expect(option(frame, "MAINTAIN_COMMITMENT").reasonsForConsideration)
        .not.toContain("SEMANTIC_COMPARABILITY_PRESENT");
      expect(frame.decisionClaim).toBe("NONE_DELIBERATION_ONLY");
      expect(frame.runtimeAuthorityClaim).toBe("NONE");
    } finally {
      world.dispose();
    }
  });
});
