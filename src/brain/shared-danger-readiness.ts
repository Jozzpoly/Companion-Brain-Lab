import type { S2SituatedResponsibilityDecision } from "./situated-responsibility";
import type { SharedDangerSnapshot } from "../world/shared-danger-contract";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

export type SharedDangerReadinessState =
  | "NONE"
  | "GUARDING"
  | "HOLDING_READY";

export type SharedDangerReadinessReasonCode =
  | "NO_TRACKED_APPROACH"
  | "RESPONSIBILITY_ALREADY_ACTIVE"
  | "INTERCEPT_FLANK_AVAILABLE"
  | "INTERCEPT_FLANK_REACHED";

export interface SharedDangerReadinessDecision {
  kind: "SHARED_DANGER_READINESS";
  state: SharedDangerReadinessState;
  reasonCode: SharedDangerReadinessReasonCode;
  target: Vec2 | null;
  motionIntent: MotionIntent;
  playerToHostileDistance: number | null;
  companionToTargetDistance: number | null;
  side: -1 | 1 | null;
  reason: string;
}

/**
 * Deliberately apparatus-local geometry.
 *
 * The companion prepares near the player, slightly forward and laterally off
 * the hostile's direct path. This creates an intercept position for the later
 * explicit action without pretending that the S1 sensor hostile is physically
 * body-blocked by readiness movement.
 */
export const READINESS_FORWARD_OFFSET = 0.45;
export const READINESS_LATERAL_OFFSET = 0.65;
export const READINESS_ARRIVAL_RADIUS = 0.08;
const READINESS_SIDE_DEADBAND = 0.05;

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
    side: null,
    reason
  };
}

function chooseStableLocalSide(input: {
  player: Vec2;
  companion: Vec2;
  perpendicular: Vec2;
}): -1 | 1 {
  const cx = input.companion.x - input.player.x;
  const cy = input.companion.y - input.player.y;
  const lateral = cx * input.perpendicular.x + cy * input.perpendicular.y;
  if (lateral > READINESS_SIDE_DEADBAND) return 1;
  if (lateral < -READINESS_SIDE_DEADBAND) return -1;
  // The authored S1 fixture begins collinear. Pick one deterministic flank;
  // subsequent frames preserve it because the companion moves onto that side.
  return -1;
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
  if (playerHostileDistance <= 1e-9) {
    return zero(
      "NO_TRACKED_APPROACH",
      "player and hostile positions do not define a usable readiness direction",
      playerHostileDistance
    );
  }

  const forward = {
    x: phx / playerHostileDistance,
    y: phy / playerHostileDistance
  };
  const perpendicular = { x: -forward.y, y: forward.x };
  const side = chooseStableLocalSide({
    player: player.position,
    companion: companion.position,
    perpendicular
  });

  const target = {
    x:
      player.position.x +
      forward.x * READINESS_FORWARD_OFFSET +
      perpendicular.x * READINESS_LATERAL_OFFSET * side,
    y:
      player.position.y +
      forward.y * READINESS_FORWARD_OFFSET +
      perpendicular.y * READINESS_LATERAL_OFFSET * side
  };

  const tx = target.x - companion.position.x;
  const ty = target.y - companion.position.y;
  const companionTargetDistance = Math.hypot(tx, ty);
  const arrived = companionTargetDistance <= READINESS_ARRIVAL_RADIUS;

  return {
    kind: "SHARED_DANGER_READINESS",
    state: arrived ? "HOLDING_READY" : "GUARDING",
    reasonCode: arrived ? "INTERCEPT_FLANK_REACHED" : "INTERCEPT_FLANK_AVAILABLE",
    target,
    motionIntent: {
      actorId: "companion",
      move: arrived
        ? { x: 0, y: 0 }
        : {
            x: tx / companionTargetDistance,
            y: ty / companionTargetDistance
          }
    },
    playerToHostileDistance: playerHostileDistance,
    companionToTargetDistance: companionTargetDistance,
    side,
    reason: arrived
      ? "the companion has reached a player-local off-axis intercept flank and holds preparation without issuing a material action"
      : "the companion tracks the approaching problem and moves to a player-local off-axis intercept flank without chasing or body-blocking the hostile"
  };
}
