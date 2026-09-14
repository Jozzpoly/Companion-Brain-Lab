import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import type { FinalPlayerCommandConstraintSource } from "./final-player-command-constraint";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";

const RADIUS = 0.3;
const SPEED = 3;
const PLAYER_MOTION_ERROR_LIMIT = 0.02;
const PENETRATION_TOLERANCE = 1e-5;

interface MatrixCase {
  id: string;
  playerStart: Vec2;
  companionStart: Vec2;
  playerWarmMove: Vec2;
  companionWarmMove: Vec2;
  target: Vec2;
  ticks: number;
  playerMove: (step: number) => Vec2;
}

interface MatrixEvidence {
  id: string;
  playerConstraintCount: number;
  playerConstraintSources: Partial<Record<FinalPlayerCommandConstraintSource, number>>;
  maximumCommandCorrection: number;
  minimumCenterDistance: number;
  minimumPhysicalClearance: number;
  contactFrames: number;
  maximumPlayerMotionError: number;
  startTargetDistance: number;
  minimumTargetDistance: number;
  endTargetDistance: number;
  companionEnd: Vec2;
  playerEnd: Vec2;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1-5A integrated matrix missing ${id}.`);
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

async function runCase(testCase: MatrixCase): Promise<MatrixEvidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5A integrated ${testCase.id}`,
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: testCase.playerStart, radius: RADIUS, speed: SPEED },
      { id: "companion", position: testCase.companionStart, radius: RADIUS, speed: SPEED }
    ],
    obstacles: []
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const brain = new R1NaturalSpatialLocomotionBrain();
  let tick = 0;
  let playerConstraintCount = 0;
  const playerConstraintSources: Partial<Record<FinalPlayerCommandConstraintSource, number>> = {};
  let maximumCommandCorrection = 0;
  let minimumCenterDistance = Number.POSITIVE_INFINITY;
  let minimumPhysicalClearance = Number.POSITIVE_INFINITY;
  let contactFrames = 0;
  let maximumPlayerMotionError = 0;

  try {
    let actors = physical.step([
      { actorId: "player", move: testCase.playerWarmMove },
      { actorId: "companion", move: testCase.companionWarmMove }
    ]);
    tick += 1;
    let snapshot = snapshotFor(spec, tick, actors);
    const startTargetDistance = distance(actor(snapshot, "companion").position, testCase.target);
    let minimumTargetDistance = startTargetDistance;

    for (let step = 0; step < testCase.ticks; step += 1) {
      const companion = actor(snapshot, "companion");
      const routePlan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target: testCase.target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });
      expect(routePlan.status, testCase.id).toBe("direct");

      const companionIntent = brain.intent({
        snapshot,
        relationshipTarget: testCase.target,
        routePlan,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const debug = brain.debugState();
      const playerConstraint = debug.finalPlayerConstraint;
      if (!playerConstraint) throw new Error(`R1-5A integrated ${testCase.id}: missing final player constraint evidence.`);

      playerConstraintSources[playerConstraint.source] = (playerConstraintSources[playerConstraint.source] ?? 0) + 1;
      if (playerConstraint.constrained) {
        playerConstraintCount += 1;
        maximumCommandCorrection = Math.max(
          maximumCommandCorrection,
          distance(playerConstraint.originalMove, playerConstraint.finalMove)
        );
      }

      actors = physical.step([
        { actorId: "player", move: testCase.playerMove(step) },
        companionIntent
      ]);
      tick += 1;
      snapshot = snapshotFor(spec, tick, actors);

      const afterPlayer = actor(snapshot, "player");
      const afterCompanion = actor(snapshot, "companion");
      const centerDistance = distance(afterPlayer.position, afterCompanion.position);
      minimumCenterDistance = Math.min(minimumCenterDistance, centerDistance);
      minimumPhysicalClearance = Math.min(
        minimumPhysicalClearance,
        centerDistance - afterPlayer.radius - afterCompanion.radius
      );
      maximumPlayerMotionError = Math.max(maximumPlayerMotionError, afterPlayer.motionError);
      if (afterCompanion.contacts.some((contact) => contact.with === "player")) contactFrames += 1;
      minimumTargetDistance = Math.min(minimumTargetDistance, distance(afterCompanion.position, testCase.target));
    }

    const endCompanion = actor(snapshot, "companion");
    const endPlayer = actor(snapshot, "player");
    return {
      id: testCase.id,
      playerConstraintCount,
      playerConstraintSources,
      maximumCommandCorrection,
      minimumCenterDistance,
      minimumPhysicalClearance,
      contactFrames,
      maximumPlayerMotionError,
      startTargetDistance,
      minimumTargetDistance,
      endTargetDistance: distance(endCompanion.position, testCase.target),
      companionEnd: { ...endCompanion.position },
      playerEnd: { ...endPlayer.position }
    };
  } finally {
    physical.dispose();
  }
}

