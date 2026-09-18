import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";
import { buildA1SpatialCommitmentOwnerFlowImpactEvidence } from "./a1-spatial-commitment-owner-flow-impact";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";
import { buildA1SpatialCommitmentDeliberationFrame } from "./a1-spatial-commitment-deliberation";
import { buildA1SpatialCommitmentRightOfWayEvidenceDossier } from "./a1-spatial-commitment-right-of-way-dossier";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function fit(snapshot: WorldSnapshot, anchor: Vec2): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: snapshot.tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "RIGHT_OF_WAY_DOSSIER_AUDIT",
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
    reason: "right-of-way dossier audit fixture"
  };
}

function evidence(
  world: LabWorld,
  currentFit: A1SpatialCommitmentFitEvidence,
  horizonSeconds: number,
  playerMove: Vec2 = { x: 1, y: 0 },
  snapshotOverride: WorldSnapshot | null = null
) {
  const snapshot = snapshotOverride ?? world.snapshot();
  const situation = buildA1Situation({
    snapshot,
    playerIntent: playerIntent(playerMove.x, playerMove.y),
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0 ? null : world.latestAuthorityA0StepEvidence()
  });
  const hypotheses = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, to, radius, options) =>
      world.staticCircleTraversal(from, to, radius, options)
  });
  const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const playerFutureSet = buildA1SpatialCommitmentPlayerFutureSetEvidence({
    world,
    fit: currentFit,
    snapshot,
    plan
  });
  const jointFutureSet = buildA1SpatialCommitmentJointFutureSetEvidence({
    world,
    fit: currentFit,
    situation,
    playerFutureSet
  });
  const review = buildA1SpatialCommitmentReviewEvidence(
    currentFit,
    null,
    null,
    playerFutureSet,
    jointFutureSet
  );
  const impact = buildA1SpatialCommitmentOwnerFlowImpactEvidence({
    world,
    fit: currentFit,
    situation,
    horizonSeconds
  });
  return { review, impact };
}

