import { WORLD_STEP_SECONDS } from "../world/world";

export const A1_REHEARSAL_HORIZON_ALIGNMENT_EPSILON_SECONDS = 1e-12;

export interface A1WorldStepHorizon {
  declaredHorizonSeconds: number;
  worldStepSeconds: number;
  worldStepCount: number;
  executedHorizonSeconds: number;
  alignmentErrorSeconds: number;
}

/**
 * Converts a declared A1 rehearsal horizon into the exact live World timebase.
 * The nearest integer is used only to measure alignment; non-aligned horizons
 * are rejected rather than rounded into a different authority horizon.
 */
export function a1WorldStepHorizon(
  horizonSeconds: number,
  label: string
): A1WorldStepHorizon {
  if (!Number.isFinite(horizonSeconds) || horizonSeconds <= 0) {
    throw new Error(`${label} requires a positive finite horizonSeconds.`);
  }
  if (!Number.isFinite(WORLD_STEP_SECONDS) || WORLD_STEP_SECONDS <= 0) {
    throw new Error(`${label} requires a positive finite World timebase.`);
  }

  const worldStepCount = Math.round(horizonSeconds / WORLD_STEP_SECONDS);
  if (worldStepCount < 1) {
    throw new Error(`${label} horizon must contain at least one complete World step.`);
  }
  const executedHorizonSeconds = worldStepCount * WORLD_STEP_SECONDS;
  const alignmentErrorSeconds = Math.abs(executedHorizonSeconds - horizonSeconds);
  if (alignmentErrorSeconds > A1_REHEARSAL_HORIZON_ALIGNMENT_EPSILON_SECONDS) {
    throw new Error(
      `${label} horizon ${horizonSeconds} is not an exact integer multiple of World step ${WORLD_STEP_SECONDS}.`
    );
  }

  return {
    declaredHorizonSeconds: horizonSeconds,
    worldStepSeconds: WORLD_STEP_SECONDS,
    worldStepCount,
    executedHorizonSeconds,
    alignmentErrorSeconds
  };
}
