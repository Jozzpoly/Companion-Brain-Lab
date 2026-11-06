/**
 * EXPLICIT, bounded live agency probe — not a general teammate brain.
 *
 * Owner: "C1, cover me." The companion uses observed embodied facts to
 * prepare, approach a nearby shared threat and intervene while the PLAYER
 * is under active pressure. A successful strike transfers danger to C1
 * under the unmodified Combat Micro World contract.
 *
 * No hidden hostile countdown, no scripted tick, no planner oracle. We do
 * not claim obstacle visibility; the probe is confined to OPEN Combat Micro.
 */
import type { FieldLabSquadControlSnapshot } from "../squad/field-lab-squad-control";
import type { CombatMicroSnapshot } from "../world/combat-micro-contract";
import type { FieldLabLayout, FieldLabSituation, Vec2, WorldSnapshot } from "../world/types";

export type CoverReason =
  | "OFF"
  | "OUTSIDE_LIVE_PROBE"
  | "YIELD_DIRECT_CONTROL"
  | "YIELD_PLAYER_ORDER"
  | "ENCOUNTER_OVER"
  | "COMPANION_CARRIES_PRESSURE"
  | "NO_RELEVANT_THREAT"
  | "PREPARING"
  | "INTERCEPTING"
  | "WAITING_FOR_PRESSURE"
  | "READY_TO_INTERVENE";

export interface CoverDecision {
  enabled: boolean;
  readyTicks: number;
  ready: boolean;
  reason: CoverReason;
  /** The ordinary Field Lab motion solver creates a real World command. */
  moveTarget: Vec2 | null;
  /** This is an actual current-tick World attempt, not a shadow recommendation. */
  strike: boolean;
  currentBearer: "player" | "companion" | null;
  threatDistance: number | null;
}

const PREPARATION_TICKS = 12;
const THREAT_NEAR_PLAYER = 3.6;
const C1_NEAR_THREAT = 3.1;
const C1_NEAR_PLAYER = 3.6;
const INTERCEPT_TARGET_DISTANCE = 0.74;

