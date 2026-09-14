import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { ActorSnapshot, MotionIntent, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { R1RecoveringDirectSpatialBrain } from "./r1-recovering-direct-spatial";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";
import { CCC0_SHADOW_INTERVAL_TICKS, R1WorkbenchSpatialStack } from "./r1-workbench-spatial-stack";

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id} fixture`);
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function playerIntent(random: () => number, step: number): MotionIntent {
  // Include exact stops, full reversals and arbitrary diagonal input. The world
  // normalizes magnitudes > 1, so deliberately exercise that boundary too.
  if (step % 47 >= 39) return { actorId: "player", move: { x: 0, y: 0 } };
  if (step % 61 === 0) return { actorId: "player", move: { x: -1, y: 0 } };
  const angle = random() * Math.PI * 2;
  const magnitude = 0.2 + random() * 1.35;
  return {
    actorId: "player",
    move: {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude
    }
  };
}

function relationshipTarget(snapshot: WorldSnapshot, step: number): Vec2 {
  const player = actor(snapshot, "player");
  const angle = step * 0.071;
  const radius = 1.15 + (step % 37) / 37 * 0.65;
  return {
    x: clamp(player.position.x + Math.cos(angle) * radius, 0.45, snapshot.width - 0.45),
    y: clamp(player.position.y + Math.sin(angle) * radius, 0.45, snapshot.height - 0.45)
  };
}

async function stressScenario(scenarioId: ScenarioId, natural: boolean, seed: number): Promise<void> {
  const baselineWorld = await LabWorld.create(scenarioId);
  const shadowWorld = await LabWorld.create(scenarioId);
  const baseline = natural
    ? new R1RecoveringNaturalSpatialBrain()
    : new R1RecoveringDirectSpatialBrain();
  const stack = new R1WorkbenchSpatialStack();
  const random = lcg(seed);

  let baselineSnapshot = baselineWorld.snapshot();
  let shadowSnapshot = shadowWorld.snapshot();

  try {
    expect(shadowSnapshot).toEqual(baselineSnapshot);

    for (let step = 0; step < 360; step += 1) {
      const target = relationshipTarget(baselineSnapshot, step);
      const baselineBody = actor(baselineSnapshot, "companion");
      const shadowBody = actor(shadowSnapshot, "companion");
      const baselineQuery = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
        baselineWorld.staticCircleTraversal(from, to, radius, options);
      const shadowQuery = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
        shadowWorld.staticCircleTraversal(from, to, radius, options);
      const baselineRoute = planStaticShadowRoute({
        snapshot: baselineSnapshot,
        start: baselineBody.position,
        target,
        radius: baselineBody.radius,
        query: baselineQuery
      });
      const shadowRoute = planStaticShadowRoute({
        snapshot: shadowSnapshot,
        start: shadowBody.position,
        target,
        radius: shadowBody.radius,
        query: shadowQuery
      });

      const baselineIntent = baseline.intent({
        snapshot: baselineSnapshot,
        relationshipTarget: target,
        routePlan: baselineRoute,
        query: baselineQuery,
        occupancy: (center, radius) => baselineWorld.staticCircleOccupancy(center, radius)
      });
      const shadowIntent = stack.intent(natural, {
        snapshot: shadowSnapshot,
        relationshipTarget: target,
        routePlan: shadowRoute,
        query: shadowQuery,
        occupancy: (center, radius) => shadowWorld.staticCircleOccupancy(center, radius)
      });

      expect(shadowIntent).toEqual(baselineIntent);

      const scriptedPlayerIntent = playerIntent(random, step);
      baselineSnapshot = baselineWorld.step([scriptedPlayerIntent, baselineIntent]);
      shadowSnapshot = shadowWorld.step([scriptedPlayerIntent, shadowIntent]);
      expect(shadowSnapshot).toEqual(baselineSnapshot);

      const baselineAfterBody = actor(baselineSnapshot, "companion");
      const shadowAfterBody = actor(shadowSnapshot, "companion");
      const baselineAfterRoute = planStaticShadowRoute({
        snapshot: baselineSnapshot,
        start: baselineAfterBody.position,
        target,
        radius: baselineAfterBody.radius,
        query: baselineQuery
      });
      const shadowAfterRoute = planStaticShadowRoute({
        snapshot: shadowSnapshot,
        start: shadowAfterBody.position,
        target,
        radius: shadowAfterBody.radius,
        query: shadowQuery
      });

      const objectiveKey = `ccc0-audit:${scenarioId}:dynamic-player-relative-target`;
      const baselineProgress = baseline.observeOutcome({
        snapshot: baselineSnapshot,
        objectiveKey,
        target,
        routePlan: baselineAfterRoute
      });
      const shadowProgress = stack.observeOutcome(natural, {
        snapshot: shadowSnapshot,
        objectiveKey,
        target,
        routePlan: shadowAfterRoute
      });
      expect(shadowProgress).toEqual(baselineProgress);

      const debug = stack.debugState(natural);
      expect(debug.shadowCoordinationError).toBeNull();
      expect(debug.shadowCoordination).not.toBeNull();
      const shadowTick = debug.shadowCoordination!.tick;
      expect(shadowTick).toBeLessThanOrEqual(shadowSnapshot.tick - 1);
      expect((shadowSnapshot.tick - 1) - shadowTick).toBeLessThan(CCC0_SHADOW_INTERVAL_TICKS);
    }
  } finally {
    baselineWorld.dispose();
    shadowWorld.dispose();
  }
}

describe("CCC-0 zero-authority differential torture", () => {
  const scenarios = ["open", "pillar", "doorway", "head-on"] as const;
  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
    const scenarioId = scenarios[scenarioIndex]!;
    for (const natural of [false, true]) {
      const mode = natural ? "NATURAL" : "DIRECT";
      it(`${scenarioId} ${mode} remains byte-identical for 360 adversarial World steps`, async () => {
        await stressScenario(
          scenarioId,
          natural,
          0x9e3779b9 ^ (scenarioIndex * 0x45d9f3b) ^ (natural ? 0x51ed270b : 0)
        );
      }, 20_000);
    }
  }
});
