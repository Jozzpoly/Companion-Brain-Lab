import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import {
  A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED,
  evaluateA1H1PrimaryShadowHorizon
} from "./a1-h1-primary-shadow";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import type { A1Situation } from "./a1-situation";
import type { LabWorld } from "../world/world";
import type { ActorSnapshot, Vec2 } from "../world/types";

const H1 = "OWNER_REQUEST_CONTINUATION" as const;
const ALIGNMENT_EPSILON = 1e-9;

export interface A1EmbodiedShadowFrame {
  stepIndex: number;
  playerPosition: Vec2;
  companionPosition: Vec2;
  playerContacts: readonly string[];
  companionContacts: readonly string[];
}

export interface A1EmbodiedShadowCandidateProjection {
  proposalId: string;
  commandVelocity: Vec2;
  originFamilies: readonly string[];
  q: number;
  paceDelta: number;
  g3Status: string | null;
  playerStart: Vec2;
  companionStart: Vec2;
  worldStepCount: number;
  frames: readonly A1EmbodiedShadowFrame[];
  contactFrameCount: number;
  physicalEvidenceClaim: "SAME_PHYSICS_H1_GHOST_TRAJECTORY_P1";
  selectionClaim: "NONE_FRONTIER_MEMBER_ONLY_P1";
  runtimeAuthorityClaim: "NONE_P1";
}

export interface A1EmbodiedShadowProjection {
  kind: "A1_EMBODIED_H1_SHADOW_PROJECTION";
  sourceTick: number;
  horizonSeconds: number;
  frontierState: "SINGLETON_H1_FRONTIER" | "H1_FRONTIER_AMBIGUOUS" | "H1_FRONTIER_UNAVAILABLE";
  frontierProposalIds: readonly string[];
  candidates: readonly A1EmbodiedShadowCandidateProjection[];
  semantics: {
    playerFuture: "OWNER_REQUEST_CONTINUATION";
    frontierSource: "A1_H1_STRUCTURED_FRONTIER_NO_SELECTION_P1";
    embodiment: "COUNTERFACTUAL_SAME_PHYSICS_GHOST_TRAJECTORIES_P1";
    selection: "NONE_SHOW_ALL_FRONTIER_MEMBERS_P1";
    tieBreak: "NONE_P1";
    sidePreference: "NONE_P1";
    liveWorldMutation: "NONE_QUERY_ONLY_REHEARSALS_P1";
    movementAuthority: "NONE_P1";
  };
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(frameActors: readonly ActorSnapshot[], id: "player" | "companion"): ActorSnapshot {
  const value = frameActors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`P1 embodied shadow frame is missing ${id}.`);
  return value;
}

/**
 * Turns the already-qualified H1 structured frontier into participant-readable
 * same-physics ghost trajectories. P1 deliberately embodies every frontier
 * member; it does not choose among them, invent a horizon policy, or actuate the
 * live World.
 */
export function buildA1EmbodiedH1ShadowProjection(input: {
  world: LabWorld;
  situation: A1Situation;
  horizonSeconds: number;
  localAlternativeDeltaSpeed?: number;
}): A1EmbodiedShadowProjection {
  const localAlternativeDeltaSpeed = input.localAlternativeDeltaSpeed ??
    A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED;
  const frontier = evaluateA1H1PrimaryShadowHorizon({
    world: input.world,
    situation: input.situation,
    horizonSeconds: input.horizonSeconds,
    localAlternativeDeltaSpeed
  });

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
  const h1 = interventionPlan.interventions.find((candidate) => candidate.futureFamily === H1);

  if (frontier.frontierCandidates.length > 0 && (!h1 || h1.status !== "REHEARSABLE")) {
    throw new Error("P1 H1 frontier exists without a rehearsable H1 player intervention.");
  }

  const playerStart = { ...input.situation.situated.playerBody.position };
  const companionStart = { ...input.situation.situated.companionBody.position };
  const candidates = frontier.frontierCandidates.map((candidate): A1EmbodiedShadowCandidateProjection => {
    const proposal = proposalSet.proposals.find((value) => value.proposalId === candidate.proposalId);
    if (!proposal) throw new Error(`P1 lost H1 frontier proposal ${candidate.proposalId}.`);
    if (vectorDistance(proposal.commandVelocity, candidate.commandVelocity) > ALIGNMENT_EPSILON) {
      throw new Error(`P1 proposal ${candidate.proposalId} changed executable command identity.`);
    }
    if (!h1 || h1.status !== "REHEARSABLE") {
      throw new Error(`P1 cannot rehearse frontier proposal ${candidate.proposalId} without H1.`);
    }

    const rehearsal = rehearseA1DirectJointPhysicalFuture({
      world: input.world,
      situation: input.situation,
      playerIntervention: h1,
      companionRealization: proposal.canonicalRealization
    });
    const frames = rehearsal.physical.frames.map((frame): A1EmbodiedShadowFrame => {
      const player = actor(frame.actors, "player");
      const companion = actor(frame.actors, "companion");
      return {
        stepIndex: frame.stepIndex,
        playerPosition: { ...player.position },
        companionPosition: { ...companion.position },
        playerContacts: player.contacts.map((contact) => contact.with),
        companionContacts: companion.contacts.map((contact) => contact.with)
      };
    });
    const contactFrameCount = frames.filter((frame) =>
      frame.playerContacts.includes("companion") || frame.companionContacts.includes("player")
    ).length;

    return {
      proposalId: candidate.proposalId,
      commandVelocity: { ...candidate.commandVelocity },
      originFamilies: [...candidate.originFamilies],
      q: candidate.q,
      paceDelta: candidate.paceDelta,
      g3Status: candidate.g3Status,
      playerStart: { ...playerStart },
      companionStart: { ...companionStart },
      worldStepCount: rehearsal.worldStepCount,
      frames,
      contactFrameCount,
      physicalEvidenceClaim: "SAME_PHYSICS_H1_GHOST_TRAJECTORY_P1",
      selectionClaim: "NONE_FRONTIER_MEMBER_ONLY_P1",
      runtimeAuthorityClaim: "NONE_P1"
    };
  });

  const frontierProposalIds = frontier.frontierCandidates.map((candidate) => candidate.proposalId);
  if (candidates.length !== frontierProposalIds.length) {
    throw new Error("P1 embodied projection did not preserve the complete H1 frontier.");
  }

  return {
    kind: "A1_EMBODIED_H1_SHADOW_PROJECTION",
    sourceTick: input.situation.tick,
    horizonSeconds: input.horizonSeconds,
    frontierState: frontier.shadowDecisionState,
    frontierProposalIds,
    candidates,
    semantics: {
      playerFuture: H1,
      frontierSource: "A1_H1_STRUCTURED_FRONTIER_NO_SELECTION_P1",
      embodiment: "COUNTERFACTUAL_SAME_PHYSICS_GHOST_TRAJECTORIES_P1",
      selection: "NONE_SHOW_ALL_FRONTIER_MEMBERS_P1",
      tieBreak: "NONE_P1",
      sidePreference: "NONE_P1",
      liveWorldMutation: "NONE_QUERY_ONLY_REHEARSALS_P1",
      movementAuthority: "NONE_P1"
    }
  };
}
