import {
  A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED,
  evaluateA1H1PrimaryShadowHorizon
} from "./a1-h1-primary-shadow";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1DirectExecutionResearchCapsule } from "./a1-direct-execution-research";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import type { A1Situation } from "./a1-situation";
import type { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

export interface A1ExplicitManualDirectCommand {
  kind: "A1_EXPLICIT_MANUAL_DIRECT_COMMAND";
  sourceTick: number;
  validForOutcomeTick: number;
  horizonSeconds: number;
  proposalId: string;
  frontierProposalIds: readonly string[];
  commandVelocity: Vec2;
  motionIntent: MotionIntent;
  commandRepresentationError: number;
  selectionSource: "EXPLICIT_CALLER_PROPOSAL_ID_P2";
  automaticSelectionClaim: "NONE_P2";
  horizonPolicyClaim: "EXPLICIT_CALLER_SUPPLIED_HORIZON_P2";
  authorityScopeClaim: "SOURCE_TICK_TO_NEXT_WORLD_STEP_ONLY_P2";
  runtimeAuthorityClaim: "EXPLICIT_CALLER_ONE_STEP_DIRECT_P2";
}

/**
 * P2 is the first deliberately authoritative A1 seam, but it does not contain
 * an automatic selector. The caller must supply the exact current source tick,
 * horizon and proposal id. That proposal must already belong to the exact H1
 * structured frontier for the same decision state. P2 only promotes the
 * already-qualified P0 DIRECT representation for one sourceTick -> outcomeTick
 * command.
 */
export function buildA1ExplicitManualDirectCommand(input: {
  world: LabWorld;
  situation: A1Situation;
  expectedSourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  orientation?: A1RelationshipOrientationEvidence;
  localAlternativeDeltaSpeed?: number;
}): A1ExplicitManualDirectCommand {
  if (input.situation.tick !== input.expectedSourceTick) {
    throw new Error(
      `P2 explicit request is stale: expected source tick ${input.expectedSourceTick}, current situation is t${input.situation.tick}.`
    );
  }

  const localAlternativeDeltaSpeed = input.localAlternativeDeltaSpeed ??
    A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED;
  const frontier = evaluateA1H1PrimaryShadowHorizon({
    world: input.world,
    situation: input.situation,
    horizonSeconds: input.horizonSeconds,
    localAlternativeDeltaSpeed,
    orientation: input.orientation
  });
  const selectedFrontier = frontier.frontierCandidates.find(
    (candidate) => candidate.proposalId === input.proposalId
  );
  if (!selectedFrontier) {
    throw new Error(
      `P2 explicit proposal ${input.proposalId} is not in the exact H1 structured frontier at t${input.situation.tick}.`
    );
  }

  const hypotheses = buildA1PlayerFutureHypotheses({
    situation: input.situation,
    horizonSeconds: input.horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation: input.situation,
    interventionPlan,
    localAlternativeDeltaSpeed
  });
  const proposal = proposalSet.proposals.find(
    (candidate) => candidate.proposalId === input.proposalId
  );
  if (!proposal) {
    throw new Error(
      `P2 lost explicit frontier proposal ${input.proposalId} while rebuilding exact executable identity.`
    );
  }

  const capsule = buildA1DirectExecutionResearchCapsule({
    situation: input.situation,
    proposal,
    companionCapability: input.world.actorMovementCapability("companion")
  });

  return {
    kind: "A1_EXPLICIT_MANUAL_DIRECT_COMMAND",
    sourceTick: input.situation.tick,
    validForOutcomeTick: input.situation.tick + 1,
    horizonSeconds: input.horizonSeconds,
    proposalId: proposal.proposalId,
    frontierProposalIds: frontier.frontierCandidates.map((candidate) => candidate.proposalId),
    commandVelocity: { ...capsule.commandVelocity },
    motionIntent: {
      actorId: "companion",
      move: { ...capsule.motionIntent.move }
    },
    commandRepresentationError: capsule.commandRepresentationError,
    selectionSource: "EXPLICIT_CALLER_PROPOSAL_ID_P2",
    automaticSelectionClaim: "NONE_P2",
    horizonPolicyClaim: "EXPLICIT_CALLER_SUPPLIED_HORIZON_P2",
    authorityScopeClaim: "SOURCE_TICK_TO_NEXT_WORLD_STEP_ONLY_P2",
    runtimeAuthorityClaim: "EXPLICIT_CALLER_ONE_STEP_DIRECT_P2"
  };
}
