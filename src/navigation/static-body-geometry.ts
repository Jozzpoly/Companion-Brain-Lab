import type { ObstacleSpec, Vec2, WorldSnapshot } from "../world/types";

// Only absorbs floating-point equality noise. This is not gameplay clearance;
// route/corner clearance remains a separate higher-level contract.
const STATIC_BODY_GEOMETRY_EPSILON = 1e-9;

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

  // Point occupancy follows the physical backend: exact tangency is a legal
  // non-penetrating placement. Swept traversal/contact semantics are separate.
  if (
    point.x - radius < -STATIC_BODY_GEOMETRY_EPSILON ||
    point.y - radius < -STATIC_BODY_GEOMETRY_EPSILON ||
    point.x + radius > snapshot.width + STATIC_BODY_GEOMETRY_EPSILON ||
    point.y + radius > snapshot.height + STATIC_BODY_GEOMETRY_EPSILON
  ) {
    return false;
  }

  for (const obstacle of obstacles) {
    const nearestX = Math.max(obstacle.x, Math.min(point.x, obstacle.x + obstacle.width));
    const nearestY = Math.max(obstacle.y, Math.min(point.y, obstacle.y + obstacle.height));
    const dx = point.x - nearestX;
    const dy = point.y - nearestY;
    if (Math.hypot(dx, dy) < radius - STATIC_BODY_GEOMETRY_EPSILON) return false;
  }

  return true;
}

export const FOUNDATION_STATIC_BODY_GEOMETRY_EPSILON = STATIC_BODY_GEOMETRY_EPSILON;
