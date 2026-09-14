import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld, S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { constrainFinalCommand } from "./final-command-constraint";
import { R1HardComfortSpatialBrain } from "./r1-hard-comfort-spatial";
import { refinePreferredVelocity } from "./preferred-velocity-refinement";
import {
  S3_EXPERIMENT_MAX_SPEED,
  S3_PLAYER_BUFFER,
  S3_PREDICTION_HORIZON_SECONDS
} from "./spatial-locomotion";
import { S4_DEFAULT_MOTION_CONTINUITY, stepMotionContinuity } from "./motion-continuity";

const RADIUS = 0.3;
const SPEED = 3;
const EPSILON = 1e-9;
const HARD_DYNAMIC_MARGIN = 0.002;
const EGRESS_TOLERANCE = 1e-6;

interface ScenarioCase {
  id: string;
  playerStart: Vec2;
  companionStart: Vec2;
  playerWarmMove: Vec2;
  companionWarmMove: Vec2;
  target: Vec2;
  ticks: number;
  playerMove: (step: number) => Vec2;
}

interface Evidence {
  id: string;
  hardConstraintCount: number;
  minimumHardStepClearance: number;
  minimumComfortHorizonClearance: number;
  minimumCenterDistance: number;
  contactFrames: number;
  maximumPlayerMotionError: number;
  maximumCommandCorrection: number;
  startTargetDistance: number;
  minimumTargetDistance: number;
  endTargetDistance: number;
  companionEnd: Vec2;
}

