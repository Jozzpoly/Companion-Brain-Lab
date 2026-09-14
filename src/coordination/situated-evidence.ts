import type { MovementCapability } from "../world/movement-capability";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";

const CONTROL_EPSILON = 0.03;
const MOTION_EPSILON = 0.08;
const ALIGNMENT_MIN = 0.8;
const CONSTRAINED_SPEED_RATIO = 0.25;

export type ObservedPlayerMotionProvenance =
  | "OWNER_DIRECTED"
  | "OWNER_CONSTRAINED"
  | "EXTERNAL_MOTION_EVIDENT"
  | "MIXED_OR_UNCERTAIN"
  | "STATIONARY";

export interface PlayerControlEvidence {
  sourceTick: number;
  move: Vec2;
  active: boolean;
}

export interface PlayerBodyEvidence {
  sourceTick: number;
  position: Vec2;
  requestedVelocity: Vec2;
  actualVelocity: Vec2;
  motionError: number;
  contacts: readonly string[];
}

export interface PlayerMotionProvenanceEvidence {
  state: ObservedPlayerMotionProvenance;
  reason: string;
  requestedSpeed: number;
  actualSpeed: number;
  requestedActualAlignment: number | null;
}

export interface SituatedEvidenceFrame {
  tick: number;
  playerControl: PlayerControlEvidence;
  playerBody: PlayerBodyEvidence;
  playerMotionProvenance: PlayerMotionProvenanceEvidence;
  playerCapability: MovementCapability;
  companionBody: PlayerBodyEvidence;
  companionCapability: MovementCapability;
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Situated evidence missing ${id} actor.`);
  return value;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function alignment(a: Vec2, b: Vec2): number | null {
  const aLength = magnitude(a);
  const bLength = magnitude(b);
  if (aLength <= MOTION_EPSILON || bLength <= MOTION_EPSILON) return null;
  return (a.x * b.x + a.y * b.y) / (aLength * bLength);
}

function bodyEvidence(snapshot: WorldSnapshot, value: ActorSnapshot): PlayerBodyEvidence {
  return {
    sourceTick: snapshot.tick,
    position: { ...value.position },
    requestedVelocity: { ...value.requestedVelocity },
    actualVelocity: { ...value.actualVelocity },
    motionError: value.motionError,
    contacts: value.contacts.map((contact) => contact.with)
  };
}

export function classifyObservedPlayerMotion(
  body: PlayerBodyEvidence
): PlayerMotionProvenanceEvidence {
  const requestedSpeed = magnitude(body.requestedVelocity);
  const actualSpeed = magnitude(body.actualVelocity);
  const requestedActualAlignment = alignment(body.requestedVelocity, body.actualVelocity);
  const hasContacts = body.contacts.length > 0;

  if (requestedSpeed <= MOTION_EPSILON && actualSpeed <= MOTION_EPSILON) {
    return {
      state: "STATIONARY",
      reason: "requested and actual body motion are both below the meaningful-motion threshold",
      requestedSpeed,
      actualSpeed,
      requestedActualAlignment
    };
  }

  if (requestedSpeed <= MOTION_EPSILON && actualSpeed > MOTION_EPSILON) {
    return {
      state: hasContacts ? "EXTERNAL_MOTION_EVIDENT" : "MIXED_OR_UNCERTAIN",
      reason: hasContacts
        ? "actual body motion is material despite near-zero requested motion while contact evidence is present"
        : "actual body motion is material despite near-zero requested motion, but contact evidence does not identify a likely external source",
      requestedSpeed,
      actualSpeed,
      requestedActualAlignment
    };
  }

  if (actualSpeed <= MOTION_EPSILON || actualSpeed < requestedSpeed * CONSTRAINED_SPEED_RATIO) {
    return {
      state: "OWNER_CONSTRAINED",
      reason: "requested body motion is meaningful but the observed body response is strongly suppressed",
      requestedSpeed,
      actualSpeed,
      requestedActualAlignment
    };
  }

  if (requestedActualAlignment !== null && requestedActualAlignment >= ALIGNMENT_MIN && !hasContacts) {
    return {
      state: "OWNER_DIRECTED",
      reason: "actual body motion is materially aligned with requested motion and no contact evidence indicates external disturbance",
      requestedSpeed,
      actualSpeed,
      requestedActualAlignment
    };
  }

  return {
    state: "MIXED_OR_UNCERTAIN",
    reason: hasContacts
      ? "requested and actual body motion are both material but contact or directional divergence makes causal ownership mixed"
      : "requested and actual body motion are both material but their directional agreement is insufficient for owner-directed attribution",
    requestedSpeed,
    actualSpeed,
    requestedActualAlignment
  };
}

export function buildSituatedEvidenceFrame(input: {
  snapshot: WorldSnapshot;
  playerControlMove: Vec2;
  playerCapability: MovementCapability;
  companionCapability: MovementCapability;
}): SituatedEvidenceFrame {
  const player = actor(input.snapshot, "player");
  const companion = actor(input.snapshot, "companion");
  const playerBody = bodyEvidence(input.snapshot, player);

  return {
    tick: input.snapshot.tick,
    playerControl: {
      sourceTick: input.snapshot.tick,
      move: { ...input.playerControlMove },
      active: magnitude(input.playerControlMove) > CONTROL_EPSILON
    },
    playerBody,
    playerMotionProvenance: classifyObservedPlayerMotion(playerBody),
    playerCapability: { ...input.playerCapability },
    companionBody: bodyEvidence(input.snapshot, companion),
    companionCapability: { ...input.companionCapability }
  };
}
