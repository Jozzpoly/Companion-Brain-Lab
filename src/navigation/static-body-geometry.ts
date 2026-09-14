import type { ObstacleSpec, Vec2, WorldSnapshot } from "../world/types";

const STATIC_BODY_GEOMETRY_EPSILON = 1e-6;

export function circleFitsStaticWorld(
  snapshot: Pick<WorldSnapshot, "width" | "height" | "obstacles">,
  point: Vec2,
  radius: number,
  obstacles: readonly ObstacleSpec[] = snapshot.obstacles
): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error("Static body point validity requires finite coordinates.");
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Static body point validity requires a finite positive radius.");
  }

  // Placement validity is deliberately conservative at exact contact. A body
  // whose circle only touches a boundary/obstacle is not a stable free target;
  // Rapier scene queries likewise expose tangent contact as collision evidence.
  if (
    point.x - radius <= STATIC_BODY_GEOMETRY_EPSILON ||
    point.y - radius <= STATIC_BODY_GEOMETRY_EPSILON ||
    point.x + radius >= snapshot.width - STATIC_BODY_GEOMETRY_EPSILON ||
    point.y + radius >= snapshot.height - STATIC_BODY_GEOMETRY_EPSILON
  ) {
    return false;
  }

  for (const obstacle of obstacles) {
    const nearestX = Math.max(obstacle.x, Math.min(point.x, obstacle.x + obstacle.width));
    const nearestY = Math.max(obstacle.y, Math.min(point.y, obstacle.y + obstacle.height));
    const dx = point.x - nearestX;
    const dy = point.y - nearestY;
    if (Math.hypot(dx, dy) <= radius + STATIC_BODY_GEOMETRY_EPSILON) return false;
  }

  return true;
}

export const FOUNDATION_STATIC_BODY_GEOMETRY_EPSILON = STATIC_BODY_GEOMETRY_EPSILON;
