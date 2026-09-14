import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { R1HardComfortSpatialBrain } from "./r1-hard-comfort-spatial";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";

const RADIUS = 0.3;
const SPEED = 3;
const PLAYER_MOTION_ERROR_LIMIT = 0.02;
const PLAYER_DISPLACEMENT_LIMIT = 0.001;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1-5A physical fixture missing ${id}.`);
  return value;
}

function snapshotFor(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return {
    tick,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

interface TrialEvidence {
  mode: "DIRECT" | "NATURAL";
  minimumCenterDistance: number;
  contactFrames: number;
  maximumPlayerDisplacement: number;
  maximumPlayerMotionError: number;
  companionEnd: Vec2;
  playerEnd: Vec2;
}

async function runTrial(mode: TrialEvidence["mode"]): Promise<TrialEvidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5A ${mode} dynamic player-conflict rehearsal`,
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: { x: 5, y: 4 }, radius: RADIUS, speed: SPEED },
      { id: "companion", position: { x: 3.95, y: 4 }, radius: RADIUS, speed: SPEED }
    ],
    obstacles: []
  };
  const target = { x: 4, y: 6 };
  const physical = await RapierPhysicalWorld.create(spec);
  const direct = new R1HardComfortSpatialBrain();
  const natural = new R1NaturalSpatialLocomotionBrain();
  let tick = 0;
  let minimumCenterDistance = Number.POSITIVE_INFINITY;
  let contactFrames = 0;
  let maximumPlayerDisplacement = 0;
  let maximumPlayerMotionError = 0;

  try {
    let actors = physical.step([
      { actorId: "player", move: { x: 0, y: 0 } },
      { actorId: "companion", move: { x: 1, y: 0 } }
    ]);
    tick += 1;
    let snapshot = snapshotFor(spec, tick, actors);
    expect(actor(snapshot, "companion").actualVelocity.x).toBeGreaterThan(2.8);
    expect(distance(actor(snapshot, "player").position, actor(snapshot, "companion").position)).toBeGreaterThan(0.9);

    for (let step = 0; step < 36; step += 1) {
      const companion = actor(snapshot, "companion");
      const routePlan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });
      expect(routePlan.status).toBe("direct");

      const input = {
        snapshot,
        relationshipTarget: target,
        routePlan,
        query: (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
          physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center: Vec2, radius: number) => physical.staticCircleOccupancy(center, radius)
      };

      const companionIntent = mode === "DIRECT"
        ? direct.intent(input)
        : natural.intent(input);

      actors = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        companionIntent
      ]);
      tick += 1;
      snapshot = snapshotFor(spec, tick, actors);

      const afterPlayer = actor(snapshot, "player");
      const afterCompanion = actor(snapshot, "companion");
      minimumCenterDistance = Math.min(
        minimumCenterDistance,
        distance(afterPlayer.position, afterCompanion.position)
      );
      if (afterCompanion.contacts.some((contact) => contact.with === "player")) contactFrames += 1;
      maximumPlayerDisplacement = Math.max(
        maximumPlayerDisplacement,
        distance(afterPlayer.position, spec.actors[0]?.position ?? { x: 5, y: 4 })
      );
      maximumPlayerMotionError = Math.max(maximumPlayerMotionError, afterPlayer.motionError);
    }

    const finalSnapshot = snapshotFor(spec, tick, actors);
    return {
      mode,
      minimumCenterDistance,
      contactFrames,
      maximumPlayerDisplacement,
      maximumPlayerMotionError,
      companionEnd: { ...actor(finalSnapshot, "companion").position },
      playerEnd: { ...actor(finalSnapshot, "player").position }
    };
  } finally {
    physical.dispose();
  }
}

describe("R1-5A RED — material player disturbance from final dynamic-command gap", () => {
  it("does not materially disturb a stationary player when the equivalent DIRECT path is clean", async () => {
    const direct = await runTrial("DIRECT");
    const natural = await runTrial("NATURAL");

    // Contact manifold presence is evidence, not by itself a failure: S0
    // deliberately allows bounded actor contact. The R1-5 hard consequence is
    // loss of player agency: penetration/pushing or requested-vs-actual motion
    // disturbance caused by the companion.
    expect(direct.minimumCenterDistance).toBeGreaterThanOrEqual(RADIUS * 2);
    expect(direct.maximumPlayerDisplacement).toBeLessThan(PLAYER_DISPLACEMENT_LIMIT);
    expect(direct.maximumPlayerMotionError).toBeLessThan(PLAYER_MOTION_ERROR_LIMIT);

    if (
      natural.minimumCenterDistance < RADIUS * 2 - 1e-5 ||
      natural.maximumPlayerDisplacement >= PLAYER_DISPLACEMENT_LIMIT ||
      natural.maximumPlayerMotionError >= PLAYER_MOTION_ERROR_LIMIT
    ) {
      throw new Error(`R1-5A material consequence reproduced: NATURAL disturbs player authority while the equivalent DIRECT path remains clean.\n${JSON.stringify({ direct, natural }, null, 2)}`);
    }
  });
});