function magnitude(v: Vec2): number { return Math.hypot(v.x, v.y); }
function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }
function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function lerp(a: Vec2, b: Vec2, alpha: number): Vec2 {
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1-5 hard-step probe missing ${id}.`);
  return value;
}

function snapshotFor(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return { tick, scenarioId: spec.id, width: spec.width, height: spec.height, actors, obstacles: spec.obstacles };
}

function observedPlayerVelocity(player: ActorSnapshot): Vec2 {
  return magnitude(player.actualVelocity) > 0.08 ? player.actualVelocity : player.requestedVelocity;
}

function predictedClearance(options: {
  snapshot: WorldSnapshot;
  move: Vec2;
  horizon: number;
  extraBuffer: number;
}): number {
  const companion = actor(options.snapshot, "companion");
  const player = actor(options.snapshot, "player");
  const companionVelocity = { x: options.move.x * SPEED, y: options.move.y * SPEED };
  const playerVelocity = observedPlayerVelocity(player);
  const relativePosition = {
    x: player.position.x - companion.position.x,
    y: player.position.y - companion.position.y
  };
  const relativeVelocity = {
    x: playerVelocity.x - companionVelocity.x,
    y: playerVelocity.y - companionVelocity.y
  };
  const speedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = speedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / speedSquared, 0, options.horizon)
    : 0;
  const closest = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime
  };
  return magnitude(closest) - (companion.radius + player.radius + options.extraBuffer);
}

function hardStepClearance(snapshot: WorldSnapshot, move: Vec2): number {
  return predictedClearance({
    snapshot,
    move,
    horizon: S0_STEP_SECONDS,
    extraBuffer: 0
  });
}

function comfortHorizonClearance(snapshot: WorldSnapshot, move: Vec2): number {
  return predictedClearance({
    snapshot,
    move,
    horizon: S3_PREDICTION_HORIZON_SECONDS,
    extraBuffer: S3_PLAYER_BUFFER
  });
}

function currentPhysicalClearance(snapshot: WorldSnapshot): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  return distance(companion.position, player.position) - (companion.radius + player.radius);
}

/**
 * Hard-dynamic equivalent of static initial-overlap/egress semantics.
 *
 * Far from contact we keep a tiny numerical hard margin. If World is already
 * closer than that margin, the current state itself cannot satisfy the normal
 * target because swept minimum distance includes t=0. In that boundary state
 * the command may not make physical separation materially worse; an egress
 * direction is therefore admissible instead of disabling the gate entirely.
 */
function requiredHardClearance(snapshot: WorldSnapshot): number {
  const current = currentPhysicalClearance(snapshot);
  if (current <= 0) return current - EGRESS_TOLERANCE;
  return Math.max(0, Math.min(HARD_DYNAMIC_MARGIN, current - EGRESS_TOLERANCE));
}

function nearestHardSafeBlend(
  snapshot: WorldSnapshot,
  unsafe: Vec2,
  safe: Vec2,
  required: number
): Vec2 {
  if (hardStepClearance(snapshot, unsafe) >= required) return { ...unsafe };
  if (hardStepClearance(snapshot, safe) < required) {
    throw new Error("R1-5 hard-step probe requires an egress/hard-safe upstream endpoint.");
  }
  let low = 0;
  let high = 1;
  for (let i = 0; i < 28; i += 1) {
    const alpha = (low + high) / 2;
    const candidate = lerp(unsafe, safe, alpha);
    if (hardStepClearance(snapshot, candidate) >= required) high = alpha;
    else low = alpha;
  }
  return lerp(unsafe, safe, high);
}

async function runCase(testCase: ScenarioCase): Promise<Evidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5 hard-step ${testCase.id}`,
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: testCase.playerStart, radius: RADIUS, speed: SPEED },
      { id: "companion", position: testCase.companionStart, radius: RADIUS, speed: SPEED }
    ],
    obstacles: []
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const spatial = new R1HardComfortSpatialBrain();
  let previousAcceleration: Vec2 = { x: 0, y: 0 };
  let tick = 0;
  let hardConstraintCount = 0;
  let minimumHardStepClearance = Number.POSITIVE_INFINITY;
  let minimumComfortHorizonClearance = Number.POSITIVE_INFINITY;
  let minimumCenterDistance = Number.POSITIVE_INFINITY;
  let contactFrames = 0;
  let maximumPlayerMotionError = 0;
  let maximumCommandCorrection = 0;

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
      expect(routePlan.status).toBe("direct");
      const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
        physical.staticCircleTraversal(from, to, radius, options);

      const preferredIntent = spatial.intent({
        snapshot,
        relationshipTarget: testCase.target,
        routePlan,
        query,
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const decision = spatial.debugState();
      if (!decision) throw new Error("R1-5 hard-step probe missing spatial decision.");
      const refined = refinePreferredVelocity(decision, query);
      const shaped = stepMotionContinuity({
        currentVelocity: companion.actualVelocity,
        preferredMove: refined.refinedMove,
        previousAcceleration,
        deltaSeconds: S0_STEP_SECONDS,
        config: { ...S4_DEFAULT_MOTION_CONTINUITY, maxSpeed: SPEED }
      });
      const staticConstrained = constrainFinalCommand({
        position: companion.position,
        radius: companion.radius,
        commandedMove: shaped.commandedMove,
        preferredMoves: [refined.refinedMove, preferredIntent.move],
        maxSpeed: SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query
      });

      let finalMove = { ...staticConstrained.finalMove };
      let hardDynamicConstrained = false;
      const required = requiredHardClearance(snapshot);
      if (hardStepClearance(snapshot, finalMove) < required) {
        const safe = [refined.refinedMove, preferredIntent.move, { x: 0, y: 0 }]
          .find((candidate) => hardStepClearance(snapshot, candidate) >= required);
        if (!safe) throw new Error(`R1-5 hard-step ${testCase.id}: no hard-safe/egress upstream endpoint.`);
        const projected = nearestHardSafeBlend(snapshot, finalMove, safe, required);
        maximumCommandCorrection = Math.max(maximumCommandCorrection, distance(finalMove, projected));
        finalMove = projected;
        hardConstraintCount += 1;
        hardDynamicConstrained = true;
      }

      minimumHardStepClearance = Math.min(minimumHardStepClearance, hardStepClearance(snapshot, finalMove));
      minimumComfortHorizonClearance = Math.min(
        minimumComfortHorizonClearance,
        comfortHorizonClearance(snapshot, finalMove)
      );
      previousAcceleration = staticConstrained.constrained || hardDynamicConstrained
        ? { x: 0, y: 0 }
        : { ...shaped.acceleration };

      actors = physical.step([
        { actorId: "player", move: testCase.playerMove(step) },
        { actorId: "companion", move: finalMove }
      ]);
      tick += 1;
      snapshot = snapshotFor(spec, tick, actors);
      const afterPlayer = actor(snapshot, "player");
      const afterCompanion = actor(snapshot, "companion");
      minimumCenterDistance = Math.min(minimumCenterDistance, distance(afterPlayer.position, afterCompanion.position));
      maximumPlayerMotionError = Math.max(maximumPlayerMotionError, afterPlayer.motionError);
      if (afterCompanion.contacts.some((contact) => contact.with === "player")) contactFrames += 1;
      minimumTargetDistance = Math.min(minimumTargetDistance, distance(afterCompanion.position, testCase.target));
    }

    return {
      id: testCase.id,
      hardConstraintCount,
      minimumHardStepClearance,
      minimumComfortHorizonClearance,
      minimumCenterDistance,
      contactFrames,
      maximumPlayerMotionError,
      maximumCommandCorrection,
      startTargetDistance,
      minimumTargetDistance,
      endTargetDistance: distance(actor(snapshot, "companion").position, testCase.target),
      companionEnd: { ...actor(snapshot, "companion").position }
    };
  } finally {
    physical.dispose();
  }
}

const CASES: ScenarioCase[] = [
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

describe("R1-5A hard-dynamic vs comfort-dynamic final authority probe", () => {
  it("uses one-step physical safety with boundary-state egress semantics", async () => {
    const rows: Evidence[] = [];
    for (const testCase of CASES) rows.push(await runCase(testCase));
    console.info(`R1-5A hard-step evidence ${JSON.stringify(rows)}`);

    for (const row of rows) {
      expect(row.minimumHardStepClearance, row.id).toBeGreaterThanOrEqual(-1e-5);
      expect(row.contactFrames, row.id).toBe(0);
      expect(row.minimumCenterDistance, row.id).toBeGreaterThan(RADIUS * 2);
      expect(row.maximumPlayerMotionError, row.id).toBeLessThan(0.02);
      expect(row.minimumTargetDistance, row.id).toBeLessThan(row.startTargetDistance);
    }
  });
});
