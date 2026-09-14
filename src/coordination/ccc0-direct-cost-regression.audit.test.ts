import { describe, expect, it } from "vitest";
import type {
  ActorSnapshot,
  ObstacleSpec,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import { evaluateShadowRelationshipRegion } from "./shadow-relationship-region";

function actor(id: ActorSnapshot["id"], position: Vec2, velocity: Vec2): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { ...velocity },
    actualVelocity: { ...velocity },
    motionError: 0,
    contacts: []
  };
}

const clearQuery: StaticTraversalQuery = (from, to, radius): StaticCircleTraversalResult => ({
  from: { ...from },
  to: { ...to },
  radius,
  distance: Math.hypot(to.x - from.x, to.y - from.y),
  clear: true,
  blocker: null
});

function farObstacles(count: number): ObstacleSpec[] {
  const result: ObstacleSpec[] = [];
  for (let index = 0; index < count; index += 1) {
    const side = index % 4;
    const lane = Math.floor(index / 4);
    const offset = 3 + lane * 1.1;
    const position = side === 0
      ? { x: offset, y: 2 }
      : side === 1
        ? { x: 36, y: offset }
        : side === 2
          ? { x: 36 - offset, y: 36 }
          : { x: 2, y: 36 - offset };
    result.push({
      id: `far-${index.toString().padStart(2, "0")}`,
      x: position.x,
      y: position.y,
      width: 0.45,
      height: 0.45
    });
  }
  return result;
}

function state(obstacles: ObstacleSpec[]): WorldSnapshot {
  return {
    tick: 0,
    scenarioId: "open",
    width: 40,
    height: 40,
    actors: [
      actor("companion", { x: 18, y: 20 }, { x: 0, y: 0 }),
      actor("player", { x: 20, y: 20 }, { x: 1, y: 0 })
    ],
    obstacles
  };
}

describe("CCC-0 direct WHERE cost regression", () => {
  it("does not rebuild global route graphs for directly reachable samples", () => {
    const observations = [0, 1, 2, 4, 8, 12].map((count) => {
      const region = evaluateShadowRelationshipRegion({
        snapshot: state(farObstacles(count)),
        query: clearQuery
      });
      return {
        obstacles: count,
        queries: region.staticTraversalQueryCount,
        bestSampleId: region.bestSampleId,
        anchor: region.representativeAnchor
      };
    });

    const baseline = observations[0]!;
    expect(baseline.queries).toBe(26);
    for (const entry of observations.slice(1)) {
      expect(entry.queries).toBe(baseline.queries);
      expect(entry.bestSampleId).toBe(baseline.bestSampleId);
      expect(entry.anchor).toEqual(baseline.anchor);
    }

    console.info("[CCC0_REPAIR] direct-query-scaling", JSON.stringify(observations));
  });
});
