import { describe, expect, it } from "vitest";
import type {
  ActorSnapshot,
  ObstacleSpec,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame,
  type ShadowCoordinationFrame,
  type ShadowCoordinationHistory
} from "./shadow-coordination-frame";
import { evaluateShadowRelationshipRegion } from "./shadow-relationship-region";

function actor(
  id: ActorSnapshot["id"],
  position: Vec2,
  actualVelocity: Vec2 = { x: 0, y: 0 },
  requestedVelocity: Vec2 = actualVelocity
): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { ...requestedVelocity },
    actualVelocity: { ...actualVelocity },
    motionError: 0,
    contacts: []
  };
}

function snapshot(options: {
  tick?: number;
  width?: number;
  height?: number;
  playerPosition: Vec2;
  companionPosition: Vec2;
  playerVelocity?: Vec2;
  playerRequestedVelocity?: Vec2;
  companionVelocity?: Vec2;
  obstacles?: ObstacleSpec[];
}): WorldSnapshot {
  return {
    tick: options.tick ?? 0,
    scenarioId: "open",
    width: options.width ?? 20,
    height: options.height ?? 20,
    actors: [
      actor("companion", options.companionPosition, options.companionVelocity),
      actor(
        "player",
        options.playerPosition,
        options.playerVelocity,
        options.playerRequestedVelocity ?? options.playerVelocity
      )
    ],
    obstacles: options.obstacles ?? []
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

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function rotate90Vector(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

function rotate90Point(value: Vec2, center: Vec2): Vec2 {
  const relative = { x: value.x - center.x, y: value.y - center.y };
  const rotated = rotate90Vector(relative);
  return { x: center.x + rotated.x, y: center.y + rotated.y };
}

function expectVecClose(actual: Vec2 | null, expected: Vec2 | null, precision = 8): void {
  if (actual === null || expected === null) {
    expect(actual).toBe(expected);
    return;
  }
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

function frameFor(
  state: WorldSnapshot,
  options?: {
    history?: ShadowCoordinationHistory;
    relationshipTarget?: Vec2;
    preferredVelocity?: Vec2;
    authoritativeVelocity?: Vec2;
  }
): ShadowCoordinationFrame {
  return evaluateShadowCoordinationFrame({
    snapshot: state,
    query: clearQuery,
    physicalSpeedCapability: 3,
    history: options?.history ?? createEmptyShadowCoordinationHistory(),
    legacyRelationshipTarget: options?.relationshipTarget,
    legacyPreferredVelocity: options?.preferredVelocity,
    legacyAuthoritativeVelocity: options?.authoritativeVelocity
  });
}

function finiteOrNull(value: number | null): boolean {
  return value === null || Number.isFinite(value);
}

function assertFiniteFrame(frame: ShadowCoordinationFrame): void {
  expect(Number.isFinite(frame.pace.urgency)).toBe(true);
  expect(Number.isFinite(frame.pace.desiredSpeed)).toBe(true);
  expect(Number.isFinite(frame.playerCorridor.confidence)).toBe(true);
  expect(Number.isFinite(frame.playerCorridor.horizon)).toBe(true);
  expect(frame.region.samples.every((sample) =>
    Number.isFinite(sample.position.x) &&
    Number.isFinite(sample.position.y) &&
    Number.isFinite(sample.score) &&
    Number.isFinite(sample.localClearance)
  )).toBe(true);
  if (frame.region.representativeAnchor) {
    expect(Number.isFinite(frame.region.representativeAnchor.x)).toBe(true);
    expect(Number.isFinite(frame.region.representativeAnchor.y)).toBe(true);
  }
  for (const conflict of [frame.preferredPlayerFlowConflict, frame.authoritativePlayerFlowConflict]) {
    expect(finiteOrNull(conflict.closestApproachTime)).toBe(true);
    expect(finiteOrNull(conflict.closestCenterDistance)).toBe(true);
    expect(finiteOrNull(conflict.physicalClearance)).toBe(true);
    expect(finiteOrNull(conflict.comfortClearance)).toBe(true);
  }
}

function compactSignature(frame: ShadowCoordinationFrame) {
  return {
    tick: frame.tick,
    regionState: frame.region.state,
    headingSource: frame.region.playerHeadingSource,
    best: frame.region.bestSampleId,
    coherent: [...frame.region.coherentSampleIds],
    topology: frame.region.topologyKey,
    anchor: frame.region.representativeAnchor,
    routeEvaluated: frame.region.routeEvaluatedCount,
    traversalQueries: frame.region.staticTraversalQueryCount,
    pace: {
      label: frame.pace.label,
      urgency: frame.pace.urgency,
      desiredSpeed: frame.pace.desiredSpeed,
      outside: frame.pace.outsideRegionTicks,
      opening: frame.pace.relativeOpeningSpeed
    },
    corridor: {
      state: frame.playerCorridor.state,
      source: frame.playerCorridor.velocitySource,
      confidence: frame.playerCorridor.confidence,
      horizon: frame.playerCorridor.horizon,
      endpoint: frame.playerCorridor.endpoint
    },
    preferredConflict: {
      state: frame.preferredPlayerFlowConflict.state,
      clearance: frame.preferredPlayerFlowConflict.physicalClearance
    },
    authoritativeConflict: {
      state: frame.authoritativePlayerFlowConflict.state,
      clearance: frame.authoritativePlayerFlowConflict.physicalClearance
    }
  };
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function runSeededSequence(seed: number): ReturnType<typeof compactSignature>[] {
  const random = lcg(seed);
  let history = createEmptyShadowCoordinationHistory();
  const result: ReturnType<typeof compactSignature>[] = [];

  for (let index = 0; index < 240; index += 1) {
    const angle = random() * Math.PI * 2;
    const speed = random() * 3;
    const playerPosition = {
      x: 8 + random() * 4,
      y: 8 + random() * 4
    };
    const companionPosition = {
      x: 7 + random() * 6,
      y: 7 + random() * 6
    };
    const playerVelocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };
    const state = snapshot({
      tick: index * 6,
      playerPosition,
      companionPosition,
      playerVelocity,
      companionVelocity: {
        x: (random() - 0.5) * 2,
        y: (random() - 0.5) * 2
      }
    });
    const frame = frameFor(state, {
      history,
      relationshipTarget: add(playerPosition, { x: -1, y: 0.5 }),
      preferredVelocity: { x: (random() - 0.5) * 2, y: (random() - 0.5) * 2 },
      authoritativeVelocity: { x: (random() - 0.5) * 2, y: (random() - 0.5) * 2 }
    });
    assertFiniteFrame(frame);
    result.push(compactSignature(frame));
    history = frame.nextHistory;
  }

  return result;
}

function farObstacles(count: number): ObstacleSpec[] {
  const result: ObstacleSpec[] = [];
  for (let index = 0; index < count; index += 1) {
    const side = index % 4;
    const lane = Math.floor(index / 4);
    const offset = 3 + lane * 1.1;
    const obstacle = side === 0
      ? { x: offset, y: 2 }
      : side === 1
        ? { x: 36, y: offset }
        : side === 2
          ? { x: 36 - offset, y: 36 }
          : { x: 2, y: 36 - offset };
    result.push({
      id: `far-${index.toString().padStart(2, "0")}`,
      x: obstacle.x,
      y: obstacle.y,
      width: 0.45,
      height: 0.45
    });
  }
  return result;
}

describe("CCC-0 Owner-readiness falsification audit", () => {
  it("is translation-covariant in open space", () => {
    const delta = { x: 3, y: -2 };
    const playerPosition = { x: 10, y: 10 };
    const companionPosition = { x: 7.3, y: 8.4 };
    const relationshipTarget = { x: 9.2, y: 10.7 };
    const base = frameFor(snapshot({
      playerPosition,
      companionPosition,
      playerVelocity: { x: 1.2, y: 0.6 },
      companionVelocity: { x: 0.35, y: -0.2 }
    }), {
      relationshipTarget,
      preferredVelocity: { x: 0.8, y: 0.4 },
      authoritativeVelocity: { x: 0.65, y: 0.3 }
    });
    const shifted = frameFor(snapshot({
      playerPosition: add(playerPosition, delta),
      companionPosition: add(companionPosition, delta),
      playerVelocity: { x: 1.2, y: 0.6 },
      companionVelocity: { x: 0.35, y: -0.2 }
    }), {
      relationshipTarget: add(relationshipTarget, delta),
      preferredVelocity: { x: 0.8, y: 0.4 },
      authoritativeVelocity: { x: 0.65, y: 0.3 }
    });

    expect(shifted.region.state).toBe(base.region.state);
    expect(shifted.region.bestSampleId).toBe(base.region.bestSampleId);
    expect(shifted.region.coherentSampleIds).toEqual(base.region.coherentSampleIds);
    expect(shifted.region.routeEvaluatedCount).toBe(base.region.routeEvaluatedCount);
    expect(shifted.region.staticTraversalQueryCount).toBe(base.region.staticTraversalQueryCount);
    expectVecClose(
      shifted.region.representativeAnchor,
      base.region.representativeAnchor ? add(base.region.representativeAnchor, delta) : null
    );
    expect(shifted.pace.urgency).toBeCloseTo(base.pace.urgency, 10);
    expect(shifted.pace.desiredSpeed).toBeCloseTo(base.pace.desiredSpeed, 10);
    expect(shifted.pace.distanceToRegion).toBeCloseTo(base.pace.distanceToRegion ?? 0, 10);
    expect(shifted.playerCorridor.state).toBe(base.playerCorridor.state);
    expectVecClose(shifted.playerCorridor.endpoint, add(base.playerCorridor.endpoint, delta));
    expect(shifted.preferredPlayerFlowConflict.state).toBe(base.preferredPlayerFlowConflict.state);
    expect(shifted.preferredPlayerFlowConflict.physicalClearance).toBeCloseTo(
      base.preferredPlayerFlowConflict.physicalClearance ?? 0,
      10
    );
    expect(shifted.authoritativePlayerFlowConflict.state).toBe(base.authoritativePlayerFlowConflict.state);
    expect(shifted.authoritativePlayerFlowConflict.physicalClearance).toBeCloseTo(
      base.authoritativePlayerFlowConflict.physicalClearance ?? 0,
      10
    );
  });

  it("is quarter-turn rotation-covariant on the 32-direction lattice", () => {
    const center = { x: 10, y: 10 };
    const playerPosition = { x: 11.2, y: 9.1 };
    const companionPosition = { x: 7.5, y: 8.2 };
    const playerVelocity = { x: 1.35, y: 0.55 };
    const companionVelocity = { x: 0.3, y: -0.25 };
    const relationshipTarget = { x: 9.7, y: 9.8 };
    const preferredVelocity = { x: 0.9, y: 0.35 };
    const authoritativeVelocity = { x: 0.7, y: 0.2 };

    const base = frameFor(snapshot({
      playerPosition,
      companionPosition,
      playerVelocity,
      companionVelocity
    }), { relationshipTarget, preferredVelocity, authoritativeVelocity });

    const rotated = frameFor(snapshot({
      playerPosition: rotate90Point(playerPosition, center),
      companionPosition: rotate90Point(companionPosition, center),
      playerVelocity: rotate90Vector(playerVelocity),
      companionVelocity: rotate90Vector(companionVelocity)
    }), {
      relationshipTarget: rotate90Point(relationshipTarget, center),
      preferredVelocity: rotate90Vector(preferredVelocity),
      authoritativeVelocity: rotate90Vector(authoritativeVelocity)
    });

    expect(rotated.region.state).toBe(base.region.state);
    expect(rotated.region.routeEvaluatedCount).toBe(base.region.routeEvaluatedCount);
    expect(rotated.region.staticTraversalQueryCount).toBe(base.region.staticTraversalQueryCount);
    expectVecClose(
      rotated.region.representativeAnchor,
      base.region.representativeAnchor ? rotate90Point(base.region.representativeAnchor, center) : null,
      7
    );
    expectVecClose(rotated.region.playerDirection, rotate90Vector(base.region.playerDirection), 8);
    expect(rotated.pace.urgency).toBeCloseTo(base.pace.urgency, 8);
    expect(rotated.pace.desiredSpeed).toBeCloseTo(base.pace.desiredSpeed, 8);
    expect(rotated.pace.distanceToRegion).toBeCloseTo(base.pace.distanceToRegion ?? 0, 8);
    expect(rotated.playerCorridor.state).toBe(base.playerCorridor.state);
    expect(rotated.playerCorridor.confidence).toBeCloseTo(base.playerCorridor.confidence, 10);
    expect(rotated.playerCorridor.horizon).toBeCloseTo(base.playerCorridor.horizon, 10);
    expectVecClose(rotated.playerCorridor.endpoint, rotate90Point(base.playerCorridor.endpoint, center), 8);
    expect(rotated.preferredPlayerFlowConflict.state).toBe(base.preferredPlayerFlowConflict.state);
    expect(rotated.preferredPlayerFlowConflict.physicalClearance).toBeCloseTo(
      base.preferredPlayerFlowConflict.physicalClearance ?? 0,
      8
    );
    expect(rotated.authoritativePlayerFlowConflict.state).toBe(base.authoritativePlayerFlowConflict.state);
    expect(rotated.authoritativePlayerFlowConflict.physicalClearance).toBeCloseTo(
      base.authoritativePlayerFlowConflict.physicalClearance ?? 0,
      8
    );
  });

  it("replays a 24-second seeded adversarial evidence sequence exactly", () => {
    expect(runSeededSequence(0xc0ffee)).toEqual(runSeededSequence(0xc0ffee));
  });

  it("characterizes isotropic no-heading shortlist symmetry instead of assuming it", () => {
    const center = { x: 10, y: 10 };
    const region = evaluateShadowRelationshipRegion({
      snapshot: snapshot({ playerPosition: center, companionPosition: center }),
      query: clearQuery
    });
    expect(region.state).toBe("REGION");
    expect(region.playerHeadingSource).toBe("none");
    expect(region.samples.every((sample) => sample.terms.frontPenalty === 0)).toBe(true);

    const evaluated = region.samples.filter((sample) => sample.routeEvaluated);
    const resultant = evaluated.reduce(
      (sum, sample) => ({ x: sum.x + sample.direction.x, y: sum.y + sample.direction.y }),
      { x: 0, y: 0 }
    );
    const normalizedResultant = evaluated.length > 0
      ? Math.hypot(resultant.x, resultant.y) / evaluated.length
      : 0;
    const quadrants = [...new Set(evaluated.map((sample) => Math.floor(sample.angleIndex / 8)))].sort();
    const anchorOffset = region.representativeAnchor
      ? {
          x: region.representativeAnchor.x - center.x,
          y: region.representativeAnchor.y - center.y,
          distance: Math.hypot(region.representativeAnchor.x - center.x, region.representativeAnchor.y - center.y)
        }
      : null;

    console.info("[CCC0_AUDIT] isotropic-no-heading", JSON.stringify({
      routeAngles: evaluated.map((sample) => sample.angleIndex),
      quadrants,
      normalizedResultant,
      coherentSampleIds: region.coherentSampleIds,
      anchorOffset
    }));
  });

  it("characterizes the 0.15 m/s observation threshold from both sides", () => {
    const speeds = [0, 0.1, 0.145, 0.149, 0.151, 0.155, 0.2];
    const observations = speeds.map((speed) => {
      const frame = frameFor(snapshot({
        playerPosition: { x: 10, y: 10 },
        companionPosition: { x: 11.45, y: 10 },
        playerVelocity: { x: speed, y: 0 }
      }), {
        preferredVelocity: { x: -0.2, y: 0 },
        authoritativeVelocity: { x: -0.2, y: 0 }
      });
      assertFiniteFrame(frame);
      return {
        speed,
        headingSource: frame.region.playerHeadingSource,
        anchor: frame.region.representativeAnchor,
        topologyKey: frame.region.topologyKey,
        corridorState: frame.playerCorridor.state,
        corridorConfidence: frame.playerCorridor.confidence,
        corridorHorizon: frame.playerCorridor.horizon,
        paceUrgency: frame.pace.urgency
      };
    });
    const jumps = observations.slice(1).map((entry, index) => {
      const previous = observations[index];
      if (!previous?.anchor || !entry.anchor) return null;
      return {
        from: previous.speed,
        to: entry.speed,
        distance: Math.hypot(entry.anchor.x - previous.anchor.x, entry.anchor.y - previous.anchor.y)
      };
    });
    console.info("[CCC0_AUDIT] threshold-sweep", JSON.stringify({ observations, jumps }));
  });

  it("characterizes whether old player heading survives a prolonged stop", () => {
    let frame = frameFor(snapshot({
      tick: 0,
      playerPosition: { x: 10, y: 10 },
      companionPosition: { x: 8.5, y: 10 },
      playerVelocity: { x: 2, y: 0 }
    }));
    expect(frame.region.playerHeadingSource).toBe("actual");

    const sampled: Array<{ tick: number; headingSource: string; corridorState: string }> = [];
    for (let tick = 6; tick <= 600; tick += 6) {
      frame = frameFor(snapshot({
        tick,
        playerPosition: { x: 10, y: 10 },
        companionPosition: { x: 8.5, y: 10 },
        playerVelocity: { x: 0, y: 0 }
      }), { history: frame.nextHistory });
      if (tick === 6 || tick === 60 || tick === 120 || tick === 300 || tick === 600) {
        sampled.push({
          tick,
          headingSource: frame.region.playerHeadingSource,
          corridorState: frame.playerCorridor.state
        });
      }
    }

    const reversed = frameFor(snapshot({
      tick: 606,
      playerPosition: { x: 10, y: 10 },
      companionPosition: { x: 8.5, y: 10 },
      playerVelocity: { x: -2, y: 0 }
    }), { history: frame.nextHistory });
    assertFiniteFrame(reversed);

    console.info("[CCC0_AUDIT] prolonged-stop", JSON.stringify({
      sampled,
      reversal: {
        headingSource: reversed.region.playerHeadingSource,
        corridorState: reversed.playerCorridor.state,
        corridorConfidence: reversed.playerCorridor.confidence,
        previousDirection: reversed.playerCorridor.previousDirection
      }
    }));
  });

  it("characterizes global obstacle-count amplification even when obstacles are far from the local field", () => {
    const counts = [0, 1, 2, 4, 8, 12];
    const observations = counts.map((count) => {
      const state = snapshot({
        width: 40,
        height: 40,
        playerPosition: { x: 20, y: 20 },
        companionPosition: { x: 18, y: 20 },
        playerVelocity: { x: 1, y: 0 },
        obstacles: farObstacles(count)
      });
      const region = evaluateShadowRelationshipRegion({ snapshot: state, query: clearQuery });
      expect(region.state).toBe("REGION");
      expect(region.staticTraversalQueryCount).toBeGreaterThan(0);
      return {
        obstacles: count,
        routeTargets: region.routeEvaluatedCount,
        queries: region.staticTraversalQueryCount
      };
    });

    for (let index = 1; index < observations.length; index += 1) {
      expect(observations[index]!.queries).toBeGreaterThan(observations[index - 1]!.queries);
    }
    console.info("[CCC0_AUDIT] obstacle-amplification", JSON.stringify(observations));
  });
});