describe("A1 commitment right-of-way evidence dossier", () => {
  it("binds semantic commitment, exact Owner future, joint contact and causal Owner-flow impact without policy", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const currentFit = fit(world.snapshot(), { x: 5.5, y: 4 });
      const { review, impact } = evidence(world, currentFit, 0.75);
      const dossier = buildA1SpatialCommitmentRightOfWayEvidenceDossier({
        review,
        impact
      });
      const deliberation = buildA1SpatialCommitmentDeliberationFrame(
        review,
        dossier
      );

      expect(dossier.semanticStatus).toBe("COMPARABLE");
      expect(deliberation.rightOfWayContext.status).toBe(
        "SUPPLIED_H1_OWNER_FLOW_EVIDENCE"
      );
      expect(deliberation.rightOfWayContext.executionOnlyContactFrameCount)
        .toBe(dossier.executionOnlyContactFrameCount);
      expect(deliberation.rightOfWayContext.peakPlayerProgressDeficitVsHold)
        .toBe(dossier.peakPlayerProgressDeficitVsHold);
      expect(deliberation.rightOfWayContext.evidenceScopeClaim).toBe(
        "H1_CAUSAL_OWNER_FLOW_PLUS_UNWEIGHTED_ALTERNATE_FUTURES"
      );
      expect(deliberation.rightOfWayContext.harmClaim).toBe("NONE");
      expect(deliberation.rightOfWayContext.rightOfWayPriorityClaim).toBe("NONE");
      expect(deliberation.rightOfWayContext.futureWeightingClaim).toBe("NONE");
      expect(deliberation.rightOfWayContext.runtimeAuthorityClaim).toBe("NONE");
      expect(dossier.ownerRequestJointContactFrameCount).toBeGreaterThan(0);
      expect(dossier.executionOnlyContactFrameCount).toBeGreaterThan(0);
      expect(dossier.peakPlayerProgressDeficitVsHold).toBeGreaterThan(0.5);
      expect(dossier.peakPlayerLateralDeltaMagnitudeVsHold).toBeCloseTo(0, 9);
      expect(dossier.sourceAlignmentClaim).toBe(
        "EXACT_SAME_COMMITMENT_H1_HORIZON_DIRECT_COMMAND_AND_JOINT_CONTACT_TRACE"
      );
      expect(dossier.contactToHarmClaim).toBe("NONE_CONTACT_IS_NOT_A_HARM_SCALAR");
      expect(dossier.impactToPriorityClaim).toBe(
        "NONE_MEASURED_OWNER_FLOW_DIFFERENCE_IS_NOT_RIGHT_OF_WAY_PRIORITY"
      );
      expect(dossier.rightOfWayPriorityClaim).toBe("NONE");
      expect(dossier.yieldPolicyClaim).toBe("NONE");
      expect(dossier.decisionClaim).toBe("NONE_EVIDENCE_DOSSIER_ONLY");
      expect(dossier.runtimeAuthorityClaim).toBe("NONE");
    } finally {
      world.dispose();
    }
  });

  it("preserves longitudinal and lateral Owner-flow effects as separate evidence axes", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const currentFit = fit(world.snapshot(), { x: 5.5, y: 4.5 });
      const { review, impact } = evidence(world, currentFit, 0.75);
      const dossier = buildA1SpatialCommitmentRightOfWayEvidenceDossier({
        review,
        impact
      });

      expect(dossier.ownerRequestJointContactFrameCount).toBeGreaterThan(0);
      expect(dossier.peakPlayerProgressDeficitVsHold).toBeGreaterThan(0);
      expect(dossier.peakPlayerLateralDeltaMagnitudeVsHold).toBeGreaterThan(0.02);
      expect(dossier.evidenceAxisClaim).toBe(
        "SEMANTICS_CONTACT_AND_OWNER_FLOW_DIFFERENCE_REMAIN_SEPARATE"
      );
      expect(dossier.scalarScoreClaim).toBe("NONE");
      expect(dossier.harmThresholdClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_RIGHT_OF_WAY_DOSSIER_OBLIQUE] ${JSON.stringify({
        sourceTick: dossier.sourceTick,
        horizonSeconds: dossier.horizonSeconds,
        semanticStatus: dossier.semanticStatus,
        commitmentAnchorWorldPosition: dossier.commitmentAnchorWorldPosition,
        companionCommitmentCommandVelocity: dossier.companionCommitmentCommandVelocity,
        ownerRequestJointContactFrameCount: dossier.ownerRequestJointContactFrameCount,
        executionOnlyContactFrameCount: dossier.executionOnlyContactFrameCount,
        peakPlayerProgressDeficitVsHold: dossier.peakPlayerProgressDeficitVsHold,
        integratedPlayerProgressDeficitSeconds: dossier.integratedPlayerProgressDeficitSeconds,
        peakPlayerLateralDeltaMagnitudeVsHold: dossier.peakPlayerLateralDeltaMagnitudeVsHold,
        integratedPlayerLateralDeviationSeconds: dossier.integratedPlayerLateralDeviationSeconds,
        sourceAlignmentClaim: dossier.sourceAlignmentClaim,
        evidenceAxisClaim: dossier.evidenceAxisClaim,
        contactToHarmClaim: dossier.contactToHarmClaim,
        impactToPriorityClaim: dossier.impactToPriorityClaim,
        harmThresholdClaim: dossier.harmThresholdClaim,
        scalarScoreClaim: dossier.scalarScoreClaim,
        rightOfWayPriorityClaim: dossier.rightOfWayPriorityClaim,
        yieldPolicyClaim: dossier.yieldPolicyClaim,
        decisionClaim: dossier.decisionClaim,
        runtimeAuthorityClaim: dossier.runtimeAuthorityClaim,
        interpretation: "The dossier binds one exact semantic commitment and one exact H1 execution counterfactual to same-physics contact and HOLD-relative Owner-flow effects while keeping longitudinal and lateral disturbance separate. It establishes no harm threshold, scalar score, priority or yield policy."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("preserves alternate H2/H3 joint-future context without treating it as H1 Owner-flow impact or a vote", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const after = world.step([
        playerIntent(1, 0),
        { actorId: "companion", move: { x: 0, y: 0 } }
      ]);
      const currentFit = fit(after, { x: 5.5, y: 4 });
      const { review, impact } = evidence(
        world,
        currentFit,
        0.75,
        { x: -1, y: 0 },
        after
      );
      const dossier = buildA1SpatialCommitmentRightOfWayEvidenceDossier({
        review,
        impact
      });

      expect(dossier.ownerFlowImpactScopeClaim).toBe("H1_OWNER_REQUEST_ONLY");
      expect(dossier.alternateFutureContextClaim).toBe(
        "H2_H3_PRESERVED_UNWEIGHTED_NOT_REHEARSED_AS_OWNER_FLOW_IMPACT"
      );
      expect(dossier.alternateJointContactFutureIds).toEqual(
        review.jointContactFutureIds.filter(
          (id) => id !== dossier.ownerRequestFutureId
        )
      );
      expect(dossier.alternateJointNoContactRehearsedFutureIds).toEqual(
        review.jointNoContactRehearsedFutureIds.filter(
          (id) => id !== dossier.ownerRequestFutureId
        )
      );
      expect(dossier.alternateJointCausalUnresolvedFutureIds).toEqual(
        review.jointCausalUnresolvedFutureIds.filter(
          (id) => id !== dossier.ownerRequestFutureId
        )
      );
      expect(dossier.alternateJointReferenceUnresolvedFutureIds).toEqual(
        review.jointReferenceUnresolvedFutureIds.filter(
          (id) => id !== dossier.ownerRequestFutureId
        )
      );
      expect(dossier.futureWeightingClaim).toBe("NONE");
      expect(dossier.rightOfWayPriorityClaim).toBe("NONE");
      expect(dossier.yieldPolicyClaim).toBe("NONE");

      const deliberation = buildA1SpatialCommitmentDeliberationFrame(
        review,
        dossier
      );
      expect(deliberation.rightOfWayContext.alternateJointContactFutureIds)
        .toEqual(dossier.alternateJointContactFutureIds);
      expect(deliberation.rightOfWayContext.alternateJointNoContactRehearsedFutureIds)
        .toEqual(dossier.alternateJointNoContactRehearsedFutureIds);
      expect(deliberation.rightOfWayContext.alternateJointCausalUnresolvedFutureIds)
        .toEqual(dossier.alternateJointCausalUnresolvedFutureIds);
      expect(deliberation.rightOfWayContext.alternateJointReferenceUnresolvedFutureIds)
        .toEqual(dossier.alternateJointReferenceUnresolvedFutureIds);
      expect(deliberation.futureProbabilityClaim).toBe("NONE");
      expect(deliberation.rightOfWayPriorityClaim).toBe("NONE_NOT_ESTABLISHED");
      expect(deliberation.decisionClaim).toBe("NONE_DELIBERATION_ONLY");
      expect(deliberation.selectionClaim).toBe("NONE");
      expect(deliberation.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_RIGHT_OF_WAY_DOSSIER_REVERSAL_FUTURES] ${JSON.stringify({
        sourceTick: dossier.sourceTick,
        horizonSeconds: dossier.horizonSeconds,
        ownerRequestFutureId: dossier.ownerRequestFutureId,
        ownerRequestJointContactFrameCount: dossier.ownerRequestJointContactFrameCount,
        alternateJointContactFutureIds: dossier.alternateJointContactFutureIds,
        alternateJointNoContactRehearsedFutureIds: dossier.alternateJointNoContactRehearsedFutureIds,
        alternateJointCausalUnresolvedFutureIds: dossier.alternateJointCausalUnresolvedFutureIds,
        alternateJointReferenceUnresolvedFutureIds: dossier.alternateJointReferenceUnresolvedFutureIds,
        ownerFlowImpactScopeClaim: dossier.ownerFlowImpactScopeClaim,
        alternateFutureContextClaim: dossier.alternateFutureContextClaim,
        futureWeightingClaim: dossier.futureWeightingClaim,
        rightOfWayPriorityClaim: dossier.rightOfWayPriorityClaim,
        yieldPolicyClaim: dossier.yieldPolicyClaim,
        interpretation: "The causal HOLD-relative impact measurement belongs only to H1 Owner-request continuation. H2/H3 joint outcomes remain visible as distinct unweighted context and cannot silently vote, veto or inherit the H1 impact measurement."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("keeps no-contact / zero-impact evidence explicitly non-authoritative about general safety", async () => {
    const world = await LabWorld.create("open");
    try {
      const currentFit = fit(world.snapshot(), { x: 8, y: 6 });
      const { review, impact } = evidence(world, currentFit, 0.5);
      const dossier = buildA1SpatialCommitmentRightOfWayEvidenceDossier({
        review,
        impact
      });

      expect(dossier.ownerRequestJointContactFrameCount).toBe(0);
      expect(dossier.commitmentExecutionContactFrameCount).toBe(0);
      expect(dossier.executionOnlyContactFrameCount).toBe(0);
      expect(dossier.peakPlayerProgressDeficitVsHold).toBeCloseTo(0, 9);
      expect(dossier.peakPlayerLateralDeltaMagnitudeVsHold).toBeCloseTo(0, 9);
      expect(dossier.noContactSafetyClaim).toBe(
        "NONE_NO_OBSERVED_CONTACT_OR_DISTURBANCE_DOES_NOT_ESTABLISH_GENERAL_SAFETY"
      );
      expect(dossier.rightOfWayPriorityClaim).toBe("NONE");
      expect(dossier.yieldPolicyClaim).toBe("NONE");
      expect(dossier.runtimeAuthorityClaim).toBe("NONE");

      const deliberation = buildA1SpatialCommitmentDeliberationFrame(
        review,
        dossier
      );
      expect(deliberation.rightOfWayContext.status).toBe(
        "SUPPLIED_H1_OWNER_FLOW_EVIDENCE"
      );
      expect(deliberation.rightOfWayContext.executionOnlyContactFrameCount).toBe(0);
      expect(deliberation.rightOfWayContext.peakPlayerProgressDeficitVsHold)
        .toBeCloseTo(0, 9);
      expect(deliberation.rightOfWayContext.peakPlayerLateralDeltaMagnitudeVsHold)
        .toBeCloseTo(0, 9);
      expect(deliberation.rightOfWayContext.harmClaim).toBe("NONE");
      expect(deliberation.rightOfWayContext.rightOfWayPriorityClaim).toBe("NONE");
      expect(deliberation.rightOfWayContext.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_RIGHT_OF_WAY_DOSSIER_NO_CONTACT] ${JSON.stringify({
        sourceTick: dossier.sourceTick,
        horizonSeconds: dossier.horizonSeconds,
        commitmentAnchorWorldPosition: dossier.commitmentAnchorWorldPosition,
        ownerRequestJointContactFrameCount: dossier.ownerRequestJointContactFrameCount,
        executionOnlyContactFrameCount: dossier.executionOnlyContactFrameCount,
        peakPlayerProgressDeficitVsHold: dossier.peakPlayerProgressDeficitVsHold,
        peakPlayerLateralDeltaMagnitudeVsHold: dossier.peakPlayerLateralDeltaMagnitudeVsHold,
        noContactSafetyClaim: dossier.noContactSafetyClaim,
        rightOfWayPriorityClaim: dossier.rightOfWayPriorityClaim,
        yieldPolicyClaim: dossier.yieldPolicyClaim,
        runtimeAuthorityClaim: dossier.runtimeAuthorityClaim,
        interpretation: "This exact rehearsed execution produced no reciprocal contact and no measured Owner-flow delta relative to HOLD in the bounded horizon. That is not promoted into a general safety, priority or execution-authority claim."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("rejects review/impact evidence from different commitment anchors instead of silently composing them", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const reviewEvidence = evidence(
        world,
        fit(world.snapshot(), { x: 5.5, y: 4 }),
        0.75
      );
      const impactEvidence = evidence(
        world,
        fit(world.snapshot(), { x: 5.5, y: 4.5 }),
        0.75
      );

      expect(() =>
        buildA1SpatialCommitmentRightOfWayEvidenceDossier({
          review: reviewEvidence.review,
          impact: impactEvidence.impact
        })
      ).toThrow(/does not exactly align/);
    } finally {
      world.dispose();
    }
  });
});
