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
const PROJECTION_CLEARANCE = 0.002;

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
  constraintCount: number;
  minimumPredictedClearance: number;
  minimumCenterDistance: number;
  contactFrames: number;
  maximumPlayerMotionError: number;
  maximumCommandCorrection: number;
  startTargetDistance: number;
  endTargetDistance: number;
  endCompanion: Vec2;
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
  if (!value) throw new Error(`R1-5A projection matrix missing ${id}.`);
  return value;
}

function snapshotFor(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return { tick, scenarioId: spec.id, width: spec.width, height: spec.height, actors, obstacles: spec.obstacles };
}

function dynamicPlayerClearance(snapshot: WorldSnapshot, move: Vec2): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  const velocity = { x: move.x * SPEED, y: move.y * SPEED };
  const playerVelocity = magnitude(player.actualVelocity) > 0.08
    ? player.actualVelocity
    : player.requestedVelocity;
  const relativePosition = {
    x: player.position.x - companion.position.x,
    y: player.position.y - companion.position.y
  };
  const relativeVelocity = {
    x: playerVelocity.x - velocity.x,
    y: playerVelocity.y - velocity.y
  };
  const speedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = speedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / speedSquared, 0, S3_PREDICTION_HORIZON_SECONDS)
    : 0;
  const closest = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime
  };
  return magnitude(closest) - (companion.radius + player.radius + S3_PLAYER_BUFFER);
}

function currentOutsideBuffer(snapshot: WorldSnapshot): boolean {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  return distance(companion.position, player.position) > companion.radius + player.radius + S3_PLAYER_BUFFER;
}

function nearestSafeBlend(snapshot: WorldSnapshot, unsafe: Vec2, safe: Vec2): Vec2 {
  if (dynamicPlayerClearance(snapshot, unsafe) >= PROJECTION_CLEARANCE) return { ...unsafe };
  if (dynamicPlayerClearance(snapshot, safe) < PROJECTION_CLEARANCE) {
    throw new Error("R1-5A projection matrix requires a safe upstream endpoint.");
  }

  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const alpha = (low + high) / 2;
    const candidate = lerp(unsafe, safe, alpha);
    if (dynamicPlayerClearance(snapshot, candidate) >= PROJECTION_CLEARANCE) high = alpha;
    else low = alpha;
  }
  return lerp(unsafe, safe, high);
}

