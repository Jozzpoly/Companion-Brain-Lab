import type { Vec2 } from "../world/types";
import type { A1Situation } from "./a1-situation";

const EPSILON = 1e-9;

/**
 * Initial bounded semantic-memory hypothesis. The exact horizon is experimental,
 * not an architectural invariant. It intentionally starts near the qualified
 * CCC-0 short trajectory-memory horizon while remaining an A1-owned contract.
 */
export const A1_ORIENTATION_MEMORY_TICKS = 33;

export type A1RelationshipOrientationSource = "SAME_STEP_OWNER" | "OWNER_MEMORY" | "NONE";
export type A1SamplingBasisSource = "SEMANTIC_ORIENTATION" | "WORLD_AXIS_SAMPLING_ONLY";

export interface A1RelationshipOrientationMemory {
  provenance: "OWNER_CONTROL";
  direction: Vec2;
  sourceTick: number;
}

export interface A1RelationshipOrientationEvidence {
  tick: number;
  source: A1RelationshipOrientationSource;
  direction: Vec2 | null;
  sourceTick: number | null;
  ageTicks: number | null;
  strength: number;
  samplingBasis: Vec2;
  samplingBasisSource: A1SamplingBasisSource;
  nextMemory: A1RelationshipOrientationMemory | null;
  reason: string;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2): Vec2 {
  const length = magnitude(value);
  if (!Number.isFinite(length) || length <= EPSILON) {
    throw new Error("A1 relationship orientation requires a finite nonzero direction.");
  }
  return { x: value.x / length, y: value.y / length };
}

function cloneMemory(value: A1RelationshipOrientationMemory): A1RelationshipOrientationMemory {
  return {
    provenance: "OWNER_CONTROL",
    direction: { ...value.direction },
    sourceTick: value.sourceTick
  };
}

function validatedMemory(
  memory: A1RelationshipOrientationMemory | null | undefined,
  tick: number
): A1RelationshipOrientationMemory | null {
  if (!memory) return null;
  if (memory.provenance !== "OWNER_CONTROL") {
    throw new Error("A1 relationship orientation memory must be Owner-control provenance.");
  }
  if (!Number.isInteger(memory.sourceTick) || memory.sourceTick < 0 || memory.sourceTick > tick) {
    throw new Error(`A1 relationship orientation memory source tick ${memory.sourceTick} is invalid at t${tick}.`);
  }
  return {
    provenance: "OWNER_CONTROL",
    direction: normalized(memory.direction),
    sourceTick: memory.sourceTick
  };
}

export function a1OrientationMemoryStrength(ageTicks: number): number {
  if (!Number.isFinite(ageTicks) || ageTicks < 0) {
    throw new Error("A1 relationship orientation memory age must be finite and non-negative.");
  }
  const age = Math.floor(ageTicks);
  const remaining = Math.max(0, Math.min(1, 1 - age / A1_ORIENTATION_MEMORY_TICKS));
  return remaining * remaining * (3 - 2 * remaining);
}

export function evaluateA1RelationshipOrientation(input: {
  situation: A1Situation;
  memory?: A1RelationshipOrientationMemory | null;
}): A1RelationshipOrientationEvidence {
  const tick = input.situation.tick;
  if (input.situation.situated.tick !== tick || input.situation.situated.playerControl.sourceTick !== tick) {
    throw new Error("A1 relationship orientation requires same-tick situated Owner control evidence.");
  }

  const memory = validatedMemory(input.memory, tick);
  const currentControl = input.situation.playerRequestedVelocity.move;

  if (input.situation.situated.playerControl.active) {
    const direction = normalized(currentControl);
    const nextMemory: A1RelationshipOrientationMemory = {
      provenance: "OWNER_CONTROL",
      direction: { ...direction },
      sourceTick: tick
    };
    return {
      tick,
      source: "SAME_STEP_OWNER",
      direction,
      sourceTick: tick,
      ageTicks: 0,
      strength: 1,
      samplingBasis: { ...direction },
      samplingBasisSource: "SEMANTIC_ORIENTATION",
      nextMemory,
      reason: "meaningful same-step Owner control defines relationship orientation"
    };
  }

  if (memory) {
    const ageTicks = tick - memory.sourceTick;
    const strength = a1OrientationMemoryStrength(ageTicks);
    if (strength > EPSILON) {
      return {
        tick,
        source: "OWNER_MEMORY",
        direction: { ...memory.direction },
        sourceTick: memory.sourceTick,
        ageTicks,
        strength,
        samplingBasis: { ...memory.direction },
        samplingBasisSource: "SEMANTIC_ORIENTATION",
        nextMemory: cloneMemory(memory),
        reason: `same-step Owner control is inactive; bounded Owner-derived orientation memory remains (${strength.toFixed(3)})`
      };
    }
  }

  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "no meaningful same-step Owner control and no live Owner-derived orientation memory"
  };
}
