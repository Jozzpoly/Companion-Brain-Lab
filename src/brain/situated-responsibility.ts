import type {
  SharedDangerRules,
  SharedDangerSnapshot
} from "../world/shared-danger-contract";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";

export type S2AttentionState = "NONE" | "TRACKING";
export type S2ResponsibilityState = "NONE" | "OWNED";

export type S2ResponsibilityReasonCode =
  | "NO_ACTIVE_PROBLEM"
  | "APPROACHING_MONITOR_ONLY"
  | "PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE"
  | "INTERVENTION_REACHABLE_BEFORE_CONSEQUENCE"
  | "INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE"
  | "EPISODE_RESOLVING";

export interface S2SituatedResponsibilityEvidence {
  phase: SharedDangerSnapshot["phase"] | "NONE";
  playerToHostileDistance: number | null;
  companionToHostileDistance: number | null;
  playerAtMaterialRisk: boolean;
  straightLineTicksToInterventionRange: number | null;
  consequenceTicksRemaining: number | null;
  interventionRange: number;
  attackRange: number;
}

export interface S2SituatedResponsibilityDecision {
  kind: "S2_SITUATED_RESPONSIBILITY";
  tick: number;
  focusId: "hostile" | null;
  attention: S2AttentionState;
  responsibility: S2ResponsibilityState;
  reasonCode: S2ResponsibilityReasonCode;
  reason: string;
  evidence: S2SituatedResponsibilityEvidence;
}

export interface EvaluateS2SituatedResponsibilityInput {
  snapshot: WorldSnapshot;
  danger: SharedDangerSnapshot | null;
  rules: SharedDangerRules;
  companionMaxSpeed: number;
  worldStepSeconds: number;
}

function body(snapshot: WorldSnapshot, id: "player" | "companion" | "hostile"): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`S2 situated responsibility requires World body ${id}.`);
  return value;
}

