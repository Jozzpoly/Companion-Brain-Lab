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

interface Metrics {
  mode: Mode;
  reversalResponseTicks: number | null;
  peakRequestedVelocityDelta: number;
  meanRequestedSpeedBeforeReversal: number;
  meanRequestedSpeedAfterReversal: number;
  requestedSpeedStdDev: number;
  physicalPathLength: number;
  lateralTravel: number;
  maximumPlayerDistance: number;
  playerContactFrames: number;
}

async function run(mode: Mode): Promise<Metrics> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `behavior ablation ${mode}`,
    width: 40,
    height: 12,
    actors: [
      { id: "player", position: { x: 12, y: 6 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 8, y: 6 }, radius: 0.3, speed: 3 }
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
  let maximumPlayerDistance = distance(actor(snapshot, "player").position, actor(snapshot, "companion").position);
  let playerContactFrames = 0;
  let reversalResponseTicks: number | null = null;
  const reversalTick = 90;

  try {
    for (let step = 0; step < 180; step += 1) {
      const playerMove = step < reversalTick ? { x: 1, y: 0 } : { x: -1, y: 0 };
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
        { actorId: "player", move: playerMove },
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
      maximumPlayerDistance = Math.max(maximumPlayerDistance, distance(player.position, companion.position));
      if (companion.contacts.some((contact) => contact.with === "player")) playerContactFrames += 1;

      if (
        step >= reversalTick &&
        reversalResponseTicks === null &&
        companion.requestedVelocity.x < -0.15
      ) {
        reversalResponseTicks = step - reversalTick;
      }

      if (spatialTarget && spatialRoute) {
        const postCompanion = actor(snapshot, "companion");
        const postRoute = planStaticShadowRoute({
          snapshot,
          start: postCompanion.position,
          target: spatialTarget,
          radius: postCompanion.radius,
          query
        });
        const brain = mode === "SPATIAL_DIRECT" ? direct : natural;
        brain.observeOutcome({
          snapshot,
          objectiveKey: `ablation:${relational.debugState()?.selectedSlot ?? "unknown"}`,
          target: spatialTarget,
          routePlan: postRoute
        });
      }
    }

    let peakRequestedVelocityDelta = 0;
    for (let index = 1; index < requested.length; index += 1) {
      peakRequestedVelocityDelta = Math.max(
        peakRequestedVelocityDelta,
        velocityDelta(requested[index - 1]!, requested[index]!)
      );
    }

    const speeds = requested.map(magnitude);
    const before = speeds.slice(60, 90);
    const after = speeds.slice(90, 150);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const speedMean = mean(speeds);
    const speedVariance = mean(speeds.map((value) => (value - speedMean) ** 2));
    let physicalPathLength = 0;
    let lateralTravel = 0;
    for (let index = 1; index < positions.length; index += 1) {
      physicalPathLength += distance(positions[index - 1]!, positions[index]!);
      lateralTravel += Math.abs(positions[index]!.y - positions[index - 1]!.y);
    }

    return {
      mode,
      reversalResponseTicks,
      peakRequestedVelocityDelta,
      meanRequestedSpeedBeforeReversal: mean(before),
      meanRequestedSpeedAfterReversal: mean(after),
      requestedSpeedStdDev: Math.sqrt(speedVariance),
      physicalPathLength,
      lateralTravel,
      maximumPlayerDistance,
      playerContactFrames
    };
  } finally {
    physical.dispose();
  }
}

describe("behavior-forensics: stack ablation", () => {
  it("characterizes CHASE -> RELATIONAL -> SPATIAL DIRECT -> SPATIAL NATURAL under the same reversal", async () => {
    const results = [] as Metrics[];
    for (const mode of MODES) results.push(await run(mode));
    console.info("BEHAVIOR_STACK_ABLATION", JSON.stringify(results));

    expect(results.map((entry) => entry.mode)).toEqual([...MODES]);
    for (const result of results) {
      expect(Number.isFinite(result.peakRequestedVelocityDelta)).toBe(true);
      expect(Number.isFinite(result.physicalPathLength)).toBe(true);
      expect(result.physicalPathLength).toBeGreaterThan(0);
    }

    const chase = results.find((entry) => entry.mode === "CHASE")!;
    const natural = results.find((entry) => entry.mode === "SPATIAL_NATURAL")!;
    expect(natural.peakRequestedVelocityDelta).toBeLessThan(chase.peakRequestedVelocityDelta);
  });
});