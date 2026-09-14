import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { RelationalPositioningBrain, chaseIntent } from "./relational-positioning";
import { R1RecoveringDirectSpatialBrain } from "./r1-recovering-direct-spatial";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";

const MODES = ["CHASE", "RELATIONAL", "SPATIAL_DIRECT", "SPATIAL_NATURAL"] as const;
type Mode = typeof MODES[number];

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function velocityDelta(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a: Vec2, b: Vec2): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma < 1e-6 || mb < 1e-6) return 0;
  const dot = (a.x * b.x + a.y * b.y) / (ma * mb);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function playerMove(step: number): Vec2 {
  const throttle = 0.5;
  if (step < 60) return { x: throttle, y: 0 };
  if (step < 120) {
    const t = (step - 60) / 59;
    const angle = t * Math.PI / 2;
    return { x: Math.cos(angle) * throttle, y: Math.sin(angle) * throttle };
  }
  return { x: 0, y: throttle };
}

interface Metrics {
  mode: Mode;
  peakRequestedVelocityDelta: number;
  peakDirectionTurnRadians: number;
  totalDirectionTurnRadians: number;
  requestedSpeedStdDev: number;
  physicalPathLength: number;
  playerContactFrames: number;
  meanPlayerDistance: number;
  finalPlayerDistance: number;
}

async function run(mode: Mode): Promise<Metrics> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `arc-turn ${mode}`,
    width: 40,
    height: 24,
    actors: [
      { id: "player", position: { x: 14, y: 10 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 8, y: 10 }, radius: 0.3, speed: 3 }
    ],
    obstacles: []
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const relational = new RelationalPositioningBrain();
  const direct = new R1RecoveringDirectSpatialBrain();
  const natural = new R1RecoveringNaturalSpatialBrain();
  const query = (
    from: Vec2,
    to: Vec2,
    radius: number,
    options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]
  ) => physical.staticCircleTraversal(from, to, radius, options);

  let tick = 0;
  let snapshot: WorldSnapshot = {
    tick,
    scenarioId: "open",
    width: spec.width,
    height: spec.height,
    actors: physical.snapshot(),
    obstacles: []
  };
  const requested: Vec2[] = [];
  const positions: Vec2[] = [{ ...actor(snapshot, "companion").position }];
  let playerContactFrames = 0;
  let playerDistanceSum = 0;

  try {
    for (let step = 0; step < 180; step += 1) {
      let companionIntent;
      let spatialTarget: Vec2 | null = null;
      let spatialRoute = null;

      if (mode === "CHASE") {
        companionIntent = chaseIntent(snapshot);
      } else if (mode === "RELATIONAL") {
        companionIntent = relational.intent(snapshot);
      } else {
        const relationship = relational.decision(snapshot);
        spatialTarget = { ...relationship.target };
        const companion = actor(snapshot, "companion");
        spatialRoute = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target: spatialTarget,
          radius: companion.radius,
          query
        });
        const input = {
          snapshot,
          relationshipTarget: spatialTarget,
          routePlan: spatialRoute,
          query,
          occupancy: (center: Vec2, radius: number) => physical.staticCircleOccupancy(center, radius)
        };
        companionIntent = mode === "SPATIAL_DIRECT" ? direct.intent(input) : natural.intent(input);
      }

      const actors = physical.step([
        { actorId: "player", move: playerMove(step) },
        companionIntent
      ]);
      tick += 1;
      snapshot = {
        tick,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors,
        obstacles: []
      };

      const companion = actor(snapshot, "companion");
      const player = actor(snapshot, "player");
      requested.push({ ...companion.requestedVelocity });
      positions.push({ ...companion.position });
      playerDistanceSum += distance(player.position, companion.position);
      if (companion.contacts.some((contact) => contact.with === "player")) playerContactFrames += 1;

      if (spatialTarget && spatialRoute) {
        const postRoute = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target: spatialTarget,
          radius: companion.radius,
          query
        });
        const brain = mode === "SPATIAL_DIRECT" ? direct : natural;
        brain.observeOutcome({
          snapshot,
          objectiveKey: `arc:${relational.debugState()?.selectedSlot ?? "unknown"}`,
          target: spatialTarget,
          routePlan: postRoute
        });
      }
    }

    let peakRequestedVelocityDelta = 0;
    let peakDirectionTurnRadians = 0;
    let totalDirectionTurnRadians = 0;
    for (let index = 1; index < requested.length; index += 1) {
      peakRequestedVelocityDelta = Math.max(
        peakRequestedVelocityDelta,
        velocityDelta(requested[index - 1]!, requested[index]!)
      );
      const turn = angleBetween(requested[index - 1]!, requested[index]!);
      peakDirectionTurnRadians = Math.max(peakDirectionTurnRadians, turn);
      totalDirectionTurnRadians += turn;
    }

    const speeds = requested.map(magnitude);
    const speedMean = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
    const speedVariance = speeds.reduce((sum, value) => sum + (value - speedMean) ** 2, 0) / speeds.length;
    let physicalPathLength = 0;
    for (let index = 1; index < positions.length; index += 1) {
      physicalPathLength += distance(positions[index - 1]!, positions[index]!);
    }
    const finalPlayer = actor(snapshot, "player");
    const finalCompanion = actor(snapshot, "companion");
    return {
      mode,
      peakRequestedVelocityDelta,
      peakDirectionTurnRadians,
      totalDirectionTurnRadians,
      requestedSpeedStdDev: Math.sqrt(speedVariance),
      physicalPathLength,
      playerContactFrames,
      meanPlayerDistance: playerDistanceSum / 180,
      finalPlayerDistance: distance(finalPlayer.position, finalCompanion.position)
    };
  } finally {
    physical.dispose();
  }
}

describe("behavior-forensics: smooth arc-turn stack ablation", () => {
  it("separates geometric path richness from temporal realization without a discrete reversal stimulus", async () => {
    const results: Metrics[] = [];
    for (const mode of MODES) results.push(await run(mode));
    console.info("BEHAVIOR_STACK_ARC_TURN", JSON.stringify(results));

    expect(results.map((entry) => entry.mode)).toEqual([...MODES]);
    const direct = results.find((entry) => entry.mode === "SPATIAL_DIRECT")!;
    const natural = results.find((entry) => entry.mode === "SPATIAL_NATURAL")!;
    expect(natural.peakRequestedVelocityDelta).toBeLessThan(direct.peakRequestedVelocityDelta);
    expect(natural.peakDirectionTurnRadians).toBeLessThanOrEqual(direct.peakDirectionTurnRadians + 1e-9);
  });
});