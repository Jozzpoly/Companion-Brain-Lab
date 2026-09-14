import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame,
  type ShadowCoordinationFrame
} from "./shadow-coordination-frame";
import {
  CCC0_REGION_SCORE_WINDOW,
  shadowRegionSamplesAdjacent,
  type ShadowRegionSample
} from "./shadow-relationship-region";

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

function snapshot(tick: number, speed: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 20,
    height: 20,
    actors: [
      actor("companion", { x: 11.45, y: 10 }, { x: 0, y: 0 }),
      actor("player", { x: 10, y: 10 }, { x: speed, y: 0 })
    ],
    obstacles: []
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

function frame(state: WorldSnapshot, history = createEmptyShadowCoordinationHistory()): ShadowCoordinationFrame {
  return evaluateShadowCoordinationFrame({
    snapshot: state,
    query: clearQuery,
    physicalSpeedCapability: 3,
    history,
    legacyPreferredVelocity: { x: -0.2, y: 0 },
    legacyAuthoritativeVelocity: { x: -0.2, y: 0 }
  });
}

function components(samples: readonly ShadowRegionSample[], bestScore: number): ShadowRegionSample[][] {
  const eligible = samples.filter((sample) =>
    sample.routeEvaluated && sample.reachable && sample.score <= bestScore + CCC0_REGION_SCORE_WINDOW
  );
  const byId = new Map(eligible.map((sample) => [sample.id, sample]));
  const remaining = new Set(byId.keys());
  const result: ShadowRegionSample[][] = [];

  while (remaining.size > 0) {
    const firstId = remaining.values().next().value as string | undefined;
    if (!firstId) break;
    const first = byId.get(firstId);
    if (!first) break;
    const queue = [first];
    const component: ShadowRegionSample[] = [];
    remaining.delete(first.id);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);
      for (const candidateId of [...remaining]) {
        const candidate = byId.get(candidateId);
        if (candidate && shadowRegionSamplesAdjacent(current, candidate)) {
          remaining.delete(candidateId);
          queue.push(candidate);
        }
      }
    }
    result.push(component.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id)));
  }

  return result.sort((a, b) => (a[0]?.score ?? Infinity) - (b[0]?.score ?? Infinity));
}

function overlapCount(ids: readonly string[], previous: readonly string[]): number {
  const previousIds = new Set(previous);
  return ids.reduce((count, id) => count + (previousIds.has(id) ? 1 : 0), 0);
}

describe("CCC-0 memory fade topology characterization", () => {
  it("shows whether a still-good previous component is abandoned during the expiry cliff", () => {
    let current = frame(snapshot(0, 2));
    let previousCoherent = [...current.region.coherentSampleIds];
    const observations = [];

    for (let tick = 6; tick <= 42; tick += 6) {
      const next = frame(snapshot(tick, 0), current.nextHistory);
      const reachable = next.region.samples
        .filter((sample) => sample.routeEvaluated && sample.reachable)
        .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
      const bestScore = reachable[0]?.score ?? Number.POSITIVE_INFINITY;
      const groups = Number.isFinite(bestScore) ? components(next.region.samples, bestScore) : [];
      const selected = new Set(next.region.coherentSampleIds);

      observations.push({
        tick,
        strength: next.region.playerHeadingStrength,
        best: next.region.bestSampleId,
        anchor: next.region.representativeAnchor,
        selectedIds: next.region.coherentSampleIds,
        components: groups.map((group) => ({
          minScore: group[0]?.score ?? null,
          deltaFromBest: (group[0]?.score ?? bestScore) - bestScore,
          ids: group.map((sample) => sample.id),
          previousOverlap: overlapCount(group.map((sample) => sample.id), previousCoherent),
          selectedOverlap: group.reduce((count, sample) => count + (selected.has(sample.id) ? 1 : 0), 0)
        }))
      });

      previousCoherent = [...next.region.coherentSampleIds];
      current = next;
    }

    expect(observations).toHaveLength(7);
    console.info("[CCC0_AUDIT] memory-topology", JSON.stringify(observations));
  });
});
