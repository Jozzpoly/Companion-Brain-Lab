import { describe, expect, it } from "vitest";
import type { MovementCapability } from "../world/movement-capability";
import type {
  ActorSnapshot,
  MotionIntent,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { A1RelationshipObserver } from "./a1-relationship-observer";
import { buildA1Situation } from "./a1-situation";
import { evaluateShadowCoordinationFrame } from "./shadow-coordination-frame";

const PLAYER_CAPABILITY: MovementCapability = {
  actorId: "player",
  maxSpeed: 3,
  radius: 0.3,
  source: "actor-spec"
};

const COMPANION_CAPABILITY: MovementCapability = {
  actorId: "companion",
  maxSpeed: 3,
  radius: 0.3,
  source: "actor-spec"
};

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: distance(from, to),
    clear: true,
    blocker: null
  };
}

function motion(move: Vec2): MotionIntent {
  return { actorId: "player", move: { ...move } };
}

function snapshot(input: {
  tick: number;
  requested: Vec2;
  actual: Vec2;
  contacted?: boolean;
}): WorldSnapshot {
  const player: ActorSnapshot = {
    id: "player",
    position: { x: 4, y: 4 },
    radius: 0.3,
    requestedVelocity: { ...input.requested },
    actualVelocity: { ...input.actual },
    motionError: Math.hypot(input.actual.x - input.requested.x, input.actual.y - input.requested.y),
    contacts: input.contacted ? [{ with: "companion", contactCount: 1 }] : []
  };
  const companion: ActorSnapshot = {
    id: "companion",
    position: { x: 1, y: 4 },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: input.contacted ? [{ with: "player", contactCount: 1 }] : []
  };
  return {
    tick: input.tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [player, companion],
    obstacles: []
  };
}

function situation(world: WorldSnapshot, ownerMove: Vec2) {
  return buildA1Situation({
    snapshot: world,
    playerIntent: motion(ownerMove),
    playerCapability: PLAYER_CAPABILITY,
    companionCapability: COMPANION_CAPABILITY,
    previousWorldStep: null
  });
}

describe("A1/CCC temporal model divergence audit", () => {
  it("keeps opposing remembered player directions after a solver-like external reversal and release", () => {
    const a1 = new A1RelationshipObserver();

    const ownerDirected = snapshot({
      tick: 0,
      requested: { x: 3, y: 0 },
      actual: { x: 3, y: 0 }
    });
    const a1AtOwner = a1.observe({
      situation: situation(ownerDirected, { x: 1, y: 0 }),
      snapshot: ownerDirected,
      query: clearTraversal
    });
    const cccAtOwner = evaluateShadowCoordinationFrame({
      snapshot: ownerDirected,
      query: clearTraversal,
      physicalSpeedCapability: 3
    });

    expect(a1AtOwner.orientation?.source).toBe("SAME_STEP_OWNER");
    expect(a1AtOwner.orientation?.direction).toEqual({ x: 1, y: 0 });
    expect(cccAtOwner.region.playerHeadingSource).toBe("actual");
    expect(cccAtOwner.region.playerDirection).toEqual({ x: 1, y: 0 });

    const externallyReversed = snapshot({
      tick: 6,
      requested: { x: 0, y: 0 },
      actual: { x: -3, y: 0 },
      contacted: true
    });
    const externalSituation = situation(externallyReversed, { x: 0, y: 0 });
    expect(externalSituation.situated.playerMotionProvenance.state).toBe("EXTERNAL_MOTION_EVIDENT");

    const a1AtExternal = a1.observe({
      situation: externalSituation,
      snapshot: externallyReversed,
      query: clearTraversal
    });
    const cccAtExternal = evaluateShadowCoordinationFrame({
      snapshot: externallyReversed,
      query: clearTraversal,
      physicalSpeedCapability: 3,
      history: cccAtOwner.nextHistory
    });

    expect(a1AtExternal.orientation?.source).toBe("OWNER_MEMORY");
    expect(a1AtExternal.orientation?.ageTicks).toBe(6);
    expect(a1AtExternal.orientation?.direction).toEqual({ x: 1, y: 0 });
    expect(cccAtExternal.region.playerHeadingSource).toBe("actual");
    expect(cccAtExternal.region.playerDirection).toEqual({ x: -1, y: 0 });

    const released = snapshot({
      tick: 12,
      requested: { x: 0, y: 0 },
      actual: { x: 0, y: 0 }
    });
    const a1AtRelease = a1.observe({
      situation: situation(released, { x: 0, y: 0 }),
      snapshot: released,
      query: clearTraversal
    });
    const cccAtRelease = evaluateShadowCoordinationFrame({
      snapshot: released,
      query: clearTraversal,
      physicalSpeedCapability: 3,
      history: cccAtExternal.nextHistory
    });

    expect(a1AtRelease.orientation?.source).toBe("OWNER_MEMORY");
    expect(a1AtRelease.orientation?.ageTicks).toBe(12);
    expect(a1AtRelease.orientation?.direction).toEqual({ x: 1, y: 0 });
    expect(cccAtRelease.region.playerHeadingSource).toBe("previous");
    expect(cccAtRelease.region.playerDirection).toEqual({ x: -1, y: 0 });
    expect(cccAtRelease.region.playerHeadingStrength).toBeGreaterThan(0);

    const a1Direction = a1AtRelease.orientation?.direction;
    expect(a1Direction).not.toBeNull();
    if (!a1Direction) return;
    expect(dot(a1Direction, cccAtRelease.region.playerDirection)).toBeLessThan(-0.99);
  });
});
