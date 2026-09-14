import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld, S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { constrainFinalCommand } from "./final-command-constraint";
import { R1HardComfortSpatialBrain } from "./r1-hard-comfort-spatial";
import { refinePreferredVelocity } from "./preferred-velocity-refinement";
import { S3_EXPERIMENT_MAX_SPEED } from "./spatial-locomotion";
import { S4_DEFAULT_MOTION_CONTINUITY, stepMotionContinuity } from "./motion-continuity";

const RADIUS = 0.3;
const SPEED = 3;
const EPSILON = 1e-9;
const HARD_MARGIN = 0.002;
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

interface SweepEvidence {
  scenario: string;
  horizonSteps: number;
  constraintCount: number;
  minimumPredictedHardClearance: number;
  minimumCenterDistance: number;
  contactFrames: number;
  maximumPlayerMotionError: number;
  maximumCommandCorrection: number;
  startTargetDistance: number;
  minimumTargetDistance: number;
  endTargetDistance: number;
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
  if (!value) throw new Error(`R1-5 horizon sweep missing ${id}.`);
  return value;
}

function snapshotFor(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return { tick, scenarioId: spec.id, width: spec.width, height: spec.height, actors, obstacles: spec.obstacles };
}

function observedPlayerVelocity(player: ActorSnapshot): Vec2 {
  return magnitude(player.actualVelocity) > 0.08 ? player.actualVelocity : player.requestedVelocity;
}

function hardClearance(snapshot: WorldSnapshot, move: Vec2, horizonSteps: number): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  const companionVelocity = { x: move.x * SPEED, y: move.y * SPEED };
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
  const horizon = S0_STEP_SECONDS * horizonSteps;
  const closestTime = speedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / speedSquared, 0, horizon)
    : 0;
  const closest = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime
  };
  return magnitude(closest) - (companion.radius + player.radius);
}

function currentPhysicalClearance(snapshot: WorldSnapshot): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  return distance(companion.position, player.position) - (companion.radius + player.radius);
}

function requiredHardClearance(snapshot: WorldSnapshot): number {
  const current = currentPhysicalClearance(snapshot);
  if (current <= 0) return current - EGRESS_TOLERANCE;
  return Math.max(0, Math.min(HARD_MARGIN, current - EGRESS_TOLERANCE));
}

function nearestSafeBlend(
  snapshot: WorldSnapshot,
  unsafe: Vec2,
  safe: Vec2,
  horizonSteps: number,
  required: number
): Vec2 {
  if (hardClearance(snapshot, unsafe, horizonSteps) >= required) return { ...unsafe };
  if (hardClearance(snapshot, safe, horizonSteps) < required) {
    throw new Error("R1-5 horizon sweep requires hard-safe/egress upstream endpoint.");
  }
  let low = 0;
  let high = 1;
  for (let i = 0; i < 28; i += 1) {
    const alpha = (low + high) / 2;
    const candidate = lerp(unsafe, safe, alpha);
    if (hardClearance(snapshot, candidate, horizonSteps) >= required) high = alpha;
    else low = alpha;
  }
  return lerp(unsafe, safe, high);
}

async function runTrial(testCase: ScenarioCase, horizonSteps: number): Promise<SweepEvidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5 hard horizon ${testCase.id} ${horizonSteps}`,
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
  let minimumPredictedHardClearance = Number.POSITIVE_INFINITY;
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
      const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
        physical.staticCircleTraversal(from, to, radius, options);
      const routePlan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target: testCase.target,
        radius: companion.radius,
        query
      });
      expect(routePlan.status).toBe("direct");

      const preferredIntent = spatial.intent({
        snapshot,
        relationshipTarget: testCase.target,
        routePlan,
        query,
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const decision = spatial.debugState();
      if (!decision) throw new Error("R1-5 horizon sweep missing spatial decision.");
      const refined = refinePreferredVelocity(decision, query);
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
        query
      });

      let finalMove = { ...staticConstrained.finalMove };
      let dynamicConstrained = false;
      const required = requiredHardClearance(snapshot);
      if (hardClearance(snapshot, finalMove, horizonSteps) < required) {
        const safe = [refined.refinedMove, preferredIntent.move, { x: 0, y: 0 }]
          .find((candidate) => hardClearance(snapshot, candidate, horizonSteps) >= required);
        if (!safe) throw new Error(`R1-5 horizon ${testCase.id}/${horizonSteps}: no safe upstream endpoint.`);
        const repaired = nearestSafeBlend(snapshot, finalMove, safe, horizonSteps, required);
        maximumCommandCorrection = Math.max(maximumCommandCorrection, distance(finalMove, repaired));
        finalMove = repaired;
        dynamicConstrained = true;
        constraintCount += 1;
      }

      minimumPredictedHardClearance = Math.min(
        minimumPredictedHardClearance,
        hardClearance(snapshot, finalMove, horizonSteps)
      );
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
      if (afterCompanion.contacts.some((contact) => contact.with === "player")) contactFrames += 1;
      maximumPlayerMotionError = Math.max(maximumPlayerMotionError, afterPlayer.motionError);
      minimumTargetDistance = Math.min(minimumTargetDistance, distance(afterCompanion.position, testCase.target));
    }

    return {
      scenario: testCase.id,
      horizonSteps,
      constraintCount,
      minimumPredictedHardClearance,
      minimumCenterDistance,
      contactFrames,
      maximumPlayerMotionError,
      maximumCommandCorrection,
      startTargetDistance,
      minimumTargetDistance,
      endTargetDistance: distance(actor(snapshot, "companion").position, testCase.target)
    };
  } finally {
    physical.dispose();
  }
}

const SCENARIOS: ScenarioCase[] = [
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
  }
];

const HORIZONS = [1, 2, 3, 4, 6] as const;

describe("R1-5 physical-only hard horizon calibration", () => {
  it("characterizes the minimum hard horizon that agrees with World contacts", async () => {
    const rows: SweepEvidence[] = [];
    for (const scenario of SCENARIOS) {
      for (const horizonSteps of HORIZONS) {
        rows.push(await runTrial(scenario, horizonSteps));
      }
    }
    console.info(`R1-5 hard horizon sweep ${JSON.stringify(rows)}`);

    // Descriptive research probe. Existing canonical RED tests remain the
    // promotion boundary until a hard-dynamic contract is selected.
    for (const row of rows) {
      expect(Number.isFinite(row.minimumCenterDistance), `${row.scenario}/${row.horizonSteps}`).toBe(true);
      expect(Number.isFinite(row.endTargetDistance), `${row.scenario}/${row.horizonSteps}`).toBe(true);
    }
  });
});