const CASES: MatrixCase[] = [
  {
    id: "stationary-player-abrupt-turn",
    playerStart: { x: 5, y: 4 },
    companionStart: { x: 3.95, y: 4 },
    playerWarmMove: { x: 0, y: 0 },
    companionWarmMove: { x: 1, y: 0 },
    target: { x: 4, y: 6 },
    ticks: 36,
    playerMove: () => ({ x: 0, y: 0 })
  },
  {
    id: "head-on-moving-player",
    playerStart: { x: 6, y: 4 },
    companionStart: { x: 3.2, y: 4 },
    playerWarmMove: { x: -0.45, y: 0 },
    companionWarmMove: { x: 1, y: 0 },
    target: { x: 8, y: 4 },
    ticks: 72,
    playerMove: () => ({ x: -0.45, y: 0 })
  },
  {
    id: "cross-front-moving-player",
    playerStart: { x: 4.8, y: 4.9 },
    companionStart: { x: 3.5, y: 4 },
    playerWarmMove: { x: 0, y: -0.5 },
    companionWarmMove: { x: 0.7, y: 0 },
    target: { x: 7, y: 4 },
    ticks: 72,
    playerMove: () => ({ x: 0, y: -0.5 })
  },
  {
    id: "player-reversal",
    playerStart: { x: 5.8, y: 4 },
    companionStart: { x: 3.5, y: 4 },
    playerWarmMove: { x: -0.45, y: 0 },
    companionWarmMove: { x: 0.7, y: 0 },
    target: { x: 7.5, y: 4 },
    ticks: 72,
    playerMove: (step) => step < 20 ? { x: -0.45, y: 0 } : { x: 0.45, y: 0 }
  }
];

describe("R1-5A integrated final player-authority World matrix", () => {
  it("removes material player disturbance without turning normal moving-player encounters into emergency correction loops", async () => {
    const evidence: MatrixEvidence[] = [];
    for (const testCase of CASES) evidence.push(await runCase(testCase));
    console.info(`R1-5A integrated player-authority matrix ${JSON.stringify(evidence)}`);

    for (const row of evidence) {
      expect(row.minimumPhysicalClearance, row.id).toBeGreaterThanOrEqual(-PENETRATION_TOLERANCE);
      expect(row.maximumPlayerMotionError, row.id).toBeLessThan(PLAYER_MOTION_ERROR_LIMIT);
      expect(row.minimumTargetDistance, row.id).toBeLessThan(row.startTargetDistance);
      expect(row.endTargetDistance, row.id).toBeLessThan(row.startTargetDistance);
    }

    const abrupt = evidence.find((row) => row.id === "stationary-player-abrupt-turn");
    const headOn = evidence.find((row) => row.id === "head-on-moving-player");
    const crossFront = evidence.find((row) => row.id === "cross-front-moving-player");
    const reversal = evidence.find((row) => row.id === "player-reversal");
    if (!abrupt || !headOn || !crossFront || !reversal) {
      throw new Error("R1-5A integrated matrix missing required cases.");
    }

    // The original material RED must require real final-authority intervention,
    // but it should remain bounded rather than becoming a persistent correction loop.
    expect(abrupt.playerConstraintCount).toBeGreaterThan(0);
    expect(abrupt.playerConstraintCount).toBeLessThanOrEqual(4);

    // Clean moving-player encounters should remain governed by upstream
    // comfort/right-of-way policy and NATURAL continuity, not by emergency hard authority.
    expect(headOn.playerConstraintCount).toBe(0);
    expect(crossFront.playerConstraintCount).toBe(0);
    expect(reversal.playerConstraintCount).toBe(0);
  });
});
