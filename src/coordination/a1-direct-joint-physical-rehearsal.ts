import type { A1DirectCandidateRealization } from "./a1-companion-candidates";
import {
  qualifyA1DirectCandidateStatic,
  type A1DirectStaticQualification
} from "./a1-direct-static-qualification";
import type {
  A1PlayerFutureIntervention,
  A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import { a1WorldStepHorizon } from "./a1-rehearsal-timebase";
import type { A1Situation } from "./a1-situation";
import type { LabWorld } from "../world/world";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";

const ALIGNMENT_EPSILON = 1e-8;
const HORIZON_EPSILON = 1e-12;

export interface A1DirectJointPhysicalRehearsal {
  kind: "A1_DIRECT_JOINT_PHYSICAL_REHEARSAL";
  sourceTick: number;
  playerFutureId: string;
  playerFutureFamily: A1RehearsablePlayerFutureIntervention["futureFamily"];
  playerCausalMeaning: A1RehearsablePlayerFutureIntervention["causalMeaning"];
  playerVelocity: Vec2;
  companionCandidateId: string;
  companionCandidateFamily: A1DirectCandidateRealization["family"];
  companionCommandVelocity: Vec2;
  declaredHorizonSeconds: number;
  worldStepSeconds: number;
  worldStepCount: number;
  executedHorizonSeconds: number;
  horizonAlignmentErrorSeconds: number;
  qualification: A1DirectStaticQualification;
  physical: ReturnType<LabWorld["rehearseVelocitySequence"]>;
  physicalEvidenceClaim: "JOINT_SAME_PHYSICS_TRAJECTORY_AND_CONTACT_FRAMES_A1_2J";
  staticGateUsage: "G2_REQUIRED_BEFORE_REHEARSAL_A1_2J";
  oldMatrixUtilityUsage: "NONE_A1_2J";
  relationshipUtilityClaim: "NONE_A1_2J_TRAJECTORY_ONLY";
  g3SafetyClaim: "NONE_A1_2J_TRAJECTORY_EVIDENCE_ONLY";
  cooperationClaim: "NONE_A1_2J";
  selectionClaim: "NONE_A1_2J";
  runtimeAuthorityClaim: "NONE_A1_2J";
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1.2j live World snapshot is missing ${id}.`);
  return value;
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function requireRehearsablePlayer(
  intervention: A1PlayerFutureIntervention
): A1RehearsablePlayerFutureIntervention {
  if (intervention.status !== "REHEARSABLE") {
    throw new Error(
      `A1.2j refuses unresolved player future ${intervention.futureId}: ${intervention.unresolvedReason}.`
    );
  }
  if (intervention.physicsExecutionClaim !== "NONE_A1_2H_PURE_CONTRACT") {
    throw new Error(`A1.2j player future ${intervention.futureId} has unexpected upstream physics authority.`);
  }
  if (intervention.commandAuthorityClaim !== "NONE_A1_2H") {
    throw new Error(`A1.2j player future ${intervention.futureId} unexpectedly carries command authority.`);
  }
  if (intervention.runtimeAuthorityClaim !== "NONE_A1_2H") {
    throw new Error(`A1.2j player future ${intervention.futureId} unexpectedly carries runtime authority.`);
  }
  finiteVector(intervention.repeatedVelocity, `A1.2j player velocity for ${intervention.futureId}`);
  return intervention;
}

function assertSituationMatchesLiveWorld(input: {
  situation: A1Situation;
  live: WorldSnapshot;
}): void {
  if (input.situation.tick !== input.live.tick) {
    throw new Error(
      `A1.2j situation tick ${input.situation.tick} does not equal live World tick ${input.live.tick}.`
    );
  }
  if (input.situation.situated.tick !== input.situation.tick) {
    throw new Error("A1.2j situated evidence tick does not equal situation tick.");
  }

  for (const id of ["player", "companion"] as const) {
    const liveActor = actor(input.live, id);
    const situatedBody = id === "player"
      ? input.situation.situated.playerBody
      : input.situation.situated.companionBody;
    const capability = id === "player"
      ? input.situation.situated.playerCapability
      : input.situation.situated.companionCapability;

    if (situatedBody.sourceTick !== input.situation.tick) {
      throw new Error(`A1.2j ${id} situated body source tick is stale.`);
    }
    if (vectorDistance(liveActor.position, situatedBody.position) > ALIGNMENT_EPSILON) {
      throw new Error(`A1.2j ${id} situated position does not match current live World state.`);
    }
    if (Math.abs(liveActor.radius - capability.radius) > ALIGNMENT_EPSILON) {
      throw new Error(`A1.2j ${id} hard radius does not match current live World state.`);
    }
  }
}

/**
 * Executes one causally-qualified player future and one statically-qualified
 * DIRECT companion command in the same A1.2g query-only clone.
 *
 * This publishes physical trajectory/contact evidence only. It is not a G3
 * policy, relationship-utility evaluation, cooperation rule or selector.
 */
export function rehearseA1DirectJointPhysicalFuture(input: {
  world: LabWorld;
  situation: A1Situation;
  playerIntervention: A1PlayerFutureIntervention;
  companionRealization: A1DirectCandidateRealization;
}): A1DirectJointPhysicalRehearsal {
  const player = requireRehearsablePlayer(input.playerIntervention);
  const live = input.world.snapshot();
  assertSituationMatchesLiveWorld({ situation: input.situation, live });

  if (player.sourceTick !== input.situation.tick) {
    throw new Error(
      `A1.2j player future source tick ${player.sourceTick} does not equal situation tick ${input.situation.tick}.`
    );
  }
  if (input.companionRealization.sourceTick !== input.situation.tick) {
    throw new Error(
      `A1.2j companion realization source tick ${input.companionRealization.sourceTick} does not equal situation tick ${input.situation.tick}.`
    );
  }
  if (Math.abs(player.horizonSeconds - input.companionRealization.horizonSeconds) > HORIZON_EPSILON) {
    throw new Error("A1.2j player and companion rehearsal horizons must match exactly.");
  }

  const horizon = a1WorldStepHorizon(
    input.companionRealization.horizonSeconds,
    "A1.2j joint rehearsal"
  );
  const qualification = qualifyA1DirectCandidateStatic({
    situation: input.situation,
    realization: input.companionRealization,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });

  if (qualification.g0.status !== "PASS") {
    throw new Error("A1.2j refuses companion candidate because G0 evidence alignment failed.");
  }
  if (qualification.g1.status !== "PASS_DIRECT_COMMAND_ADMISSIBLE") {
    throw new Error("A1.2j refuses companion candidate because G1 DIRECT command admissibility failed.");
  }
  if (qualification.g2.status !== "PASS_STATIC_HARD_LEGALITY") {
    const blocker = qualification.g2.status === "FAIL_STATIC_HARD_LEGALITY"
      ? ` (${qualification.g2.blockerLabel})`
      : "";
    throw new Error(`A1.2j refuses companion candidate because G2 static hard legality failed${blocker}.`);
  }

  const playerVelocity = finiteVector(
    player.repeatedVelocity,
    `A1.2j player velocity for ${player.futureId}`
  );
  const companionCommandVelocity = finiteVector(
    input.companionRealization.commandVelocity,
    `A1.2j companion command velocity for ${input.companionRealization.candidateId}`
  );
  const sequence = Array.from({ length: horizon.worldStepCount }, () => [
    { actorId: "player" as const, velocity: { ...playerVelocity } },
    { actorId: "companion" as const, velocity: { ...companionCommandVelocity } }
  ]);
  const physical = input.world.rehearseVelocitySequence(sequence);

  return {
    kind: "A1_DIRECT_JOINT_PHYSICAL_REHEARSAL",
    sourceTick: input.situation.tick,
    playerFutureId: player.futureId,
    playerFutureFamily: player.futureFamily,
    playerCausalMeaning: player.causalMeaning,
    playerVelocity,
    companionCandidateId: input.companionRealization.candidateId,
    companionCandidateFamily: input.companionRealization.family,
    companionCommandVelocity,
    declaredHorizonSeconds: input.companionRealization.horizonSeconds,
    worldStepSeconds: horizon.worldStepSeconds,
    worldStepCount: horizon.worldStepCount,
    executedHorizonSeconds: horizon.executedHorizonSeconds,
    horizonAlignmentErrorSeconds: horizon.alignmentErrorSeconds,
    qualification,
    physical,
    physicalEvidenceClaim: "JOINT_SAME_PHYSICS_TRAJECTORY_AND_CONTACT_FRAMES_A1_2J",
    staticGateUsage: "G2_REQUIRED_BEFORE_REHEARSAL_A1_2J",
    oldMatrixUtilityUsage: "NONE_A1_2J",
    relationshipUtilityClaim: "NONE_A1_2J_TRAJECTORY_ONLY",
    g3SafetyClaim: "NONE_A1_2J_TRAJECTORY_EVIDENCE_ONLY",
    cooperationClaim: "NONE_A1_2J",
    selectionClaim: "NONE_A1_2J",
    runtimeAuthorityClaim: "NONE_A1_2J"
  };
}
