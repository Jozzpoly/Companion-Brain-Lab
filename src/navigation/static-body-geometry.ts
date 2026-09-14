import type { ObstacleSpec, Vec2, WorldSnapshot } from "../world/types";

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

  if (
    point.x - radius < 0 ||
    point.y - radius < 0 ||
    point.x + radius > snapshot.width ||
    point.y + radius > snapshot.height
  ) {
    return false;
  }

  for (const obstacle of obstacles) {
    const nearestX = Math.max(obstacle.x, Math.min(point.x, obstacle.x + obstacle.width));
    const nearestY = Math.max(obstacle.y, Math.min(point.y, obstacle.y + obstacle.height));
    const dx = point.x - nearestX;
    const dy = point.y - nearestY;
    if (Math.hypot(dx, dy) < radius) return false;
  }

  return true;
}
