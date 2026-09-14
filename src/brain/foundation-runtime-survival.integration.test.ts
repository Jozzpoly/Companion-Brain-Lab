import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, MotionIntent, ScenarioSpec, WorldSnapshot } from "../world/types";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";

const RADIUS = 0.3;

function snapshot(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return {
    tick,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

function finiteActors(actors: readonly ActorSnapshot[]): boolean {
  return actors.every((actor) => [
    actor.position.x,
    actor.position.y,
    actor.requestedVelocity.x,
    actor.requestedVelocity.y,
    actor.actualVelocity.x,
    actor.actualVelocity.y,
    actor.motionError
  ].every(Number.isFinite));
}

describe("foundation full-chain runtime survival", () => {
  it("survives hard-overlap + approaching-player contention for 180 World steps", async () => {
    const fixture: ScenarioSpec = {
      id: "pillar",
      label: "dynamic runtime survival",
      width: 12,
      height: 8,
      actors: [
        { id: "companion", position: { x: 6.285, y: 4 }, radius: RADIUS, speed: 3 },
        { id: "player", position: { x: 7.6, y: 4 }, radius: RADIUS, speed: 3 }
      ],
      obstacles: [{ id: "foundation.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const physical = await RapierPhysicalWorld.create(fixture);
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 8.8, y: 4 };
    let tick = 0;
    let actors = physical.snapshot();
    const seenSafety = new Set<string>();
    const seenProgress = new Set<string>();

    try {
      for (let step = 0; step < 180; step += 1) {
        const pre = snapshot(fixture, tick, actors);
        const companion = pre.actors.find((actor) => actor.id === "companion");
        if (!companion) throw new Error("survival fixture missing companion");
        const route = planStaticShadowRoute({
          snapshot: pre,
          start: companion.position,
          target,
          radius: companion.radius,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
        });
        const companionIntent = brain.intent({
          snapshot: pre,
          relationshipTarget: target,
          routePlan: route,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
        const repair = brain.debugState().movement.repair;
        if (repair) seenSafety.add(repair.localSafetyState);

        const playerMove = step < 70
          ? { x: -1, y: 0 }
          : step < 110
            ? { x: 0, y: 1 }
            : { x: 1, y: 0 };
        const playerIntent: MotionIntent = { actorId: "player", move: playerMove };
        actors = physical.step([playerIntent, companionIntent]);
        tick += 1;
        expect(finiteActors(actors)).toBe(true);

        const post = snapshot(fixture, tick, actors);
        const postCompanion = post.actors.find((actor) => actor.id === "companion");
        if (!postCompanion) throw new Error("survival fixture missing post-step companion");
        const postRoute = planStaticShadowRoute({
          snapshot: post,
          start: postCompanion.position,
          target,
          radius: postCompanion.radius,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
        });
        const progress = brain.observeOutcome({
          snapshot: post,
          objectiveKey: "foundation:dynamic-survival",
          target,
          routePlan: postRoute
        });
        seenProgress.add(progress.state);
      }

      expect(tick).toBe(180);
      expect(seenSafety.has("HARD_EGRESS") || seenSafety.has("NO_SAFE_VELOCITY")).toBe(true);
      expect(seenProgress.size).toBeGreaterThan(0);
      expect(finiteActors(actors)).toBe(true);
    } finally {
      physical.dispose();
    }
  });
});
