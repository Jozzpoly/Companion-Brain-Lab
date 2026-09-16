import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import { evaluateA1H1PrimaryShadowHorizon } from "./a1-h1-primary-shadow";
import { buildA1Situation } from "./a1-situation";
import { A1AuthorityRuntime } from "./a1-authority-runtime";

describe("Authority-A1 isolated selector runtime", () => {
  it("keeps OFF as the default and returns the baseline companion intent exactly", () => {
    const runtime = new A1AuthorityRuntime();
    const baseline = { actorId: "companion" as const, move: { x: 0.37, y: -0.22 } };

    expect(runtime.variant()).toBe("off");
    expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation: null })).toEqual(baseline);
    expect(runtime.debugState()).toMatchObject({
      variant: "off",
      passThroughSteps: 0,
      latestSituation: null
    });
  });

  it("cycles OFF -> DIRECT -> TEMPORAL -> OFF without touching baseline mode semantics", () => {
    const runtime = new A1AuthorityRuntime();
    expect(runtime.cycleVariant()).toEqual({ previous: "off", next: "direct" });
    expect(runtime.cycleVariant()).toEqual({ previous: "direct", next: "temporal" });
    expect(runtime.cycleVariant()).toEqual({ previous: "temporal", next: "off" });
    expect(runtime.variant()).toBe("off");
  });

  it("resets only A1-owned situation/history whenever the experimental authority variant changes", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("direct");
      const before = world.snapshot();
      const situation = buildA1Situation({
        snapshot: before,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      const baseline = { actorId: "companion" as const, move: { x: 0.6, y: 0.1 } };

      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation })).toEqual(baseline);
      const direct = runtime.debugState();
      expect(direct.variant).toBe("direct");
      expect(direct.passThroughSteps).toBe(1);
      expect(direct.latestSituation?.tick).toBe(0);

      runtime.setVariant("temporal");
      const temporal = runtime.debugState();
      expect(temporal.variant).toBe("temporal");
      expect(temporal.epoch).toBe(direct.epoch + 1);
      expect(temporal.passThroughSteps).toBe(0);
      expect(temporal.latestSituation).toBeNull();

      runtime.setVariant("off");
      const off = runtime.debugState();
      expect(off.variant).toBe("off");
      expect(off.epoch).toBe(temporal.epoch + 1);
      expect(off.latestSituation).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("defensively clones the latest A1 situation instead of exposing mutable runtime history", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("direct");
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });

      runtime.resolveCompanionIntent({
        baselineIntent: { actorId: "companion", move: { x: 0, y: 0 } },
        situation
      });
      const first = runtime.debugState();
      first.latestSituation!.situated.playerControl.move.x = 999;
      first.latestSituation!.playerRequestedVelocity.velocity.x = 999;

      const second = runtime.debugState();
      expect(second.latestSituation?.situated.playerControl.move.x).toBe(1);
      expect(second.latestSituation?.playerRequestedVelocity.velocity.x).toBe(3);
    } finally {
      world.dispose();
    }
  });

  it("carries cloned Owner-memory evidence from observer through runtime into H1 research without movement authority", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("direct");
      const baseline = { actorId: "companion" as const, move: { x: 0, y: 0 } };

      const t0Snapshot = world.snapshot();
      const t0Situation = buildA1Situation({
        snapshot: t0Snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      expect(runtime.observeRelationship({
        situation: t0Situation,
        snapshot: t0Snapshot,
        query: (from, target, radius, options) => world.staticCircleTraversal(from, target, radius, options)
      })).not.toBeNull();
      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation: t0Situation })).toEqual(baseline);
      expect(runtime.latestRelationshipOrientationEvidence()?.source).toBe("SAME_STEP_OWNER");

      const t1Snapshot = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        baseline
      ]);
      const t1Situation = buildA1Situation({
        snapshot: t1Snapshot,
        playerIntent: { actorId: "player", move: { x: 0, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      expect(runtime.observeRelationship({
        situation: t1Situation,
        snapshot: t1Snapshot,
        query: (from, target, radius, options) => world.staticCircleTraversal(from, target, radius, options)
      })).not.toBeNull();
      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation: t1Situation })).toEqual(baseline);

      const firstEvidence = runtime.latestRelationshipOrientationEvidence();
      expect(firstEvidence).not.toBeNull();
      expect(firstEvidence?.tick).toBe(t1Situation.tick);
      expect(firstEvidence?.source).toBe("OWNER_MEMORY");
      expect(firstEvidence?.direction).toEqual({ x: 1, y: 0 });
      expect(firstEvidence?.ageTicks).toBe(1);

      firstEvidence!.direction!.x = 999;
      firstEvidence!.samplingBasis.x = 999;
      firstEvidence!.nextMemory!.direction.x = 999;
      const secondEvidence = runtime.latestRelationshipOrientationEvidence();
      expect(secondEvidence?.direction).toEqual({ x: 1, y: 0 });
      expect(secondEvidence?.samplingBasis).toEqual({ x: 1, y: 0 });
      expect(secondEvidence?.nextMemory?.direction).toEqual({ x: 1, y: 0 });

      const h1 = evaluateA1H1PrimaryShadowHorizon({
        world,
        situation: t1Situation,
        horizonSeconds: 1,
        orientation: secondEvidence!
      });
      expect(h1.stageTrace.proposals.some((proposal) => proposal.comparisonEligible && proposal.q !== null)).toBe(true);
      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation: t1Situation })).toEqual(baseline);
    } finally {
      world.dispose();
    }
  });
});
