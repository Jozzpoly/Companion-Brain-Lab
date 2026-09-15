import type { A1ConcreteDirectCommandProposal } from "./a1-concrete-command-proposals";
import {
  qualifyA1DirectCandidateStatic,
  type A1DirectStaticQualification
} from "./a1-direct-static-qualification";
import {
  rehearseA1DirectJointPhysicalFuture,
  type A1DirectJointPhysicalRehearsal
} from "./a1-direct-joint-physical-rehearsal";
import {
  buildA1JointHardBodyTrace,
  type A1JointHardBodyTraceEvidence
} from "./a1-joint-hard-body-trace";
import {
  evaluateA1G3JointTracePolicy,
  type A1G3JointTracePolicyEvidence
} from "./a1-g3-joint-trace-policy";
import {
  buildA1PlayerAgencyTrajectoryEvidence,
  type A1PlayerAgencyTrajectoryEvidence
} from "./a1-player-agency-trajectory";
import type {
  A1PlayerFutureFamily,
  A1PlayerFutureInterventionPlan,
  A1PlayerFutureInterventionUnresolvedReason,
  A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import type { A1Situation } from "./a1-situation";
import type { LabWorld } from "../world/world";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;
const HORIZON_EPSILON = 1e-12;

const FUTURE_FAMILIES: readonly A1PlayerFutureFamily[] = [
  "OWNER_REQUEST_CONTINUATION",
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
];

interface A1FixedCommandFutureCommon {
  futureFamily: A1PlayerFutureFamily;
  proposalId: string;
  commandVelocity: Vec2;
  fixedCommandClaim: "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P";
  utilityAggregationClaim: "NONE_A1_2P";
  cooperationAggregationClaim: "NONE_A1_2P";
  selectionClaim: "NONE_A1_2P";
  runtimeAuthorityClaim: "NONE_A1_2P";
}

export interface A1FixedCommandFutureAbsent extends A1FixedCommandFutureCommon {
  status: "ABSENT";
  futureId: null;
  reason: "PLAYER_FUTURE_FAMILY_NOT_PRESENT_IN_INTERVENTION_PLAN";
}

export interface A1FixedCommandFutureUnresolved extends A1FixedCommandFutureCommon {
  status: "UNRESOLVED";
  futureId: string;
  unresolvedReason: A1PlayerFutureInterventionUnresolvedReason;
}

export interface A1FixedCommandFutureUpstreamRejected extends A1FixedCommandFutureCommon {
  status: "UPSTREAM_REJECTED";
  futureId: string;
  playerCausalMeaning: A1RehearsablePlayerFutureIntervention["causalMeaning"];
  qualification: A1DirectStaticQualification;
  reason: string;
}

export interface A1FixedCommandFutureRehearsed extends A1FixedCommandFutureCommon {
  status: "REHEARSED";
  futureId: string;
  playerCausalMeaning: A1RehearsablePlayerFutureIntervention["causalMeaning"];
  playerVelocity: Vec2;
  rehearsal: A1DirectJointPhysicalRehearsal;
  hardBodyTrace: A1JointHardBodyTraceEvidence;
  g3: A1G3JointTracePolicyEvidence;
  playerAgency: A1PlayerAgencyTrajectoryEvidence;
}

export type A1FixedCommandFutureProfileEntry =
  | A1FixedCommandFutureAbsent
  | A1FixedCommandFutureUnresolved
  | A1FixedCommandFutureUpstreamRejected
  | A1FixedCommandFutureRehearsed;

export interface A1FixedCommandCrossFutureProfile {
  kind: "A1_FIXED_COMMAND_CROSS_FUTURE_PROFILE";
  sourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  commandVelocity: Vec2;
  generationOriginCount: number;
  entries: readonly A1FixedCommandFutureProfileEntry[];
  rehearsedCount: number;
  unresolvedCount: number;
  absentCount: number;
  upstreamRejectedCount: number;
  commandIdentityClaim: "A1_2O_EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME";
  futureCoverageClaim: "H1_H2_H3_EXPLICIT_REHEARSED_UNRESOLVED_ABSENT_OR_UPSTREAM_REJECTED_A1_2P";
  fixedCommandClaim: "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P";
  regenerationClaim: "NONE_A1_2P_REUSE_A1_2O_CANONICAL_REALIZATION";
  utilityAggregationClaim: "NONE_A1_2P";
  cooperationAggregationClaim: "NONE_A1_2P";
  selectionClaim: "NONE_A1_2P";
  liveWorldMutationClaim: "NONE_QUERY_ONLY_REHEARSALS_A1_2P";
  runtimeAuthorityClaim: "NONE_A1_2P";
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function common(input: {
  futureFamily: A1PlayerFutureFamily;
  proposal: A1ConcreteDirectCommandProposal;
}): A1FixedCommandFutureCommon {
  return {
    futureFamily: input.futureFamily,
    proposalId: input.proposal.proposalId,
    commandVelocity: { ...input.proposal.commandVelocity },
    fixedCommandClaim: "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P",
    utilityAggregationClaim: "NONE_A1_2P",
    cooperationAggregationClaim: "NONE_A1_2P",
    selectionClaim: "NONE_A1_2P",
    runtimeAuthorityClaim: "NONE_A1_2P"
  };
}

function validateInput(input: {
  situation: A1Situation;
  interventionPlan: A1PlayerFutureInterventionPlan;
  proposal: A1ConcreteDirectCommandProposal;
}): void {
  const { situation, interventionPlan, proposal } = input;
  if (proposal.kind !== "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL") {
    throw new Error("A1.2p requires a qualified A1.2o concrete DIRECT command proposal.");
  }
  if (proposal.commandIdentityClaim !== "EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME_A1_2O") {
    throw new Error("A1.2p requires the qualified A1.2o command-identity boundary.");
  }
  if (proposal.physicsExecutionClaim !== "NONE_A1_2O_GENERATION_ONLY") {
    throw new Error("A1.2p refuses a proposal that already claims physics execution.");
  }
  if (proposal.selectionClaim !== "NONE_A1_2O") {
    throw new Error("A1.2p refuses a proposal that already claims selection authority.");
  }
  if (proposal.runtimeAuthorityClaim !== "NONE_A1_2O") {
    throw new Error("A1.2p refuses a proposal that already claims runtime authority.");
  }
  if (
    situation.tick !== interventionPlan.sourceTick ||
    proposal.sourceTick !== situation.tick ||
    proposal.canonicalRealization.sourceTick !== situation.tick
  ) {
    throw new Error("A1.2p situation, intervention plan, proposal and realization source ticks are misaligned.");
  }
  if (
    Math.abs(interventionPlan.horizonSeconds - proposal.horizonSeconds) > HORIZON_EPSILON ||
    Math.abs(proposal.canonicalRealization.horizonSeconds - proposal.horizonSeconds) > HORIZON_EPSILON
  ) {
    throw new Error("A1.2p intervention-plan and concrete-command horizons are misaligned.");
  }
  const commandVelocity = finiteVector(proposal.commandVelocity, "A1.2p concrete command velocity");
  if (distance(commandVelocity, proposal.canonicalRealization.commandVelocity) > EPSILON) {
    throw new Error("A1.2p canonical realization does not preserve the concrete proposal command velocity.");
  }
  const capability = situation.situated.companionCapability;
  if (
    capability.actorId !== "companion" ||
    Math.abs(proposal.canonicalRealization.capabilityMaxSpeed - capability.maxSpeed) > EPSILON
  ) {
    throw new Error("A1.2p concrete command capability provenance does not match current companion capability.");
  }
  if (interventionPlan.aggregationClaim !== "NONE_PRESERVE_H1_H2_H3_A1_2H") {
    throw new Error("A1.2p refuses an intervention plan that aggregates player futures.");
  }
  const seen = new Set<A1PlayerFutureFamily>();
  for (const intervention of interventionPlan.interventions) {
    if (seen.has(intervention.futureFamily)) {
      throw new Error(`A1.2p duplicate player-future family ${intervention.futureFamily}.`);
    }
    seen.add(intervention.futureFamily);
  }
}

function staticQualification(input: {
  world: LabWorld;
  situation: A1Situation;
  proposal: A1ConcreteDirectCommandProposal;
}): A1DirectStaticQualification {
  return qualifyA1DirectCandidateStatic({
    situation: input.situation,
    realization: input.proposal.canonicalRealization,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
}

function qualificationPasses(value: A1DirectStaticQualification): boolean {
  return value.g0.status === "PASS" &&
    value.g1.status === "PASS_DIRECT_COMMAND_ADMISSIBLE" &&
    value.g2.status === "PASS_STATIC_HARD_LEGALITY";
}

function qualificationFailureReason(value: A1DirectStaticQualification): string {
  if (value.g0.status !== "PASS") return `G0: ${value.g0.reasons.join("; ")}`;
  if (value.g1.status !== "PASS_DIRECT_COMMAND_ADMISSIBLE") return `G1: ${value.g1.reason}`;
  return `G2: ${value.g2.reason}`;
}

/**
 * A1.2p holds one A1.2o executable DIRECT command exactly fixed while the
 * player counterfactual changes. It composes already-qualified j/k/l/m evidence
 * only; it does not regenerate a companion candidate, aggregate futures, rank
 * proposals or grant movement authority.
 */
export function buildA1FixedCommandCrossFutureProfile(input: {
  world: LabWorld;
  situation: A1Situation;
  interventionPlan: A1PlayerFutureInterventionPlan;
  proposal: A1ConcreteDirectCommandProposal;
}): A1FixedCommandCrossFutureProfile {
  validateInput(input);
  const qualification = staticQualification(input);
  const entries: A1FixedCommandFutureProfileEntry[] = [];

  for (const family of FUTURE_FAMILIES) {
    const intervention = input.interventionPlan.interventions.find(
      (candidate) => candidate.futureFamily === family
    );
    const base = common({ futureFamily: family, proposal: input.proposal });

    if (!intervention) {
      entries.push({
        ...base,
        status: "ABSENT",
        futureId: null,
        reason: "PLAYER_FUTURE_FAMILY_NOT_PRESENT_IN_INTERVENTION_PLAN"
      });
      continue;
    }

    if (intervention.status === "UNRESOLVED") {
      entries.push({
        ...base,
        status: "UNRESOLVED",
        futureId: intervention.futureId,
        unresolvedReason: intervention.unresolvedReason
      });
      continue;
    }

    if (!qualificationPasses(qualification)) {
      entries.push({
        ...base,
        status: "UPSTREAM_REJECTED",
        futureId: intervention.futureId,
        playerCausalMeaning: intervention.causalMeaning,
        qualification,
        reason: qualificationFailureReason(qualification)
      });
      continue;
    }

    const rehearsal = rehearseA1DirectJointPhysicalFuture({
      world: input.world,
      situation: input.situation,
      playerIntervention: intervention,
      companionRealization: input.proposal.canonicalRealization
    });
    if (distance(rehearsal.companionCommandVelocity, input.proposal.commandVelocity) > EPSILON) {
      throw new Error("A1.2p rehearsal changed the fixed concrete companion command.");
    }
    const hardBodyTrace = buildA1JointHardBodyTrace({
      situation: input.situation,
      rehearsal
    });
    const g3 = evaluateA1G3JointTracePolicy(hardBodyTrace);
    const playerAgency = buildA1PlayerAgencyTrajectoryEvidence({
      rehearsal,
      trace: hardBodyTrace
    });

    entries.push({
      ...base,
      status: "REHEARSED",
      futureId: intervention.futureId,
      playerCausalMeaning: intervention.causalMeaning,
      playerVelocity: { ...intervention.repeatedVelocity },
      rehearsal,
      hardBodyTrace,
      g3,
      playerAgency
    });
  }

  return {
    kind: "A1_FIXED_COMMAND_CROSS_FUTURE_PROFILE",
    sourceTick: input.situation.tick,
    horizonSeconds: input.proposal.horizonSeconds,
    proposalId: input.proposal.proposalId,
    commandVelocity: { ...input.proposal.commandVelocity },
    generationOriginCount: input.proposal.generationOriginCount,
    entries,
    rehearsedCount: entries.filter((entry) => entry.status === "REHEARSED").length,
    unresolvedCount: entries.filter((entry) => entry.status === "UNRESOLVED").length,
    absentCount: entries.filter((entry) => entry.status === "ABSENT").length,
    upstreamRejectedCount: entries.filter((entry) => entry.status === "UPSTREAM_REJECTED").length,
    commandIdentityClaim: "A1_2O_EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME",
    futureCoverageClaim: "H1_H2_H3_EXPLICIT_REHEARSED_UNRESOLVED_ABSENT_OR_UPSTREAM_REJECTED_A1_2P",
    fixedCommandClaim: "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P",
    regenerationClaim: "NONE_A1_2P_REUSE_A1_2O_CANONICAL_REALIZATION",
    utilityAggregationClaim: "NONE_A1_2P",
    cooperationAggregationClaim: "NONE_A1_2P",
    selectionClaim: "NONE_A1_2P",
    liveWorldMutationClaim: "NONE_QUERY_ONLY_REHEARSALS_A1_2P",
    runtimeAuthorityClaim: "NONE_A1_2P"
  };
}