async function runCase(testCase: MatrixCase): Promise<MatrixEvidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5A rejected broad projection ${testCase.id}`,
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
  let constraintCount = 0;
  let minimumPredictedClearance = Number.POSITIVE_INFINITY;
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

      const preferredIntent = spatial.intent({
        snapshot,
        relationshipTarget: testCase.target,
        routePlan,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const decision = spatial.debugState();
      if (!decision) throw new Error("R1-5A projection matrix missing spatial decision.");
      const refined = refinePreferredVelocity(
        decision,
        (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      );

      const shaped = stepMotionContinuity({
        currentVelocity: companion.actualVelocity,
        preferredMove: refined.refinedMove,
        previousAcceleration,
        deltaSeconds: S0_STEP_SECONDS,
        config: { ...S4_DEFAULT_MOTION_CONTINUITY, maxSpeed: S3_EXPERIMENT_MAX_SPEED }
      });
      const staticConstrained = constrainFinalCommand({
        position: companion.position,
        radius: companion.radius,
        commandedMove: shaped.commandedMove,
        preferredMoves: [refined.refinedMove, preferredIntent.move],
        maxSpeed: SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      let finalMove = { ...staticConstrained.finalMove };
      let dynamicConstrained = false;
      if (currentOutsideBuffer(snapshot) && dynamicPlayerClearance(snapshot, finalMove) < 0) {
        const safe = [refined.refinedMove, preferredIntent.move, { x: 0, y: 0 }]
          .find((candidate) => dynamicPlayerClearance(snapshot, candidate) >= PROJECTION_CLEARANCE);
        if (!safe) throw new Error(`R1-5A projection matrix ${testCase.id}: no safe upstream fallback.`);
        const projected = nearestSafeBlend(snapshot, finalMove, safe);
        maximumCommandCorrection = Math.max(maximumCommandCorrection, distance(finalMove, projected));
        finalMove = projected;
        dynamicConstrained = true;
        constraintCount += 1;
      }

      minimumPredictedClearance = Math.min(minimumPredictedClearance, dynamicPlayerClearance(snapshot, finalMove));
      previousAcceleration = staticConstrained.constrained || dynamicConstrained
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
    }

    return {
      id: testCase.id,
      constraintCount,
      minimumPredictedClearance,
      minimumCenterDistance,
      contactFrames,
      maximumPlayerMotionError,
      maximumCommandCorrection,
      startTargetDistance,
      endTargetDistance: distance(actor(snapshot, "companion").position, testCase.target),
      endCompanion: { ...actor(snapshot, "companion").position }
    };
  } finally {
    physical.dispose();
  }
}

const CASES: MatrixCase[] = [
  { id: "turn-carry-1.05ms", playerStart: { x: 5, y: 4 }, companionStart: { x: 3.95, y: 4 }, playerWarmMove: { x: 0, y: 0 }, companionWarmMove: { x: 0.35, y: 0 }, target: { x: 4, y: 6 }, ticks: 36, playerMove: () => ({ x: 0, y: 0 }) },
  { id: "turn-carry-2.10ms", playerStart: { x: 5, y: 4 }, companionStart: { x: 3.95, y: 4 }, playerWarmMove: { x: 0, y: 0 }, companionWarmMove: { x: 0.7, y: 0 }, target: { x: 4, y: 6 }, ticks: 36, playerMove: () => ({ x: 0, y: 0 }) },
  { id: "turn-carry-3.00ms", playerStart: { x: 5, y: 4 }, companionStart: { x: 3.95, y: 4 }, playerWarmMove: { x: 0, y: 0 }, companionWarmMove: { x: 1, y: 0 }, target: { x: 4, y: 6 }, ticks: 36, playerMove: () => ({ x: 0, y: 0 }) },
  { id: "head-on-moving-player", playerStart: { x: 6, y: 4 }, companionStart: { x: 3.2, y: 4 }, playerWarmMove: { x: -0.45, y: 0 }, companionWarmMove: { x: 1, y: 0 }, target: { x: 8, y: 4 }, ticks: 72, playerMove: () => ({ x: -0.45, y: 0 }) },
  { id: "cross-front-moving-player", playerStart: { x: 4.8, y: 4.9 }, companionStart: { x: 3.5, y: 4 }, playerWarmMove: { x: 0, y: -0.5 }, companionWarmMove: { x: 0.7, y: 0 }, target: { x: 7, y: 4 }, ticks: 72, playerMove: () => ({ x: 0, y: -0.5 }) },
  { id: "player-reversal", playerStart: { x: 5.8, y: 4 }, companionStart: { x: 3.5, y: 4 }, playerWarmMove: { x: -0.45, y: 0 }, companionWarmMove: { x: 0.7, y: 0 }, target: { x: 7.5, y: 4 }, ticks: 72, playerMove: (step) => step < 20 ? { x: -0.45, y: 0 } : { x: 0.45, y: 0 } }
];

describe("R1-5A rejected broad comfort-projection characterization", () => {
  it("records why the S3 comfort envelope is not suitable as final hard authority", async () => {
    const evidence: MatrixEvidence[] = [];
    for (const testCase of CASES) evidence.push(await runCase(testCase));
    console.info(`R1-5A rejected broad projection matrix ${JSON.stringify(evidence)}`);

    // The broad projector can keep its own conservative comfort envelope and
    // avoid material player disturbance. That is not enough to qualify it as
    // a final authority layer.
    for (const row of evidence) {
      expect(row.minimumPredictedClearance, row.id).toBeGreaterThanOrEqual(-1e-8);
      expect(row.contactFrames, row.id).toBe(0);
      expect(row.minimumCenterDistance, row.id).toBeGreaterThan(RADIUS * 2);
      expect(row.maximumPlayerMotionError, row.id).toBeLessThan(0.02);
    }

    const headOn = evidence.find((row) => row.id === "head-on-moving-player");
    const crossFront = evidence.find((row) => row.id === "cross-front-moving-player");
    if (!headOn || !crossFront) throw new Error("R1-5A broad projection evidence missing required cases.");

    // Falsification result: enforcing comfort clearance at the final boundary
    // causes persistent emergency intervention in a clean moving-player pass.
    expect(headOn.constraintCount).toBeGreaterThan(10);

    // And in cross-front it can sacrifice objective progress even though player
    // authority remains clean. This negative result is why R1-5A split comfort
    // policy from the one-step physical hard gate.
    expect(crossFront.constraintCount).toBeGreaterThan(0);
    expect(crossFront.endTargetDistance).toBeGreaterThanOrEqual(crossFront.startTargetDistance);
  });
});
