import type {
  A1PlayerFutureIntervention,
  A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import { WORLD_STEP_SECONDS, type LabWorld } from "../world/world";
import type { Vec2 } from "../world/types";

const HORIZON_ALIGNMENT_EPSILON_SECONDS = 1e-12;

export interface A1PlayerFuturePhysicalRehearsal {
  kind: "A1_PLAYER_FUTURE_PHYSICAL_REHEARSAL";
  futureId: string;
  futureFamily: A1RehearsablePlayerFutureIntervention["futureFamily"];
  sourceTick: number;
  causalMeaning: A1RehearsablePlayerFutureIntervention["causalMeaning"];
  interventionVelocity: Vec2;
  declaredHorizonSeconds: number;
  worldStepSeconds: number;
  worldStepCount: number;
  executedHorizonSeconds: number;
  horizonAlignmentErrorSeconds: number;
  companionBaseline: "LIVE_HOLD_CONTROL_ZERO_VELOCITY_EACH_WORLD_STEP";
  physical: ReturnType<LabWorld["rehearseVelocitySequence"]>;
  horizonContract: "EXACT_INTEGER_WORLD_STEPS_A1_2I";
  sourceStateContract: "INTERVENTION_SOURCE_TICK_EQUALS_LIVE_WORLD_TICK_A1_2I";
  aggregationClaim: "NONE_SINGLE_INTERVENTION_A1_2I";
  companionCandidateClaim: "NONE_A1_2I_PLAYER_ONLY";
  g3SafetyClaim: "NONE_A1_2I_PHYSICAL_REHEARSAL_ONLY";
  commandAuthorityClaim: "NONE_A1_2I";
  runtimeAuthorityClaim: "NONE_A1_2I";
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function worldStepCountFor(horizonSeconds: number): {
  stepCount: number;
  executedHorizonSeconds: number;
  alignmentErrorSeconds: number;
} {
  if (!Number.isFinite(horizonSeconds) || horizonSeconds <= 0) {
    throw new Error("A1.2i rehearsal requires a positive finite horizonSeconds.");
  }
  if (!Number.isFinite(WORLD_STEP_SECONDS) || WORLD_STEP_SECONDS <= 0) {
    throw new Error("A1.2i World timebase must be positive and finite.");
  }

  const nearestStepCount = Math.round(horizonSeconds / WORLD_STEP_SECONDS);
  if (nearestStepCount < 1) {
    throw new Error("A1.2i rehearsal horizon must contain at least one complete World step.");
  }
  const executedHorizonSeconds = nearestStepCount * WORLD_STEP_SECONDS;
  const alignmentErrorSeconds = Math.abs(executedHorizonSeconds - horizonSeconds);
  if (alignmentErrorSeconds > HORIZON_ALIGNMENT_EPSILON_SECONDS) {
    throw new Error(
      `A1.2i rehearsal horizon ${horizonSeconds} is not an exact integer multiple of World step ${WORLD_STEP_SECONDS}.`
    );
  }

  return {
    stepCount: nearestStepCount,
    executedHorizonSeconds,
    alignmentErrorSeconds
  };
}

function requireRehearsable(
  intervention: A1PlayerFutureIntervention
): A1RehearsablePlayerFutureIntervention {
  if (intervention.status !== "REHEARSABLE") {
    throw new Error(
      `A1.2i refuses unresolved player future ${intervention.futureId}: ${intervention.unresolvedReason}.`
    );
  }
  if (intervention.mode !== "REPEAT_WORLD_VELOCITY") {
    throw new Error(`A1.2i player future ${intervention.futureId} has unsupported intervention mode.`);
  }
  if (intervention.physicsExecutionClaim !== "NONE_A1_2H_PURE_CONTRACT") {
    throw new Error(`A1.2i player future ${intervention.futureId} has unexpected upstream physics authority.`);
  }
  if (intervention.commandAuthorityClaim !== "NONE_A1_2H") {
    throw new Error(`A1.2i player future ${intervention.futureId} unexpectedly carries command authority.`);
  }
  if (intervention.runtimeAuthorityClaim !== "NONE_A1_2H") {
    throw new Error(`A1.2i player future ${intervention.futureId} unexpectedly carries runtime authority.`);
  }
  if (!intervention.futureId) {
    throw new Error("A1.2i rehearsable player future requires a non-empty future id.");
  }
  if (!Number.isInteger(intervention.sourceTick) || intervention.sourceTick < 0) {
    throw new Error(`A1.2i player future ${intervention.futureId} requires a non-negative integer source tick.`);
  }
  finiteVector(intervention.repeatedVelocity, `A1.2i repeated velocity for ${intervention.futureId}`);
  return intervention;
}

/**
 * A1.2i executes exactly one already-qualified A1.2h player intervention through
 * the A1.2g same-physics query-only rehearsal substrate.
 *
 * Companion motion is an explicit live-HOLD counterfactual (zero velocity every
 * World step), not a candidate and not a cooperation policy.
 */
export function rehearseA1PlayerFutureIntervention(input: {
  world: LabWorld;
  intervention: A1PlayerFutureIntervention;
}): A1PlayerFuturePhysicalRehearsal {
  const intervention = requireRehearsable(input.intervention);
  const liveTick = input.world.snapshot().tick;
  if (intervention.sourceTick !== liveTick) {
    throw new Error(
      `A1.2i refuses stale player future ${intervention.futureId}: source tick ${intervention.sourceTick} does not equal live World tick ${liveTick}.`
    );
  }

  const horizon = worldStepCountFor(intervention.horizonSeconds);
  const repeatedVelocity = finiteVector(
    intervention.repeatedVelocity,
    `A1.2i repeated velocity for ${intervention.futureId}`
  );
  const sequence = Array.from({ length: horizon.stepCount }, () => [
    { actorId: "player" as const, velocity: { ...repeatedVelocity } },
    { actorId: "companion" as const, velocity: { x: 0, y: 0 } }
  ]);
  const physical = input.world.rehearseVelocitySequence(sequence);

  return {
    kind: "A1_PLAYER_FUTURE_PHYSICAL_REHEARSAL",
    futureId: intervention.futureId,
    futureFamily: intervention.futureFamily,
    sourceTick: intervention.sourceTick,
    causalMeaning: intervention.causalMeaning,
    interventionVelocity: { ...repeatedVelocity },
    declaredHorizonSeconds: intervention.horizonSeconds,
    worldStepSeconds: WORLD_STEP_SECONDS,
    worldStepCount: horizon.stepCount,
    executedHorizonSeconds: horizon.executedHorizonSeconds,
    horizonAlignmentErrorSeconds: horizon.alignmentErrorSeconds,
    companionBaseline: "LIVE_HOLD_CONTROL_ZERO_VELOCITY_EACH_WORLD_STEP",
    physical,
    horizonContract: "EXACT_INTEGER_WORLD_STEPS_A1_2I",
    sourceStateContract: "INTERVENTION_SOURCE_TICK_EQUALS_LIVE_WORLD_TICK_A1_2I",
    aggregationClaim: "NONE_SINGLE_INTERVENTION_A1_2I",
    companionCandidateClaim: "NONE_A1_2I_PLAYER_ONLY",
    g3SafetyClaim: "NONE_A1_2I_PHYSICAL_REHEARSAL_ONLY",
    commandAuthorityClaim: "NONE_A1_2I",
    runtimeAuthorityClaim: "NONE_A1_2I"
  };
}
