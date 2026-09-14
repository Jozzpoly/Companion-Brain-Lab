import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";

export type CompanionMode = "manual" | "chase" | "relational" | "spatial";

export const COMPANION_MODES: readonly CompanionMode[] = ["manual", "chase", "relational", "spatial"];

const TACTICAL_INTERVAL_TICKS = 6;
const PREFERRED_RADIUS = 1.45;
const MOTOR_STOP_RADIUS = 0.12;
const MOTOR_SLOW_RADIUS = 0.65;
const HYSTERESIS_MARGIN = 0.28;
const INVALID_SCORE = 1_000_000;
const HOLD_CURRENT_SLOT = "hold-current";

interface SlotDefinition {
  id: string;
  angle: number;
}

const SLOT_DEFINITIONS: readonly SlotDefinition[] = [
  { id: "front", angle: 0 },
  { id: "front-right", angle: Math.PI / 4 },
  { id: "right", angle: Math.PI / 2 },
  { id: "back-right", angle: (3 * Math.PI) / 4 },
  { id: "back", angle: Math.PI },
  { id: "back-left", angle: (5 * Math.PI) / 4 },
  { id: "left", angle: (3 * Math.PI) / 2 },
  { id: "front-left", angle: (7 * Math.PI) / 4 }
];

export interface CandidateScoreTerms {
  frontPenalty: number;
  travelCost: number;
  switchCost: number;
  invalidPenalty: number;
}

export interface RelationalCandidate {
  slot: string;
  position: Vec2;
  valid: boolean;
  score: number;
  terms: CandidateScoreTerms;
}

export type RelationalObjectiveState = "TARGET" | "NO_VALID_RELATIONAL_SLOT";

export interface RelationalDecision {
  mode: "relational";
  objectiveState: RelationalObjectiveState;
  selectedSlot: string;
  target: Vec2;
  playerDirection: Vec2;
  candidates: readonly RelationalCandidate[];
  reconsiderationCount: number;
  reconsideredAtTick: number;
  reason: string;
}