function pos(s: WorldSnapshot, id: "player" | "companion" | "hostile"): Vec2 | null {
  return s.actors.find(actor => actor.id === id)?.position ?? null;
}
function gap(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class CompanionCoverProbe {
  private enabledValue = false;
  private preparationTicks = 0;
  private lastDecision: CoverDecision = this.make("OFF", null, false, null, null);

  get enabled(): boolean { return this.enabledValue; }
  get snapshot(): CoverDecision { return { ...this.lastDecision, moveTarget: this.lastDecision.moveTarget && {...this.lastDecision.moveTarget} }; }

  setEnabled(value: boolean): void {
    this.enabledValue = value;
    this.preparationTicks = 0;
    this.lastDecision = this.make(value ? "NO_RELEVANT_THREAT" : "OFF", null, false, null, null);
  }

  /** World reconstruction ends the prior authority episode and resets readiness. */
  worldReconstructed(): void {
    this.preparationTicks = 0;
    this.lastDecision = this.make(this.enabledValue ? "NO_RELEVANT_THREAT" : "OFF", null, false, null, null);
  }

  private make(
    reason: CoverReason,
    moveTarget: Vec2 | null,
    strike: boolean,
    currentBearer: "player" | "companion" | null,
    threatDistance: number | null
  ): CoverDecision {
    return {
      enabled: this.enabledValue,
      readyTicks: this.preparationTicks,
      ready: this.preparationTicks >= PREPARATION_TICKS,
      reason,
      moveTarget,
      strike,
      currentBearer,
      threatDistance
    };
  }

  step(input: {
    world: WorldSnapshot;
    combat: CombatMicroSnapshot | null;
    control: FieldLabSquadControlSnapshot;
    situation: FieldLabSituation;
    layout: FieldLabLayout;
    strikeRange: number;
  }): CoverDecision {
    const report = (
      reason: CoverReason,
      moveTarget: Vec2 | null = null,
      strike = false,
      bearer: "player" | "companion" | null = null,
      threatDistance: number | null = null
    ): CoverDecision => {
      this.lastDecision = this.make(reason, moveTarget, strike, bearer, threatDistance);
      return this.snapshot;
    };
    if (!this.enabledValue) return report("OFF");

    // No pseudo-perception through pillars. Only the specific OPEN fixture is
    // currently qualified for a situated intervention claim.
    if (input.situation !== "COMBAT_MICRO" || input.layout !== "OPEN" || !input.combat ||
        !input.control.activeMembers.includes("companion")) {
      this.preparationTicks = 0;
      return report("OUTSIDE_LIVE_PROBE");
    }
    if (input.control.directControl && input.control.focused === "companion") {
      this.preparationTicks = 0;
      return report("YIELD_DIRECT_CONTROL");
    }
    if (input.control.assignments.find(a => a.memberId === "companion")?.mode !== "FOLLOW") {
      this.preparationTicks = 0;
      return report("YIELD_PLAYER_ORDER");
    }
    if (input.combat.phase === "DEFEATED") {
      this.preparationTicks = 0;
      return report("ENCOUNTER_OVER", null, false, input.combat.targetActorId);
    }
    if (input.combat.targetActorId === "companion") {
      this.preparationTicks = 0;
      return report("COMPANION_CARRIES_PRESSURE", null, false, "companion");
    }

    const player = pos(input.world, "player");
    const companion = pos(input.world, "companion");
    const hostile = pos(input.world, "hostile");
    if (!player || !companion || !hostile) {
      this.preparationTicks = 0;
      return report("OUTSIDE_LIVE_PROBE");
    }
    const threatToPlayer = gap(hostile, player);
    const threatToCompanion = gap(hostile, companion);
    const bearer = input.combat.targetActorId;
    if (threatToPlayer > THREAT_NEAR_PLAYER ||
        !["APPROACHING", "PRESSURING"].includes(input.combat.phase)) {
      this.preparationTicks = 0;
      return report("NO_RELEVANT_THREAT", null, false, bearer, threatToCompanion);
    }

    if (threatToCompanion <= C1_NEAR_THREAT && gap(companion, player) <= C1_NEAR_PLAYER) {
      this.preparationTicks = Math.min(PREPARATION_TICKS, this.preparationTicks + 1);
    } else {
      this.preparationTicks = 0;
    }
    // Need to CLOSE A REAL DISTANCE; proximity of a stationary C1 is not
    // automatically counted as contribution or a strike.
    if (threatToCompanion > INTERCEPT_TARGET_DISTANCE) {
      const decision = this.preparationTicks >= PREPARATION_TICKS
        ? "INTERCEPTING" : "PREPARING";
      return report(decision, { ...hostile }, false, bearer, threatToCompanion);
    }
    if (input.combat.phase !== "PRESSURING") {
      return report("WAITING_FOR_PRESSURE", null, false, bearer, threatToCompanion);
    }
    if (this.preparationTicks < PREPARATION_TICKS ||
        threatToCompanion > input.strikeRange - 0.07) {
      return report("PREPARING", null, false, bearer, threatToCompanion);
    }
    return report("READY_TO_INTERVENE", null, true, bearer, threatToCompanion);
  }
}

/** Shared motor for browser and real-World test. A decision alone never moves a body. */
export function realizeCoverMotion(
  decision: CoverDecision,
  companionPosition: Vec2,
  dynamics: { responsiveness: number; slowdownRadius: number }
): Vec2 | null {
  if (!decision.moveTarget) return null;
  const delta = {
    x: decision.moveTarget.x - companionPosition.x,
    y: decision.moveTarget.y - companionPosition.y
  };
  const distance = Math.hypot(delta.x, delta.y);
  if (distance <= 0.12) return { x: 0, y: 0 };
  const slowdown = Math.max(0.12, Math.min(1.2, dynamics.slowdownRadius));
  const throttle = Math.max(0.08,
    Math.min(1, distance / slowdown) * dynamics.responsiveness);
  return {
    x: delta.x / distance * throttle,
    y: delta.y / distance * throttle
  };
}
