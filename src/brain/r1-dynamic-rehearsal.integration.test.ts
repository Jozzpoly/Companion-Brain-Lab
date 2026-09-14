import { describe, expect, it } from "vitest";
import { planStaticShadowRoute, type StaticRoutePlan } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type {
  ActorSnapshot,
  MotionIntent,
  ScenarioSpec,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { LabWorld } from "../world/world";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";
import type { ProgressRecoveryDecision } from "./progress-recovery";

const RADIUS = 0.3;
const SPEED = 3;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1 dynamic fixture missing ${id}.`);
  return value;
}

function physicalSnapshot(
  spec: ScenarioSpec,
  tick: number,
  actors: readonly ActorSnapshot[]
): WorldSnapshot {
  return {
    tick,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

function planWithQuery(
  snapshot: WorldSnapshot,
  target: Vec2,
  query: (from: Vec2, to: Vec2, radius: number) => ReturnType<RapierPhysicalWorld["staticCircleTraversal"]>
): StaticRoutePlan {
  const companion = actor(snapshot, "companion");
  return planStaticShadowRoute({
    snapshot,
    start: companion.position,
    target,
    radius: companion.radius,
    query
  });
}

function hasPersistentFailure(decisions: readonly ProgressRecoveryDecision[]): boolean {
  return decisions.some((decision) =>
    decision.state === "PERSISTENT_UNREACHABLE" ||
    decision.action === "REPORT_UNREACHABLE"
  );
}

describe("R1-4 full movement-stack dynamic rehearsal", () => {
  it("tracks a continuously moving relationship target without resetting the semantic episode", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "R1 moving relationship target rehearsal",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 2, y: 2 }, radius: RADIUS, speed: SPEED },
        { id: "companion", position: { x: 8, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: []
    };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1RecoveringNaturalSpatialBrain();
    let tick = 0;
    let snapshot = physicalSnapshot(spec, tick, physical.snapshot());
    const decisions: ProgressRecoveryDecision[] = [];
    let sawTrackingOrProgress = false;
    let maximumDistanceAfterCatch = 0;
    let caught = false;

    try {
      for (let step = 0; step < 240; step += 1) {
        const player = actor(snapshot, "player");
        const target = { x: player.position.x + 3, y: player.position.y + 2 };
        const beforeRoute = planWithQuery(
          snapshot,
          target,
          (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        );
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: beforeRoute,
          query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });

        const actors = physical.step([
          { actorId: "player", move: { x: 0.25, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = physicalSnapshot(spec, tick, actors);
        const afterPlayer = actor(snapshot, "player");
        const afterTarget = { x: afterPlayer.position.x + 3, y: afterPlayer.position.y + 2 };
        const afterRoute = planWithQuery(
          snapshot,
          afterTarget,
          (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        );
        const decision = brain.observeOutcome({
          snapshot,
          objectiveKey: "moving-follow-slot:rev-1",
          target: afterTarget,
          routePlan: afterRoute
        });
        decisions.push(decision);
        if (decision.state === "PROGRESSING" || decision.state === "TRACKING_MOVING_OBJECTIVE") {
          sawTrackingOrProgress = true;
        }

        const error = distance(actor(snapshot, "companion").position, afterTarget);
        if (error < 0.45) caught = true;
        if (caught) maximumDistanceAfterCatch = Math.max(maximumDistanceAfterCatch, error);
      }

      expect(caught).toBe(true);
      expect(sawTrackingOrProgress).toBe(true);
      expect(hasPersistentFailure(decisions)).toBe(false);
      expect(brain.debugState().appliedLocalRetries).toBeLessThanOrEqual(1);
      expect(maximumDistanceAfterCatch).toBeLessThan(0.85);
    } finally {
      physical.dispose();
    }
  });

  it("recovers after a player crosses the companion path from the side and then clears", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "R1 cross-front interruption rehearsal",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 6, y: 5 }, radius: RADIUS, speed: SPEED },
        { id: "companion", position: { x: 8, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: []
    };
    const target = { x: 4, y: 4 };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1RecoveringNaturalSpatialBrain();
    let tick = 0;
    let snapshot = physicalSnapshot(spec, tick, physical.snapshot());
    const decisions: ProgressRecoveryDecision[] = [];
    let minimumPlayerDistance = Number.POSITIVE_INFINITY;
    let reached = false;

    try {
      for (let step = 0; step < 420; step += 1) {
        const beforeRoute = planWithQuery(
          snapshot,
          target,
          (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        );
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: beforeRoute,
          query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
        const playerMove: Vec2 = step < 90 ? { x: 0, y: -0.5 } : { x: 0, y: 0 };
        const actors = physical.step([
          { actorId: "player", move: playerMove },
          intent
        ]);
        tick += 1;
        snapshot = physicalSnapshot(spec, tick, actors);
        minimumPlayerDistance = Math.min(
          minimumPlayerDistance,
          distance(actor(snapshot, "player").position, actor(snapshot, "companion").position)
        );

        const afterRoute = planWithQuery(
          snapshot,
          target,
          (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        );
        decisions.push(brain.observeOutcome({
          snapshot,
          objectiveKey: "cross-front-target:rev-1",
          target,
          routePlan: afterRoute
        }));

        if (distance(actor(snapshot, "companion").position, target) <= 0.22) {
          reached = true;
          break;
        }
      }

      expect(minimumPlayerDistance).toBeLessThan(1.5);
      expect(reached).toBe(true);
      expect(hasPersistentFailure(decisions)).toBe(false);
      expect(brain.debugState().appliedLocalRetries).toBeLessThanOrEqual(2);
    } finally {
      physical.dispose();
    }
  });

  it("survives repeated doorway reversals and resumes once player contention clears", async () => {
    const world = await LabWorld.create("doorway");
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 4.9, y: 4 };
    let snapshot = world.snapshot();
    const decisions: ProgressRecoveryDecision[] = [];
    let reached = false;
    let minimumPlayerDistance = Number.POSITIVE_INFINITY;

    try {
      for (let step = 0; step < 900; step += 1) {
        const companion = actor(snapshot, "companion");
        const beforeRoute = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
        });
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: beforeRoute,
          query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
          occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
        });

        let playerMove: Vec2 = { x: 0, y: 0 };
        if (step < 240) {
          const phase = Math.floor(step / 60) % 2;
          playerMove = phase === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        }

        snapshot = world.step([
          { actorId: "player", move: playerMove },
          intent
        ]);
        minimumPlayerDistance = Math.min(
          minimumPlayerDistance,
          distance(actor(snapshot, "player").position, actor(snapshot, "companion").position)
        );

        const afterCompanion = actor(snapshot, "companion");
        const afterRoute = planStaticShadowRoute({
          snapshot,
          start: afterCompanion.position,
          target,
          radius: afterCompanion.radius,
          query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
        });
        decisions.push(brain.observeOutcome({
          snapshot,
          objectiveKey: "doorway-target:rev-1",
          target,
          routePlan: afterRoute
        }));

        if (step >= 240 && distance(afterCompanion.position, target) <= 0.25) {
          reached = true;
          break;
        }
      }

      // Avoidance is allowed to solve the contention without physical contact;
      // the rehearsal only needs to prove that the two actors actually entered
      // a close shared choke before the release phase.
      expect(minimumPlayerDistance).toBeLessThan(1.5);
      expect(reached).toBe(true);
      expect(hasPersistentFailure(decisions)).toBe(false);
      expect(brain.debugState().appliedLocalRetries).toBeLessThanOrEqual(2);
    } finally {
      world.dispose();
    }
  });

  it("reports a truly separated target as persistent hard-unreachable without retry thrash", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "R1 hard unreachable rehearsal",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 2, y: 2 }, radius: RADIUS, speed: SPEED },
        { id: "companion", position: { x: 8, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: [
        { id: "r1.full-wall", x: 5.8, y: 0, width: 0.4, height: 8 }
      ]
    };
    const target = { x: 4, y: 4 };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1RecoveringNaturalSpatialBrain();
    let tick = 0;
    let snapshot = physicalSnapshot(spec, tick, physical.snapshot());
    let reportCount = 0;
    let persistentSeen = false;
    let crossedWall = false;

    try {
      for (let step = 0; step < 100; step += 1) {
        const beforeRoute = planWithQuery(
          snapshot,
          target,
          (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        );
        expect(beforeRoute.status).toBe("unreachable");

        const intent: MotionIntent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: beforeRoute,
          query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
        const actors = physical.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = physicalSnapshot(spec, tick, actors);
        if (actor(snapshot, "companion").position.x < 6.1) crossedWall = true;

        const afterRoute = planWithQuery(
          snapshot,
          target,
          (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        );
        const decision = brain.observeOutcome({
          snapshot,
          objectiveKey: "hard-separated-target:rev-1",
          target,
          routePlan: afterRoute
        });
        if (decision.state === "PERSISTENT_UNREACHABLE") persistentSeen = true;
        if (decision.action === "REPORT_UNREACHABLE") reportCount += 1;
      }

      expect(persistentSeen).toBe(true);
      expect(reportCount).toBe(1);
      expect(brain.debugState().appliedLocalRetries).toBe(0);
      expect(crossedWall).toBe(false);
    } finally {
      physical.dispose();
    }
  });
});
