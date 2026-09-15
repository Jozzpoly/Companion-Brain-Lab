import {
  buildA1CompanionCandidateSet,
  realizeA1DirectCandidate,
  type A1CompanionCandidateFamily,
  type A1CompanionCandidateSeed,
  type A1DirectCandidateRealization
} from "./a1-companion-candidates";
import type {
  A1PlayerFutureInterventionCausalMeaning,
  A1PlayerFutureInterventionPlan,
  A1PlayerFutureInterventionUnresolvedReason,
  A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";
import type { A1Situation } from "./a1-situation";
import type { Vec2 } from "../world/types";

const COMMAND_IDENTITY_EPSILON = 1e-9;
const ALIGNMENT_EPSILON = 1e-9;

export interface A1ConcreteCommandGenerationOrigin {
  futureId: string;
  futureFamily: A1PlayerFutureFamily;
  futureCausalMeaning: A1PlayerFutureInterventionCausalMeaning;
  seedId: string;
  taggedSeedId: string;
  seedFamily: A1CompanionCandidateFamily;
  seedLocalBasisSource: A1CompanionCandidateSeed["localBasisSource"];
  desiredVelocity: Vec2;
  commandVelocity: Vec2;
  capabilityClipped: boolean;
}

export interface A1ConcreteCommandUnresolvedFuture {
  futureId: string;
  futureFamily: A1PlayerFutureFamily;
  unresolvedReason: A1PlayerFutureInterventionUnresolvedReason;
}

export interface A1ConcreteCommandProposal {
  kind: "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL";
  proposalId: string;
  sourceTick: number;
  horizonSeconds: number;
  commandVelocity: Vec2;
  canonicalRealization: A1DirectCandidateRealization;
  generationOrigins: readonly A1ConcreteCommandGenerationOrigin[];
  generationOriginCount: number;
  canonicalFamilyProvenance: A1CompanionCandidateFamily;
  commandIdentityClaim: "EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME_A1_2O";
  familySemanticsClaim: "NONE_GENERATION_PROVENANCE_ONLY_A1_2O";
  physicsExecutionClaim: "NONE_A1_2O_GENERATION_ONLY";
  cooperationClaim: "NONE_A1_2O";
  selectionClaim: "NONE_A1_2O";
  runtimeAuthorityClaim: "NONE_A1_2O";
}

export interface A1ConcreteCommandProposalSet {
  kind: "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL_SET";
  sourceTick: number;
  horizonSeconds: number;
  localAlternativeDeltaSpeed: number;
  proposals: readonly A1ConcreteCommandProposal[];
  proposalCount: number;
  generationOriginCount: number;
  rehearsableFutureIds: readonly string[];
  unresolvedFutures: readonly A1ConcreteCommandUnresolvedFuture[];
  commandDedupClaim: "DEDUP_BY_EXECUTABLE_COMMAND_VELOCITY_A1_2O";
  unresolvedFutureClaim: "PRESERVED_NO_GENERATION_NO_SUBSTITUTION_A1_2O";
  familySemanticsClaim: "NONE_COMMAND_IDENTITY_NOT_FAMILY_LABEL_A1_2O";
  physicsExecutionClaim: "NONE_A1_2O_GENERATION_ONLY";
  selectionClaim: "NONE_A1_2O";
  runtimeAuthorityClaim: "NONE_A1_2O";
}

interface ProposalDraft {
  commandVelocity: Vec2;
  origins: A1ConcreteCommandGenerationOrigin[];
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function alignedPlan(input: {
  situation: A1Situation;
  interventionPlan: A1PlayerFutureInterventionPlan;
}): void {
  const { situation, interventionPlan } = input;
  if (interventionPlan.kind !== "A1_PLAYER_FUTURE_INTERVENTION_PLAN") {
    throw new Error("A1.2o requires the qualified A1.2h intervention plan.");
  }
  if (situation.tick !== interventionPlan.sourceTick) {
    throw new Error("A1.2o situation and intervention-plan source ticks are misaligned.");
  }
  if (situation.situated.tick !== situation.tick) {
    throw new Error("A1.2o situated evidence tick must equal the A1 situation tick.");
  }
  if (interventionPlan.aggregationClaim !== "NONE_PRESERVE_H1_H2_H3_A1_2H") {
    throw new Error("A1.2o refuses an intervention plan with future aggregation authority.");
  }
  if (interventionPlan.fallbackSubstitutionClaim !== "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT_A1_2H") {
    throw new Error("A1.2o refuses an intervention plan that permits unresolved-future substitution.");
  }
  for (const intervention of interventionPlan.interventions) {
    if (intervention.sourceTick !== interventionPlan.sourceTick) {
      throw new Error(`A1.2o future ${intervention.futureId} source tick is misaligned.`);
    }
    if (Math.abs(intervention.horizonSeconds - interventionPlan.horizonSeconds) > ALIGNMENT_EPSILON) {
      throw new Error(`A1.2o future ${intervention.futureId} horizon is misaligned.`);
    }
  }
}

function taggedSeed(
  future: A1RehearsablePlayerFutureIntervention,
  seed: A1CompanionCandidateSeed
): A1CompanionCandidateSeed {
  return {
    ...seed,
    id: `${future.futureId}::${seed.id}`
  };
}

function appendDraft(
  drafts: ProposalDraft[],
  commandVelocity: Vec2,
  origin: A1ConcreteCommandGenerationOrigin
): void {
  const existing = drafts.find(
    (draft) => vectorDistance(draft.commandVelocity, commandVelocity) <= COMMAND_IDENTITY_EPSILON
  );
  if (existing) {
    existing.origins.push(origin);
    return;
  }
  drafts.push({
    commandVelocity: { ...commandVelocity },
    origins: [origin]
  });
}

/**
 * A1.2o converts player-future-conditioned generation into concrete DIRECT
 * command proposals whose identity is the executable world-unit velocity for
 * this one decision frame. Family labels and generation futures remain
 * provenance only. Unresolved player futures generate no commands and remain
 * explicit in the proposal set.
 */
export function buildA1ConcreteCommandProposalSet(input: {
  situation: A1Situation;
  interventionPlan: A1PlayerFutureInterventionPlan;
  localAlternativeDeltaSpeed: number;
}): A1ConcreteCommandProposalSet {
  alignedPlan(input);
  const { situation, interventionPlan } = input;
  const capability = situation.situated.companionCapability;
  if (capability.actorId !== "companion") {
    throw new Error("A1.2o requires companion MovementCapability truth.");
  }
  if (
    !Number.isFinite(input.localAlternativeDeltaSpeed) ||
    input.localAlternativeDeltaSpeed <= 0 ||
    input.localAlternativeDeltaSpeed > capability.maxSpeed
  ) {
    throw new Error("A1.2o localAlternativeDeltaSpeed must be positive, finite and no greater than companion maxSpeed.");
  }

  const companionCurrentVelocity = finiteVector(
    situation.situated.companionBody.actualVelocity,
    "A1.2o companion current velocity"
  );
  const currentRelativeOffset = subtract(
    situation.situated.companionBody.position,
    situation.situated.playerBody.position
  );
  const drafts: ProposalDraft[] = [];
  const rehearsableFutureIds: string[] = [];
  const unresolvedFutures: A1ConcreteCommandUnresolvedFuture[] = [];
  let generationOriginCount = 0;

  for (const intervention of interventionPlan.interventions) {
    if (intervention.status === "UNRESOLVED") {
      unresolvedFutures.push({
        futureId: intervention.futureId,
        futureFamily: intervention.futureFamily,
        unresolvedReason: intervention.unresolvedReason
      });
      continue;
    }

    rehearsableFutureIds.push(intervention.futureId);
    const candidateSet = buildA1CompanionCandidateSet({
      tick: situation.tick,
      companionCurrentVelocity: {
        id: `companion-current@${situation.tick}`,
        sourceTick: situation.tick,
        velocity: companionCurrentVelocity
      },
      playerFuture: {
        id: intervention.futureId,
        sourceTick: situation.tick,
        velocity: intervention.repeatedVelocity
      },
      currentRelativeOffset,
      capability,
      localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed
    });

    for (const seed of candidateSet.seeds) {
      const tagged = taggedSeed(intervention, seed);
      const realization = realizeA1DirectCandidate({
        candidate: tagged,
        capability,
        horizonSeconds: interventionPlan.horizonSeconds
      });
      const origin: A1ConcreteCommandGenerationOrigin = {
        futureId: intervention.futureId,
        futureFamily: intervention.futureFamily,
        futureCausalMeaning: intervention.causalMeaning,
        seedId: seed.id,
        taggedSeedId: tagged.id,
        seedFamily: seed.family,
        seedLocalBasisSource: seed.localBasisSource,
        desiredVelocity: { ...realization.desiredVelocity },
        commandVelocity: { ...realization.commandVelocity },
        capabilityClipped: realization.capabilityClipped
      };
      appendDraft(drafts, realization.commandVelocity, origin);
      generationOriginCount += 1;
    }
  }

  const proposals = drafts.map((draft, index) => {
    const proposalId = `a1-2o-command-${index}`;
    const firstOrigin = draft.origins[0]!;
    const canonicalSeed: A1CompanionCandidateSeed = {
      id: proposalId,
      family: firstOrigin.seedFamily,
      sourceTick: situation.tick,
      desiredVelocity: { ...draft.commandVelocity },
      localBasisSource: "NONE"
    };
    const canonicalRealization = realizeA1DirectCandidate({
      candidate: canonicalSeed,
      capability,
      horizonSeconds: interventionPlan.horizonSeconds
    });
    if (vectorDistance(canonicalRealization.commandVelocity, draft.commandVelocity) > COMMAND_IDENTITY_EPSILON) {
      throw new Error("A1.2o canonical realization changed the deduplicated executable command.");
    }
    return {
      kind: "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL",
      proposalId,
      sourceTick: situation.tick,
      horizonSeconds: interventionPlan.horizonSeconds,
      commandVelocity: { ...draft.commandVelocity },
      canonicalRealization,
      generationOrigins: draft.origins.map((origin) => ({
        ...origin,
        desiredVelocity: { ...origin.desiredVelocity },
        commandVelocity: { ...origin.commandVelocity }
      })),
      generationOriginCount: draft.origins.length,
      canonicalFamilyProvenance: firstOrigin.seedFamily,
      commandIdentityClaim: "EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME_A1_2O",
      familySemanticsClaim: "NONE_GENERATION_PROVENANCE_ONLY_A1_2O",
      physicsExecutionClaim: "NONE_A1_2O_GENERATION_ONLY",
      cooperationClaim: "NONE_A1_2O",
      selectionClaim: "NONE_A1_2O",
      runtimeAuthorityClaim: "NONE_A1_2O"
    } satisfies A1ConcreteCommandProposal;
  });

  return {
    kind: "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL_SET",
    sourceTick: situation.tick,
    horizonSeconds: interventionPlan.horizonSeconds,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed,
    proposals,
    proposalCount: proposals.length,
    generationOriginCount,
    rehearsableFutureIds,
    unresolvedFutures,
    commandDedupClaim: "DEDUP_BY_EXECUTABLE_COMMAND_VELOCITY_A1_2O",
    unresolvedFutureClaim: "PRESERVED_NO_GENERATION_NO_SUBSTITUTION_A1_2O",
    familySemanticsClaim: "NONE_COMMAND_IDENTITY_NOT_FAMILY_LABEL_A1_2O",
    physicsExecutionClaim: "NONE_A1_2O_GENERATION_ONLY",
    selectionClaim: "NONE_A1_2O",
    runtimeAuthorityClaim: "NONE_A1_2O"
  };
}
