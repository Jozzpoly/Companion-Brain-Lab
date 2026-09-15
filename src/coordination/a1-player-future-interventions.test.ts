import { describe, expect, it } from "vitest";
import {
  buildA1PlayerFutureInterventionPlan,
  classifyA1PlayerFutureIntervention
} from "./a1-player-future-interventions";
import {
  buildA1PlayerFutureHypotheses,
  type A1PlayerFutureHypothesis
} from "./a1-player-future-hypotheses";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function buildFutures(
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
  return buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

function h2(futures: ReturnType<typeof buildFutures>): A1PlayerFutureHypothesis {
  const value = futures.hypotheses.find((future) => future.family === "BODY_RESPONSE_CONTINUATION");
  if (!value) throw new Error("missing H2");
  return value;
}

describe("Authority-A1.2h pure player-future intervention contract", () => {
  it("preserves initial H1/H2 as separate outputs and leaves stationary H2 explicitly unresolved", async () => {
    const world = await LabWorld.create("open");
    try {
      const futures = buildFutures(world, world.snapshot(), playerIntent(1, 0), 0.5);
      const plan = buildA1PlayerFutureInterventionPlan(futures);

      expect(plan.futureCount).toBe(futures.hypotheses.length);
      expect(plan.interventions.map((value) => value.futureId)).toEqual(
        futures.hypotheses.map((value) => value.id)
      );
      expect(plan.aggregationClaim).toBe("NONE_PRESERVE_H1_H2_H3_A1_2H");
      expect(plan.fallbackSubstitutionClaim).toBe("NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT_A1_2H");
      expect(plan.physicsExecutionClaim).toBe("NONE_A1_2H_PURE_CONTRACT");

      const h1 = plan.interventions.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION");
      const body = plan.interventions.find((value) => value.futureFamily === "BODY_RESPONSE_CONTINUATION");
      if (!h1 || !body) throw new Error("missing H1/H2 interventions");

      expect(h1.status).toBe("REHEARSABLE");
      if (h1.status !== "REHEARSABLE") throw new Error("expected H1 rehearsable");
      expect(h1.repeatedVelocity).toEqual({ x: 3, y: 0 });
      expect(h1.causalMeaning).toBe("OWNER_REQUEST_PERSISTS_COUNTERFACTUAL");

      expect(body.bodyMotionProvenance).toBe("STATIONARY");
      expect(body.status).toBe("UNRESOLVED");
      if (body.status !== "UNRESOLVED") throw new Error("expected stationary H2 unresolved");
      expect(body.unresolvedReason).toBe("H2_STATIONARY_IS_OBSERVATION_NOT_QUALIFIED_CONTROL");
      expect(body.repeatedVelocity).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("permits OWNER_DIRECTED H2 only as an explicitly labelled bounded body-response counterfactual", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const futures = buildFutures(world, after, playerIntent(1, 0), 0.5);
      const bodyFuture = h2(futures);
      expect(bodyFuture.bodyMotionProvenance).toBe("OWNER_DIRECTED");

      const intervention = classifyA1PlayerFutureIntervention(bodyFuture);
      expect(intervention.status).toBe("REHEARSABLE");
      if (intervention.status !== "REHEARSABLE") throw new Error("expected owner-directed H2 rehearsable");
      expect(intervention.repeatedVelocity).toEqual(bodyFuture.nominalVelocity);
      expect(intervention.causalMeaning).toBe("OWNER_DIRECTED_BODY_RESPONSE_PERSISTS_COUNTERFACTUAL");
      expect(intervention.physicsExecutionClaim).toBe("NONE_A1_2H_PURE_CONTRACT");
    } finally {
      world.dispose();
    }
  });

  it("refuses to convert constrained, external or mixed H2 effects into self-sustaining control", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const base = h2(buildFutures(world, after, playerIntent(1, 0), 0.5));
      expect(base.bodyMotionProvenance).toBe("OWNER_DIRECTED");

      const cases = [
        ["OWNER_CONSTRAINED", "H2_OWNER_CONSTRAINED_IS_EFFECT_NOT_CONTROL"],
        ["EXTERNAL_MOTION_EVIDENT", "H2_EXTERNAL_MOTION_IS_EFFECT_NOT_CONTROL"],
        ["MIXED_OR_UNCERTAIN", "H2_MIXED_CAUSALITY_IS_NOT_QUALIFIED_CONTROL"]
      ] as const;

      for (const [provenance, reason] of cases) {
        const result = classifyA1PlayerFutureIntervention({
          ...base,
          bodyMotionProvenance: provenance
        });
        expect(result.status).toBe("UNRESOLVED");
        if (result.status !== "UNRESOLVED") throw new Error(`expected ${provenance} unresolved`);
        expect(result.unresolvedReason).toBe(reason);
        expect(result.repeatedVelocity).toBeNull();
        expect(result.causalMeaning).toBeNull();
      }
    } finally {
      world.dispose();
    }
  });

  it("preserves H3 as a separate explicit zero-control counterfactual during a real reversal", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const futures = buildFutures(world, after, playerIntent(-1, 0), 0.5);
      const plan = buildA1PlayerFutureInterventionPlan(futures);
      const hold = plan.interventions.find((value) => value.futureFamily === "TRANSITION_HOLD");
      if (!hold) throw new Error("missing H3");

      expect(hold.status).toBe("REHEARSABLE");
      if (hold.status !== "REHEARSABLE") throw new Error("expected H3 rehearsable");
      expect(hold.repeatedVelocity).toEqual({ x: 0, y: 0 });
      expect(hold.causalMeaning).toBe("TRANSITION_HOLD_COUNTERFACTUAL");
      expect(hold.transitionReasons).toContain("OWNER_REQUEST_REVERSED");
      expect(plan.interventions.map((value) => value.futureFamily)).toEqual([
        "OWNER_REQUEST_CONTINUATION",
        "BODY_RESPONSE_CONTINUATION",
        "TRANSITION_HOLD"
      ]);
    } finally {
      world.dispose();
    }
  });

  it("uses nominal H1 control rather than A1.2c clipped effective velocity when static contact is predicted", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const futures = buildFutures(world, world.snapshot(), playerIntent(1, 0), 1.5);
      const owner = futures.hypotheses.find((future) => future.family === "OWNER_REQUEST_CONTINUATION");
      if (!owner) throw new Error("missing H1");
      expect(owner.staticFeasibility.clipped).toBe(true);
      expect(owner.effectiveVelocity.x).toBeLessThan(owner.nominalVelocity.x);

      const intervention = classifyA1PlayerFutureIntervention(owner);
      expect(intervention.status).toBe("REHEARSABLE");
      if (intervention.status !== "REHEARSABLE") throw new Error("expected H1 rehearsable");
      expect(intervention.repeatedVelocity).toEqual(owner.nominalVelocity);
      expect(intervention.staticFeasibilityUsage).toBe(
        "IGNORED_FOR_INTERVENTION_A1_2H_SAME_PHYSICS_LATER"
      );
    } finally {
      world.dispose();
    }
  });

  it("rejects forged provenance instead of silently reinterpreting future families", async () => {
    const world = await LabWorld.create("open");
    try {
      const futures = buildFutures(world, world.snapshot(), playerIntent(1, 0), 0.5);
      const owner = futures.hypotheses.find((future) => future.family === "OWNER_REQUEST_CONTINUATION");
      const body = h2(futures);
      if (!owner) throw new Error("missing H1");

      expect(() => classifyA1PlayerFutureIntervention({
        ...owner,
        velocityEvidenceSource: "CURRENT_OBSERVED_BODY_RESPONSE"
      })).toThrow(/H1 requires same-step Owner-request velocity provenance/i);

      expect(() => classifyA1PlayerFutureIntervention({
        ...body,
        bodyMotionProvenance: null
      })).toThrow(/H2 requires explicit A0 body-motion provenance/i);
    } finally {
      world.dispose();
    }
  });

  it("keeps duplicate or misaligned futures from entering an intervention plan", async () => {
    const world = await LabWorld.create("open");
    try {
      const futures = buildFutures(world, world.snapshot(), playerIntent(1, 0), 0.5);
      const duplicate = {
        ...futures,
        hypotheses: [futures.hypotheses[0]!, {
          ...futures.hypotheses[1]!,
          id: futures.hypotheses[0]!.id
        }]
      };
      expect(() => buildA1PlayerFutureInterventionPlan(duplicate)).toThrow(/duplicate player-future id/i);

      const misaligned = {
        ...futures,
        hypotheses: [{
          ...futures.hypotheses[0]!,
          sourceTick: futures.sourceTick + 1
        }, ...futures.hypotheses.slice(1)]
      };
      expect(() => buildA1PlayerFutureInterventionPlan(misaligned)).toThrow(/source tick is misaligned/i);
    } finally {
      world.dispose();
    }
  });
});
