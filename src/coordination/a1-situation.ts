import {
  buildSituatedEvidenceFrame,
  type PlayerBodyEvidence,
  type PlayerMotionProvenanceEvidence,
  type SituatedEvidenceFrame
} from "./situated-evidence";
import type { OutcomeAttributionEvidence } from "./outcome-attribution";
import type { MovementCapability } from "../world/movement-capability";
import type { AuthorityA0WorldStepEvidence } from "../world/authority-a0-step-evidence";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

export interface A1PreviousOutcomeEvidence {
  observationTick: number;
  outcomeTick: number;
  ageTicks: number;
  playerBody: PlayerBodyEvidence;
  playerMotionProvenance: PlayerMotionProvenanceEvidence;
  companionOutcomeAttribution: OutcomeAttributionEvidence;
}

export interface A1SameStepPlayerRequest {
  sourceTick: number;
  move: Vec2;
  velocity: Vec2;
  speed: number;
  capabilityMaxSpeed: number;
  source: "same-step-owner-motion-intent";
}

export interface A1Situation {
  kind: "AUTHORITY_A1_SITUATION";
  tick: number;
  situated: SituatedEvidenceFrame;
  /** Same-step Owner request after the same unit-disk clamp used by World. */
  playerRequestedVelocity: A1SameStepPlayerRequest;
  /** The immediately preceding completed World step, never a substitute for current Owner input. */
  previousOutcome: A1PreviousOutcomeEvidence | null;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

/** Mirrors the World MotionIntent unit-disk contract; a real-World regression binds this copy to execution. */
function worldBoundedMove(value: Vec2): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error("A1 same-step player MotionIntent requires finite x/y components.");
  }
  const length = magnitude(value);
  if (length <= 1) return { ...value };
  return { x: value.x / length, y: value.y / length };
}

function sameStepPlayerRequest(
  tick: number,
  intent: MotionIntent,
  capability: MovementCapability
): A1SameStepPlayerRequest {
  const move = worldBoundedMove(intent.move);
  const velocity = {
    x: move.x * capability.maxSpeed,
    y: move.y * capability.maxSpeed
  };
  return {
    sourceTick: tick,
    move,
    velocity,
    speed: magnitude(velocity),
    capabilityMaxSpeed: capability.maxSpeed,
    source: "same-step-owner-motion-intent"
  };
}

function cloneBody(value: PlayerBodyEvidence): PlayerBodyEvidence {
  return {
    ...value,
    position: { ...value.position },
    requestedVelocity: { ...value.requestedVelocity },
    actualVelocity: { ...value.actualVelocity },
    contacts: [...value.contacts]
  };
}

function cloneAttribution(value: OutcomeAttributionEvidence): OutcomeAttributionEvidence {
  return {
    ...value,
    contacts: [...value.contacts]
  };
}

function previousOutcomeAt(
  tick: number,
  evidence: AuthorityA0WorldStepEvidence | null
): A1PreviousOutcomeEvidence | null {
  if (!evidence) {
    if (tick !== 0) {
      throw new Error("A1 situation is missing the immediately preceding World outcome for a nonzero tick.");
    }
    return null;
  }

  if (evidence.outcomeTick !== tick) {
    throw new Error(
      `A1 previous outcome must end at current tick ${tick}; received outcome t${evidence.outcomeTick}.`
    );
  }
  if (evidence.observationTick + 1 !== evidence.outcomeTick) {
    throw new Error("A1 previous outcome must preserve the adjacent t -> t+1 World-step contract.");
  }

  return {
    observationTick: evidence.observationTick,
    outcomeTick: evidence.outcomeTick,
    ageTicks: tick - evidence.outcomeTick,
    playerBody: cloneBody(evidence.playerOutcomeBody),
    playerMotionProvenance: { ...evidence.playerOutcomeMotionProvenance },
    companionOutcomeAttribution: cloneAttribution(evidence.companionOutcomeAttribution)
  };
}

export function buildA1Situation(input: {
  snapshot: WorldSnapshot;
  playerIntent: MotionIntent;
  playerCapability: MovementCapability;
  companionCapability: MovementCapability;
  previousWorldStep: AuthorityA0WorldStepEvidence | null;
}): A1Situation {
  if (input.playerIntent.actorId !== "player") {
    throw new Error("A1 situation requires the same-step player MotionIntent.");
  }
  if (input.playerCapability.actorId !== "player") {
    throw new Error("A1 situation requires player movement capability for the player actor.");
  }
  if (input.companionCapability.actorId !== "companion") {
    throw new Error("A1 situation requires companion movement capability for the companion actor.");
  }

  const situated = buildSituatedEvidenceFrame({
    snapshot: input.snapshot,
    playerControlMove: input.playerIntent.move,
    playerCapability: input.playerCapability,
    companionCapability: input.companionCapability
  });
  const playerRequestedVelocity = sameStepPlayerRequest(
    input.snapshot.tick,
    input.playerIntent,
    input.playerCapability
  );

  return {
    kind: "AUTHORITY_A1_SITUATION",
    tick: input.snapshot.tick,
    situated,
    playerRequestedVelocity,
    previousOutcome: previousOutcomeAt(input.snapshot.tick, input.previousWorldStep)
  };
}

export function cloneA1Situation(value: A1Situation): A1Situation {
  return {
    kind: value.kind,
    tick: value.tick,
    situated: {
      tick: value.situated.tick,
      playerControl: {
        sourceTick: value.situated.playerControl.sourceTick,
        move: { ...value.situated.playerControl.move },
        active: value.situated.playerControl.active
      },
      playerBody: cloneBody(value.situated.playerBody),
      playerMotionProvenance: { ...value.situated.playerMotionProvenance },
      playerCapability: { ...value.situated.playerCapability },
      companionBody: cloneBody(value.situated.companionBody),
      companionCapability: { ...value.situated.companionCapability }
    },
    playerRequestedVelocity: {
      ...value.playerRequestedVelocity,
      move: { ...value.playerRequestedVelocity.move },
      velocity: { ...value.playerRequestedVelocity.velocity }
    },
    previousOutcome: value.previousOutcome
      ? {
          ...value.previousOutcome,
          playerBody: cloneBody(value.previousOutcome.playerBody),
          playerMotionProvenance: { ...value.previousOutcome.playerMotionProvenance },
          companionOutcomeAttribution: cloneAttribution(value.previousOutcome.companionOutcomeAttribution)
        }
      : null
  };
}
