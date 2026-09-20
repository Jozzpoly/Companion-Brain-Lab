import type { S2SituatedResponsibilityDecision } from "./situated-responsibility";
import type { SharedDangerSnapshot } from "../world/shared-danger-contract";
import type { MotionIntent, WorldSnapshot } from "../world/types";

export type SharedDangerReadinessState =
  | "NONE"
  | "GUARDING"
  | "HOLDING_READY";

export type SharedDangerReadinessReasonCode =
  | "NO_TRACKED_APPROACH"
  | "RESPONSIBILITY_ALREADY_ACTIVE"
  | "GUARD_TARGET_AVAILABLE"
  | "GUARD_GEOMETRY_COMPRESSED";

export interface SharedDangerReadinessDecision {
  kind: "SHARED_DANGER_READINESS";
  state: SharedDangerReadinessState;
  reasonCode: SharedDangerReadinessReasonCode;
  target: { x: number; y: number } | null;
  motionIntent: MotionIntent;
  playerToHostileDistance: number | null;
  companionToTargetDistance: number | null;
  reason: string;
}

export const READINESS_GUARD_OFFSET = 1.15;
export const READINESS_MIN_PLAYER_HOSTILE_SPACE = 2.05;
export const READINESS_ARRIVAL_RADIUS = 0.08;

function zero(
  reasonCode: SharedDangerReadinessReasonCode,
  reason: string,
  playerToHostileDistance: number | null = null
): SharedDangerReadinessDecision {
  return {
    kind: "SHARED_DANGER_READINESS",
    state: "NONE",
    reasonCode,
    target: null,
    motionIntent: { actorId: "companion", move: { x: 0, y: 0 } },
    playerToHostileDistance,
    companionToTargetDistance: null,
    reason
  };
}

export function evaluateSharedDangerReadiness(input: {
  snapshot: WorldSnapshot;
  danger: SharedDangerSnapshot | null;
  responsibility: S2SituatedResponsibilityDecision | null;
}): SharedDangerReadinessDecision {
  const danger = input.danger;
  const responsibility = input.responsibility;

  if (
    !danger ||
    danger.phase !== "APPROACHING" ||
    !responsibility ||
    responsibility.attention !== "TRACKING"
  ) {
    return zero(
      "NO_TRACKED_APPROACH",
      "readiness is only available while an external problem is being tracked during APPROACHING"
    );
  }

  if (responsibility.responsibility !== "NONE") {
    return zero(
      "RESPONSIBILITY_ALREADY_ACTIVE",
      "material responsibility is already active; readiness yields to the intervention path"
    );
  }

  const player = input.snapshot.actors.find((actor) => actor.id === "player");
  const companion = input.snapshot.actors.find((actor) => actor.id === "companion");
  const hostile = input.snapshot.actors.find((actor) => actor.id === "hostile");
  if (!player || !companion || !hostile) {
    throw new Error("Shared-danger readiness requires player, companion and hostile World bodies.");
  }

  const phx = hostile.position.x - player.position.x;
  const phy = hostile.position.y - player.position.y;
  const playerHostileDistance = Math.hypot(phx, phy);

  if (playerHostileDistance <= READINESS_MIN_PLAYER_HOSTILE_SPACE) {
    return {
      kind: "SHARED_DANGER_READINESS",
      state: "HOLDING_READY",
      reasonCode: "GUARD_GEOMETRY_COMPRESSED",
      target: null,
      motionIntent: { actorId: "companion", move: { x: 0, y: 0 } },
      playerToHostileDistance: playerHostileDistance,
      companionToTargetDistance: null,
      reason:
        "the tracked hostile is now too close to the player for the bounded between-bodies guard point; hold readiness instead of forcing a late chase"
    };
  }

  const inv = playerHostileDistance > 1e-9 ? 1 / playerHostileDistance : 0;
  const direction = { x: phx * inv, y: phy * inv };
  const target = {
    x: player.position.x + direction.x * READINESS_GUARD_OFFSET,
    y: player.position.y + direction.y * READINESS_GUARD_OFFSET
  };

  const tx = target.x - companion.position.x;
  const ty = target.y - companion.position.y;
  const companionTargetDistance = Math.hypot(tx, ty);
  const move = companionTargetDistance <= READINESS_ARRIVAL_RADIUS
    ? { x: 0, y: 0 }
    : {
        x: tx / companionTargetDistance,
        y: ty / companionTargetDistance
      };

  return {
    kind: "SHARED_DANGER_READINESS",
    state: "GUARDING",
    reasonCode: "GUARD_TARGET_AVAILABLE",
    target,
    motionIntent: { actorId: "companion", move },
    playerToHostileDistance: playerHostileDistance,
    companionToTargetDistance: companionTargetDistance,
    reason:
      "the companion tracks an approaching shared problem and prepares at a conservative player-local guard point without issuing an intervention"
  };
}