function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function normalized(v: Vec2): Vec2 {
  const length = magnitude(v);
  return length > 1e-9 ? { x: v.x / length, y: v.y / length } : { x: 0, y: 0 };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing actor in snapshot: ${id}`);
  return result;
}

function rotate(forward: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: forward.x * cos - forward.y * sin,
    y: forward.x * sin + forward.y * cos
  };
}

function candidateIsClear(snapshot: WorldSnapshot, point: Vec2, radius: number): boolean {
  return circleFitsStaticWorld(snapshot, point, radius);
}

export function evaluateRelationalCandidates(
  snapshot: WorldSnapshot,
  playerDirection: Vec2,
  previousSlot: string | null
): RelationalCandidate[] {
  const player = actor(snapshot, "player");
  const companion = actor(snapshot, "companion");
  const forward = normalized(playerDirection);
  if (magnitude(forward) < 0.99) throw new Error("Relational candidate evaluation requires a unit player direction.");

  return SLOT_DEFINITIONS.map((definition) => {
    const offsetDirection = rotate(forward, definition.angle);
    const position = {
      x: player.position.x + offsetDirection.x * PREFERRED_RADIUS,
      y: player.position.y + offsetDirection.y * PREFERRED_RADIUS
    };
    const valid = candidateIsClear(snapshot, position, companion.radius);
    const frontness = Math.max(0, offsetDirection.x * forward.x + offsetDirection.y * forward.y);
    const terms: CandidateScoreTerms = {
      frontPenalty: frontness * frontness * 6,
      travelCost: distance(companion.position, position) * 0.25,
      switchCost: previousSlot !== null && previousSlot !== definition.id ? 0.12 : 0,
      invalidPenalty: valid ? 0 : INVALID_SCORE
    };
    return {
      slot: definition.id,
      position,
      valid,
      score: terms.frontPenalty + terms.travelCost + terms.switchCost + terms.invalidPenalty,
      terms
    };
  });
}

export function selectRelationalCandidate(
  candidates: readonly RelationalCandidate[],
  previousSlot: string | null
): { candidate: RelationalCandidate; reason: string } {
  const valid = candidates.filter((candidate) => candidate.valid);
  if (valid.length === 0) throw new Error("No valid relational positioning candidate.");

  let best = valid[0];
  if (!best) throw new Error("No valid relational positioning candidate.");
  for (const candidate of valid.slice(1)) {
    if (candidate.score < best.score || (candidate.score === best.score && candidate.slot < best.slot)) best = candidate;
  }

  const previous = previousSlot === null ? undefined : valid.find((candidate) => candidate.slot === previousSlot);
  if (previous && previous.score <= best.score + HYSTERESIS_MARGIN) {
    return {
      candidate: previous,
      reason: previous.slot === best.slot
        ? `best slot remains ${previous.slot}`
        : `retain ${previous.slot}; alternative ${best.slot} is only ${(previous.score - best.score).toFixed(2)} better`
    };
  }

  return {
    candidate: best,
    reason: previous
      ? `switch ${previous.slot} → ${best.slot}; improvement ${(previous.score - best.score).toFixed(2)} exceeds hysteresis`
      : `initial best slot ${best.slot}`
  };
}

function observedPlayerDirection(snapshot: WorldSnapshot, fallback: Vec2): Vec2 {
  const player = actor(snapshot, "player");
  if (magnitude(player.requestedVelocity) > 0.15) return normalized(player.requestedVelocity);
  if (magnitude(player.actualVelocity) > 0.15) return normalized(player.actualVelocity);
  return fallback;
}

export function intentToward(snapshot: WorldSnapshot, target: Vec2): MotionIntent {
  const companion = actor(snapshot, "companion");
  const delta = { x: target.x - companion.position.x, y: target.y - companion.position.y };
  const dist = magnitude(delta);
  if (dist <= MOTOR_STOP_RADIUS) return { actorId: "companion", move: { x: 0, y: 0 } };
  const direction = normalized(delta);
  const throttle = Math.min(1, dist / MOTOR_SLOW_RADIUS);
  return {
    actorId: "companion",
    move: { x: direction.x * throttle, y: direction.y * throttle }
  };
}

export function chaseIntent(snapshot: WorldSnapshot): MotionIntent {
  const player = actor(snapshot, "player");
  const companion = actor(snapshot, "companion");
  const delta = {
    x: player.position.x - companion.position.x,
    y: player.position.y - companion.position.y
  };
  const dist = magnitude(delta);
  const stopDistance = player.radius + companion.radius + 0.05;
  if (dist <= stopDistance) return { actorId: "companion", move: { x: 0, y: 0 } };
  return { actorId: "companion", move: normalized(delta) };
}

export class RelationalPositioningBrain {
  private lastPlayerDirection: Vec2 = { x: 1, y: 0 };
  private selectedSlot: string | null = null;
  private decisionValue: RelationalDecision | null = null;
  private reconsiderationCount = 0;
  private nextReconsiderTick = 0;

  reset(): void {
    this.lastPlayerDirection = { x: 1, y: 0 };
    this.selectedSlot = null;
    this.decisionValue = null;
    this.reconsiderationCount = 0;
    this.nextReconsiderTick = 0;
  }

  intent(snapshot: WorldSnapshot): MotionIntent {
    const decision = this.decision(snapshot);
    return intentToward(snapshot, decision.target);
  }

  decision(snapshot: WorldSnapshot): RelationalDecision {
    if (this.decisionValue === null || snapshot.tick >= this.nextReconsiderTick) {
      this.reconsider(snapshot);
    }
    if (!this.decisionValue) throw new Error("Relational brain failed to produce a decision.");
    return this.decisionValue;
  }

  debugState(): RelationalDecision | null {
    return this.decisionValue;
  }

  private reconsider(snapshot: WorldSnapshot): void {
    this.lastPlayerDirection = observedPlayerDirection(snapshot, this.lastPlayerDirection);
    const candidates = evaluateRelationalCandidates(snapshot, this.lastPlayerDirection, this.selectedSlot);
    const hasValidCandidate = candidates.some((candidate) => candidate.valid);
    this.reconsiderationCount += 1;

    if (!hasValidCandidate) {
      const companion = actor(snapshot, "companion");
      // Exhausting the legacy eight-slot vocabulary is an ordinary constrained-world
      // state, not a program error. Hold the current body position and surface the
      // condition explicitly until the next tactical reconsideration. The planned
      // relationship-field replacement can later provide a richer fallback region.
      this.selectedSlot = null;
      this.decisionValue = {
        mode: "relational",
        objectiveState: "NO_VALID_RELATIONAL_SLOT",
        selectedSlot: HOLD_CURRENT_SLOT,
        target: { ...companion.position },
        playerDirection: { ...this.lastPlayerDirection },
        candidates,
        reconsiderationCount: this.reconsiderationCount,
        reconsideredAtTick: snapshot.tick,
        reason: "NO_VALID_RELATIONAL_SLOT: all legacy slots are currently illegal; hold current position and reconsider"
      };
      this.nextReconsiderTick = snapshot.tick + TACTICAL_INTERVAL_TICKS;
      return;
    }

    const selection = selectRelationalCandidate(candidates, this.selectedSlot);
    this.selectedSlot = selection.candidate.slot;
    this.decisionValue = {
      mode: "relational",
      objectiveState: "TARGET",
      selectedSlot: selection.candidate.slot,
      target: { ...selection.candidate.position },
      playerDirection: { ...this.lastPlayerDirection },
      candidates,
      reconsiderationCount: this.reconsiderationCount,
      reconsideredAtTick: snapshot.tick,
      reason: selection.reason
    };
    this.nextReconsiderTick = snapshot.tick + TACTICAL_INTERVAL_TICKS;
  }
}

export const S1_TACTICAL_INTERVAL_TICKS = TACTICAL_INTERVAL_TICKS;
export const S1_PREFERRED_RADIUS = PREFERRED_RADIUS;
export const S1_HYSTERESIS_MARGIN = HYSTERESIS_MARGIN;
