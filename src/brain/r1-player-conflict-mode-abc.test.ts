import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld, S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { constrainFinalCommand } from "./final-command-constraint";
import { R1HardComfortSpatialBrain } from "./r1-hard-comfort-spatial";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";
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

type Mode = "DIRECT" | "NATURAL" | "PROJECTED";

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

interface TrialEvidence {
  scenario: string;
  mode: Mode;
  constraintCount: number;
  minimumPredictedClearance: number;
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
  if (!value) throw new Error(`R1-5 ABC fixture missing ${id}.`);
  return value;
}

function snapshotFor(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return { tick, scenarioId: spec.id, width: spec.width, height: spec.height, actors, obstacles: spec.obstacles };
}

function dynamicPlayerClearance(snapshot: WorldSnapshot, move: Vec2): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  const velocity = { x: move.x * SPEED, y: move.y * SPEED };
  const playerVelocity = magnitude(player.actualVelocity) > 0.08 ? player.actualVelocity : player.requestedVelocity;
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
    throw new Error("R1-5 ABC projection requires safe upstream endpoint.");
  }
  let low = 0;
  let high = 1;
  for (let i = 0; i < 28; i += 1) {
    const alpha = (low + high) / 2;
    const candidate = lerp(unsafe, safe, alpha);
    if (dynamicPlayerClearance(snapshot, candidate) >= PROJECTION_CLEARANCE) high = alpha;
    else low = alpha;
  }
  return lerp(unsafe, safe, high);
}

async function runTrial(testCase: ScenarioCase, mode: Mode): Promise<TrialEvidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5 ABC ${testCase.id} ${mode}`,
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: testCase.playerStart, radius: RADIUS, speed: SPEED },
      { id: "companion", position: testCase.companionStart, radius: RADIUS, speed: SPEED }
    ],
    obstacles: []
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const directBrain = new R1HardComfortSpatialBrain();
  const naturalBrain = new R1NaturalSpatialLocomotionBrain();
  const projectedSpatial = new R1HardComfortSpatialBrain();
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

      const commonInput = {
        snapshot,
        relationshipTarget: testCase.target,
        routePlan,
        query: (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
          physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center: Vec2, radius: number) => physical.staticCircleOccupancy(center, radius)
      };

      let companionMove: Vec2;
      if (mode === "DIRECT") {
        companionMove = directBrain.intent(commonInput).move;
      } else if (mode === "NATURAL") {
        companionMove = naturalBrain.intent(commonInput).move;
      } else {
        const preferredIntent = projectedSpatial.intent(commonInput);
        const decision = projectedSpatial.debugState();
        if (!decision) throw new Error("R1-5 ABC missing projected spatial decision.");
        const refined = refinePreferredVelocity(decision, commonInput.query);
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
          query: commonInput.query
        });
        companionMove = { ...staticConstrained.finalMove };
        let dynamicConstrained = false;
        if (currentOutsideBuffer(snapshot) && dynamicPlayerClearance(snapshot, companionMove) < 0) {
          const safe = [refined.refinedMove, preferredIntent.move, { x: 0, y: 0 }]
            .find((candidate) => dynamicPlayerClearance(snapshot, candidate) >= PROJECTION_CLEARANCE);
          if (!safe) throw new Error(`R1-5 ABC ${testCase.id}: no safe projection endpoint.`);
          const projected = nearestSafeBlend(snapshot, companionMove, safe);
          maximumCommandCorrection = Math.max(maximumCommandCorrection, distance(companionMove, projected));
          companionMove = projected;
          constraintCount += 1;
          dynamicConstrained = true;
        }
        previousAcceleration = staticConstrained.constrained || dynamicConstrained
          ? { x: 0, y: 0 }
          : { ...shaped.acceleration };
      }

      minimumPredictedClearance = Math.min(minimumPredictedClearance, dynamicPlayerClearance(snapshot, companionMove));
      actors = physical.step([
        { actorId: "player", move: testCase.playerMove(step) },
        { actorId: "companion", move: companionMove }
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
      scenario: testCase.id,
      mode,
      constraintCount,
      minimumPredictedClearance,
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

const SCENARIOS: ScenarioCase[] = [
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

describe("R1-5 dynamic conflict DIRECT/NATURAL/PROJECTED localization", () => {
  it("localizes safety and progress differences before choosing a repair architecture", async () => {
    const rows: TrialEvidence[] = [];
    for (const scenario of SCENARIOS) {
      for (const mode of ["DIRECT", "NATURAL", "PROJECTED"] as const) {
        rows.push(await runTrial(scenario, mode));
      }
    }
    console.info(`R1-5 ABC evidence ${JSON.stringify(rows)}`);

    // This test is deliberately descriptive except for basic apparatus sanity.
    // Promotion criteria are derived only after comparing the three modes.
    for (const row of rows) {
      expect(Number.isFinite(row.endTargetDistance), `${row.scenario}/${row.mode}`).toBe(true);
      expect(Number.isFinite(row.minimumCenterDistance), `${row.scenario}/${row.mode}`).toBe(true);
    }
  });
});
