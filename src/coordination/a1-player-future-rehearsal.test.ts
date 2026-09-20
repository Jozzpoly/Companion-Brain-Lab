import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { rehearseA1PlayerFutureIntervention } from "./a1-player-future-rehearsal";
import { buildA1Situation } from "./a1-situation";
import { LabWorld, WORLD_STEP_SECONDS } from "../world/world";
import type { ActorSnapshot, MotionIntent } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function actor(actors: readonly ActorSnapshot[], id: "player" | "companion"): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function buildPlan(
  world: LabWorld,
  snapshot: ReturnType<LabWorld["snapshot"]>,
  intent: MotionIntent,
  horizonSeconds: number
) {
  const situation = buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0 ? null : world.latestAuthorityA0StepEvidence()
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
  return buildA1PlayerFutureInterventionPlan(futures);
}

describe("Authority-A1.2i single player-future physical rehearsal", () => {
  it("executes one aligned H1 through exactly 30 World steps without mutating live World", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const beforeA0 = world.latestAuthorityA0StepEvidence();
      const plan = buildPlan(world, before, playerIntent(1, 0), 0.5);
      const h1 = plan.interventions.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION");
      if (!h1) throw new Error("missing H1");

      const result = rehearseA1PlayerFutureIntervention({ world, intervention: h1 });

      expect(result.kind).toBe("A1_PLAYER_FUTURE_PHYSICAL_REHEARSAL");
      expect(result.causalMeaning).toBe("OWNER_REQUEST_PERSISTS_COUNTERFACTUAL");
      expect(result.interventionVelocity).toEqual({ x: 3, y: 0 });
      expect(result.worldStepSeconds).toBe(WORLD_STEP_SECONDS);
      expect(result.worldStepCount).toBe(30);
      expect(result.executedHorizonSeconds).toBeCloseTo(0.5, 12);
      expect(result.horizonAlignmentErrorSeconds).toBeLessThanOrEqual(1e-12);
      expect(result.physical.frames).toHaveLength(30);
      expect(result.physical.physicsProvenance).toBe("LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE");
      expect(result.companionBaseline).toBe("LIVE_HOLD_CONTROL_ZERO_VELOCITY_EACH_WORLD_STEP");
      expect(result.aggregationClaim).toBe("NONE_SINGLE_INTERVENTION_A1_2I");
      expect(result.companionCandidateClaim).toBe("NONE_A1_2I_PLAYER_ONLY");
      expect(result.g3SafetyClaim).toBe("NONE_A1_2I_PHYSICAL_REHEARSAL_ONLY");
      expect(world.snapshot()).toEqual(before);
      expect(world.latestAuthorityA0StepEvidence()).toEqual(beforeA0);
    } finally {
      world.dispose();
    }
  });

  it("lets same-physics contact response replace A1.2c clipping for a diagonal H1 pillar future", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const before = world.snapshot();
      const plan = buildPlan(world, before, playerIntent(0.8, 0.4), 1.5);
      const h1 = plan.interventions.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION");
      if (!h1 || h1.status !== "REHEARSABLE") throw new Error("missing rehearsable H1");

      const result = rehearseA1PlayerFutureIntervention({ world, intervention: h1 });
      expect(result.worldStepCount).toBe(90);
      expect(result.interventionVelocity.x).toBeCloseTo(2.4, 12);
      expect(result.interventionVelocity.y).toBeCloseTo(1.2, 12);

      const contactFrames = result.physical.frames.filter((frame) =>
        actor(frame.actors, "player").contacts.some((contact) => contact.with === "pillar.center")
      );
      expect(contactFrames.length).toBeGreaterThan(0);
      const firstContact = actor(contactFrames[0]!.actors, "player");
      const finalPlayer = actor(result.physical.frames.at(-1)!.actors, "player");
      expect(finalPlayer.position.y).toBeGreaterThan(firstContact.position.y + 0.25);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("executes OWNER_DIRECTED H2 only with its qualified causal meaning preserved", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const plan = buildPlan(world, after, playerIntent(1, 0), 0.5);
      const h2 = plan.interventions.find((value) => value.futureFamily === "BODY_RESPONSE_CONTINUATION");
      if (!h2) throw new Error("missing H2");
      expect(h2.status).toBe("REHEARSABLE");
      if (h2.status !== "REHEARSABLE") throw new Error("expected rehearsable H2");
      expect(h2.bodyMotionProvenance).toBe("OWNER_DIRECTED");

      const result = rehearseA1PlayerFutureIntervention({ world, intervention: h2 });
      expect(result.causalMeaning).toBe("OWNER_DIRECTED_BODY_RESPONSE_PERSISTS_COUNTERFACTUAL");
      expect(result.interventionVelocity).toEqual(h2.repeatedVelocity);
      expect(result.worldStepCount).toBe(30);
    } finally {
      world.dispose();
    }
  });

  it("keeps a reversal H3 as a separate explicit hold rehearsal", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const plan = buildPlan(world, after, playerIntent(-1, 0), 0.5);
      const h3 = plan.interventions.find((value) => value.futureFamily === "TRANSITION_HOLD");
      if (!h3 || h3.status !== "REHEARSABLE") throw new Error("missing rehearsable H3");

      const result = rehearseA1PlayerFutureIntervention({ world, intervention: h3 });
      expect(result.causalMeaning).toBe("TRANSITION_HOLD_COUNTERFACTUAL");
      expect(result.interventionVelocity).toEqual({ x: 0, y: 0 });
      for (const frame of result.physical.frames) {
        expect(actor(frame.actors, "player").requestedVelocity).toEqual({ x: 0, y: 0 });
      }
    } finally {
      world.dispose();
    }
  });

  it("refuses unresolved H2 instead of substituting another future", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const plan = buildPlan(world, before, playerIntent(1, 0), 0.5);
      const h2 = plan.interventions.find((value) => value.futureFamily === "BODY_RESPONSE_CONTINUATION");
      if (!h2) throw new Error("missing H2");
      expect(h2.status).toBe("UNRESOLVED");

      expect(() => rehearseA1PlayerFutureIntervention({ world, intervention: h2 }))
        .toThrow(/refuses unresolved player future/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("refuses stale interventions whose source tick no longer matches live World", async () => {
    const world = await LabWorld.create("open");
    try {
      const initial = world.snapshot();
      const plan = buildPlan(world, initial, playerIntent(1, 0), 0.5);
      const h1 = plan.interventions.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION");
      if (!h1) throw new Error("missing H1");

      world.step([playerIntent(1, 0), companionHold()]);
      const beforeRejectedRehearsal = world.snapshot();
      expect(() => rehearseA1PlayerFutureIntervention({ world, intervention: h1 }))
        .toThrow(/source tick 0 does not equal live World tick 1/i);
      expect(world.snapshot()).toEqual(beforeRejectedRehearsal);
    } finally {
      world.dispose();
    }
  });

  it("refuses non-aligned horizons instead of rounding the authority horizon", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const plan = buildPlan(world, before, playerIntent(1, 0), 0.51);
      const h1 = plan.interventions.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION");
      if (!h1) throw new Error("missing H1");

      expect(() => rehearseA1PlayerFutureIntervention({ world, intervention: h1 }))
        .toThrow(/not an exact integer multiple of World step/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("keeps companion HOLD explicit and unchanged in an open no-contact rehearsal", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const initialCompanion = actor(before.actors, "companion");
      const plan = buildPlan(world, before, playerIntent(1, 0), 0.5);
      const h1 = plan.interventions.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION");
      if (!h1) throw new Error("missing H1");

      const result = rehearseA1PlayerFutureIntervention({ world, intervention: h1 });
      const finalCompanion = actor(result.physical.frames.at(-1)!.actors, "companion");
      expect(finalCompanion.position).toEqual(initialCompanion.position);
      expect(finalCompanion.requestedVelocity).toEqual({ x: 0, y: 0 });
      expect(result.companionBaseline).toBe("LIVE_HOLD_CONTROL_ZERO_VELOCITY_EACH_WORLD_STEP");
    } finally {
      world.dispose();
    }
  });
});