function distance(a: ActorSnapshot, b: ActorSnapshot): number {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be finite and > 0.`);
  }
}

/**
 * Straight-line lower bound only.
 *
 * S2 deliberately uses the open S1 fixture and must not promote this estimate
 * into general reachability/pathfinding authority. It asks only whether a
 * companion with its current movement capability could cover the remaining
 * Euclidean gap before the already-committed consequence resolves.
 */
function ticksToInterventionRange(
  companionToHostileDistance: number,
  interventionRange: number,
  companionMaxSpeed: number,
  worldStepSeconds: number
): number {
  const remainingDistance = Math.max(0, companionToHostileDistance - interventionRange);
  if (remainingDistance <= 1e-9) return 0;
  const distancePerTick = companionMaxSpeed * worldStepSeconds;
  return Math.ceil(remainingDistance / distancePerTick);
}

function decisionBase(
  tick: number,
  input: EvaluateS2SituatedResponsibilityInput,
  phase: S2SituatedResponsibilityEvidence["phase"],
  playerToHostileDistance: number | null,
  companionToHostileDistance: number | null,
  playerAtMaterialRisk: boolean,
  straightLineTicks: number | null,
  consequenceTicksRemaining: number | null
): Pick<S2SituatedResponsibilityDecision, "kind" | "tick" | "evidence"> {
  return {
    kind: "S2_SITUATED_RESPONSIBILITY",
    tick,
    evidence: {
      phase,
      playerToHostileDistance,
      companionToHostileDistance,
      playerAtMaterialRisk,
      straightLineTicksToInterventionRange: straightLineTicks,
      consequenceTicksRemaining,
      interventionRange: input.rules.interventionRange,
      attackRange: input.rules.attackRange
    }
  };
}

export function evaluateS2SituatedResponsibility(
  input: EvaluateS2SituatedResponsibilityInput
): S2SituatedResponsibilityDecision {
  assertPositiveFinite(input.companionMaxSpeed, "S2 companionMaxSpeed");
  assertPositiveFinite(input.worldStepSeconds, "S2 worldStepSeconds");

  const { snapshot, danger } = input;
  if (!danger || danger.phase === "COMPLETE") {
    return {
      ...decisionBase(snapshot.tick, input, danger?.phase ?? "NONE", null, null, false, null, null),
      focusId: null,
      attention: "NONE",
      responsibility: "NONE",
      reasonCode: "NO_ACTIVE_PROBLEM",
      reason: danger
        ? "shared-danger episode is complete; no current external problem owns attention"
        : "no shared-danger problem exists in the current World situation"
    };
  }

  const player = body(snapshot, "player");
  const companion = body(snapshot, "companion");
  const hostile = body(snapshot, "hostile");
  const playerDistance = distance(player, hostile);
  const companionDistance = distance(companion, hostile);

  if (danger.phase === "APPROACHING") {
    return {
      ...decisionBase(
        snapshot.tick,
        input,
        danger.phase,
        playerDistance,
        companionDistance,
        false,
        null,
        null
      ),
      focusId: "hostile",
      attention: "TRACKING",
      responsibility: "NONE",
      reasonCode: "APPROACHING_MONITOR_ONLY",
      reason:
        "an external problem is approaching the player, but no hostile consequence is committed yet; track it without claiming action responsibility"
    };
  }

  if (danger.phase === "RECOVERING") {
    return {
      ...decisionBase(
        snapshot.tick,
        input,
        danger.phase,
        playerDistance,
        companionDistance,
        false,
        null,
        danger.phaseTicksRemaining
      ),
      focusId: "hostile",
      attention: "TRACKING",
      responsibility: "NONE",
      reasonCode: "EPISODE_RESOLVING",
      reason:
        "the external problem remains relevant to attention while its previous consequence is resolving; active intervention responsibility is withdrawn"
    };
  }

  const playerAtMaterialRisk =
    playerDistance <= input.rules.attackRange + 1e-9;
  const straightLineTicks = ticksToInterventionRange(
    companionDistance,
    input.rules.interventionRange,
    input.companionMaxSpeed,
    input.worldStepSeconds
  );

  if (!playerAtMaterialRisk) {
    return {
      ...decisionBase(
        snapshot.tick,
        input,
        danger.phase,
        playerDistance,
        companionDistance,
        false,
        straightLineTicks,
        danger.phaseTicksRemaining
      ),
      focusId: "hostile",
      attention: "TRACKING",
      responsibility: "NONE",
      reasonCode: "PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE",
      reason:
        "the hostile is committed, but the player's current authoritative position is already outside factual attack range; keep attention without owning an unnecessary intervention"
    };
  }

  if (straightLineTicks <= danger.phaseTicksRemaining) {
    return {
      ...decisionBase(
        snapshot.tick,
        input,
        danger.phase,
        playerDistance,
        companionDistance,
        true,
        straightLineTicks,
        danger.phaseTicksRemaining
      ),
      focusId: "hostile",
      attention: "TRACKING",
      responsibility: "OWNED",
      reasonCode: "INTERVENTION_REACHABLE_BEFORE_CONSEQUENCE",
      reason:
        `the player remains in factual attack range and the companion can cover the straight-line intervention gap in ${straightLineTicks}t within the remaining ${danger.phaseTicksRemaining}t commitment window`
    };
  }

  return {
    ...decisionBase(
      snapshot.tick,
      input,
      danger.phase,
      playerDistance,
      companionDistance,
      true,
      straightLineTicks,
      danger.phaseTicksRemaining
    ),
    focusId: "hostile",
    attention: "TRACKING",
    responsibility: "NONE",
    reasonCode: "INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE",
    reason:
      `the player remains at factual risk, but the companion needs at least ${straightLineTicks}t to reach intervention range and only ${danger.phaseTicksRemaining}t remain; observe without claiming responsibility it cannot materially discharge`
  };
}
