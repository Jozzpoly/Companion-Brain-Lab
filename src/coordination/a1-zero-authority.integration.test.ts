import { describe, expect, it } from "vitest";
import { R1WorkbenchSpatialStack } from "../brain/r1-workbench-spatial-stack";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { ActorSnapshot, MotionIntent, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { A1AuthorityRuntime, type A1AuthorityVariant } from "./a1-authority-runtime";
import { buildA1Situation } from "./a1-situation";

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

function scriptedPlayerIntent(random: () => number, step: number): MotionIntent {
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

async function differentialScenario(
  scenarioId: ScenarioId,
  natural: boolean,
  variant: A1AuthorityVariant,
  seed: number
): Promise<void> {
  const baselineWorld = await LabWorld.create(scenarioId);
  const candidateWorld = await LabWorld.create(scenarioId);
  const baselineStack = new R1WorkbenchSpatialStack();
  const candidateStack = new R1WorkbenchSpatialStack();
  const a1 = new A1AuthorityRuntime();
  a1.setVariant(variant);
  const random = lcg(seed);

  let baselineSnapshot = baselineWorld.snapshot();
  let candidateSnapshot = candidateWorld.snapshot();

  try {
    expect(candidateSnapshot).toEqual(baselineSnapshot);

    for (let step = 0; step < 120; step += 1) {
      const target = relationshipTarget(baselineSnapshot, step);
      const baselineBody = actor(baselineSnapshot, "companion");
      const candidateBody = actor(candidateSnapshot, "companion");
      const baselineQuery = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
        baselineWorld.staticCircleTraversal(from, to, radius, options);
      const candidateQuery = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
        candidateWorld.staticCircleTraversal(from, to, radius, options);
      const baselineRoute = planStaticShadowRoute({
        snapshot: baselineSnapshot,
        start: baselineBody.position,
        target,
        radius: baselineBody.radius,
        query: baselineQuery
      });
      const candidateRoute = planStaticShadowRoute({
        snapshot: candidateSnapshot,
        start: candidateBody.position,
        target,
        radius: candidateBody.radius,
        query: candidateQuery
      });

      const baselineIntent = baselineStack.intent(natural, {
        snapshot: baselineSnapshot,
        relationshipTarget: target,
        routePlan: baselineRoute,
        query: baselineQuery,
        occupancy: (center, radius) => baselineWorld.staticCircleOccupancy(center, radius)
      });
      const candidateBaselineIntent = candidateStack.intent(natural, {
        snapshot: candidateSnapshot,
        relationshipTarget: target,
        routePlan: candidateRoute,
        query: candidateQuery,
        occupancy: (center, radius) => candidateWorld.staticCircleOccupancy(center, radius)
      });
      expect(candidateBaselineIntent).toEqual(baselineIntent);

      const playerIntent = scriptedPlayerIntent(random, step);
      const situation = variant === "off"
        ? null
        : buildA1Situation({
            snapshot: candidateSnapshot,
            playerIntent,
            playerCapability: candidateWorld.actorMovementCapability("player"),
            companionCapability: candidateWorld.actorMovementCapability("companion"),
            previousWorldStep: candidateWorld.latestAuthorityA0StepEvidence()
          });
      const candidateIntent = a1.resolveCompanionIntent({
        baselineIntent: candidateBaselineIntent,
        situation
      });
      expect(candidateIntent).toEqual(baselineIntent);

      if (variant !== "off") {
        const debug = a1.debugState();
        expect(debug.latestSituation?.tick).toBe(candidateSnapshot.tick);
        expect(debug.latestSituation?.situated.playerControl.sourceTick).toBe(candidateSnapshot.tick);
        expect(debug.latestSituation?.playerRequestedVelocity.sourceTick).toBe(candidateSnapshot.tick);
        if (candidateSnapshot.tick === 0) expect(debug.latestSituation?.previousOutcome).toBeNull();
        else expect(debug.latestSituation?.previousOutcome?.outcomeTick).toBe(candidateSnapshot.tick);
      }

      baselineSnapshot = baselineWorld.step([playerIntent, baselineIntent]);
      candidateSnapshot = candidateWorld.step([playerIntent, candidateIntent]);
      expect(candidateSnapshot).toEqual(baselineSnapshot);

      const baselineAfterBody = actor(baselineSnapshot, "companion");
      const candidateAfterBody = actor(candidateSnapshot, "companion");
      const baselineAfterRoute = planStaticShadowRoute({
        snapshot: baselineSnapshot,
        start: baselineAfterBody.position,
        target,
        radius: baselineAfterBody.radius,
        query: baselineQuery
      });
      const candidateAfterRoute = planStaticShadowRoute({
        snapshot: candidateSnapshot,
        start: candidateAfterBody.position,
        target,
        radius: candidateAfterBody.radius,
        query: candidateQuery
      });
      const objectiveKey = `a1-0:${scenarioId}:pass-through`;
      const baselineProgress = baselineStack.observeOutcome(natural, {
        snapshot: baselineSnapshot,
        objectiveKey,
        target,
        routePlan: baselineAfterRoute
      });
      const candidateProgress = candidateStack.observeOutcome(natural, {
        snapshot: candidateSnapshot,
        objectiveKey,
        target,
        routePlan: candidateAfterRoute
      });
      expect(candidateProgress).toEqual(baselineProgress);
    }

    const debug = a1.debugState();
    expect(debug.variant).toBe(variant);
    expect(debug.passThroughSteps).toBe(variant === "off" ? 0 : 120);
  } finally {
    baselineWorld.dispose();
    candidateWorld.dispose();
  }
}

describe("Authority-A1.0 structural zero-authority differential", () => {
  const scenarios = ["open", "pillar", "doorway", "head-on"] as const;
  const variants = ["off", "direct", "temporal"] as const;

  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
    const scenarioId = scenarios[scenarioIndex]!;
    for (const natural of [false, true]) {
      for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
        const variant = variants[variantIndex]!;
        const actuator = natural ? "NATURAL" : "DIRECT";
        it(`${scenarioId} ${actuator} + A1 ${variant.toUpperCase()} scaffold remains exact for 120 World steps`, async () => {
          await differentialScenario(
            scenarioId,
            natural,
            variant,
            0x7f4a7c15 ^ (scenarioIndex * 0x45d9f3b) ^ (variantIndex * 0x119de1f3) ^ (natural ? 0x51ed270b : 0)
          );
        }, 20_000);
      }
    }
  }
});
