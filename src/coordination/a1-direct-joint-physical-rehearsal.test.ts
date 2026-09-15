import { describe, expect, it } from "vitest";
import {
  realizeA1DirectCandidate,
  type A1CompanionCandidateSeed,
  type A1DirectCandidateRealization
} from "./a1-companion-candidates";
import { qualifyA1DirectCandidateStatic } from "./a1-direct-static-qualification";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { evaluateA1DirectJointFutureMatrix } from "./a1-direct-joint-future-matrix";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2 } from "../world/types";

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

function noOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "A1.2j qualification-donor comparison"
  };
}

function buildSituation(
  world: LabWorld,
  snapshot: ReturnType<LabWorld["snapshot"]>,
  intent: MotionIntent
): A1Situation {
  return buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0 ? null : world.latestAuthorityA0StepEvidence()
  });
}

function buildFutures(
  world: LabWorld,
  situation: A1Situation,
  horizonSeconds: number
) {
  return buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

function interventionFor(
  world: LabWorld,
  situation: A1Situation,
  horizonSeconds: number,
  family: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD"
) {
  const plan = buildA1PlayerFutureInterventionPlan(buildFutures(world, situation, horizonSeconds));
  const intervention = plan.interventions.find((value) => value.futureFamily === family);
  if (!intervention) throw new Error(`missing ${family}`);
  return intervention;
}

function directRealization(
  world: LabWorld,
  tick: number,
  horizonSeconds: number,
  velocity: Vec2,
  family: A1CompanionCandidateSeed["family"] = "PLAYER_FEED_FORWARD"
): A1DirectCandidateRealization {
  return realizeA1DirectCandidate({
    candidate: {
      id: `a1-2j-${family.toLowerCase()}`,
      family,
      sourceTick: tick,
      desiredVelocity: velocity,
      localBasisSource: "NONE"
    },
    capability: world.actorMovementCapability("companion"),
    horizonSeconds
  });
}

function oldMatrix(
  world: LabWorld,
  situation: A1Situation,
  realization: A1DirectCandidateRealization
) {
  return evaluateA1DirectJointFutureMatrix({
    situation,
    realization,
    playerFutures: buildFutures(world, situation, realization.horizonSeconds),
    orientation: noOrientation(situation.tick),
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

function newQualification(
  world: LabWorld,
  situation: A1Situation,
  realization: A1DirectCandidateRealization
) {
  return qualifyA1DirectCandidateStatic({
    situation,
    realization,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

describe("Authority-A1.2j DIRECT joint same-physics rehearsal", () => {
  it("preserves qualified A1.2d G0-G2 pass/fail semantics without importing its utility rows", async () => {
    const open = await LabWorld.create("open");
    const pillar = await LabWorld.create("pillar");
    try {
      const openSituation = buildSituation(open, open.snapshot(), playerIntent(1, 0));
      const openRealization = directRealization(open, 0, 0.5, { x: 3, y: 0 });
      const oldOpen = oldMatrix(open, openSituation, openRealization);
      const qualifiedOpen = newQualification(open, openSituation, openRealization);
      expect(qualifiedOpen.g0.status).toBe(oldOpen.g0.status);
      expect(qualifiedOpen.g1.status).toBe(oldOpen.g1.status);
      expect(qualifiedOpen.g2.status).toBe(oldOpen.g2.status);
      expect(qualifiedOpen.g2.status).toBe("PASS_STATIC_HARD_LEGALITY");
      expect(qualifiedOpen.utilityClaim).toBe("NONE_QUALIFICATION_ONLY_A1_2J");

      const pillarSituation = buildSituation(pillar, pillar.snapshot(), playerIntent(0, 0));
      const pillarRealization = directRealization(pillar, 0, 1.5, { x: -3, y: 0 });
      const oldPillar = oldMatrix(pillar, pillarSituation, pillarRealization);
      const qualifiedPillar = newQualification(pillar, pillarSituation, pillarRealization);
      expect(qualifiedPillar.g0.status).toBe(oldPillar.g0.status);
      expect(qualifiedPillar.g1.status).toBe(oldPillar.g1.status);
      expect(qualifiedPillar.g2.status).toBe(oldPillar.g2.status);
      expect(qualifiedPillar.g2.status).toBe("FAIL_STATIC_HARD_LEGALITY");
      if (qualifiedPillar.g2.status !== "FAIL_STATIC_HARD_LEGALITY") {
        throw new Error("expected pillar G2 failure");
      }
      expect(qualifiedPillar.g2.blockerLabel).toBe("pillar.center");
    } finally {
      open.dispose();
      pillar.dispose();
    }
  });

  it("runs one H1 and one G1/G2-qualified DIRECT command in one clone without changing live World", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(1, 0));
      const h1 = interventionFor(world, situation, 0.5, "OWNER_REQUEST_CONTINUATION");
      const realization = directRealization(world, situation.tick, 0.5, { x: 3, y: 0 });

      const result = rehearseA1DirectJointPhysicalFuture({
        world,
        situation,
        playerIntervention: h1,
        companionRealization: realization
      });

      expect(result.worldStepCount).toBe(30);
      expect(result.qualification.g2.status).toBe("PASS_STATIC_HARD_LEGALITY");
      expect(result.physical.frames).toHaveLength(30);
      expect(result.physicalEvidenceClaim).toBe("JOINT_SAME_PHYSICS_TRAJECTORY_AND_CONTACT_FRAMES_A1_2J");
      expect(result.oldMatrixUtilityUsage).toBe("NONE_A1_2J");
      expect(result.g3SafetyClaim).toBe("NONE_A1_2J_TRAJECTORY_EVIDENCE_ONLY");
      expect(result.cooperationClaim).toBe("NONE_A1_2J");
      expect(result.selectionClaim).toBe("NONE_A1_2J");

      const initialPlayer = actor(before.actors, "player");
      const initialCompanion = actor(before.actors, "companion");
      const final = result.physical.frames.at(-1)!;
      const finalPlayer = actor(final.actors, "player");
      const finalCompanion = actor(final.actors, "companion");
      const initialRelative = {
        x: initialCompanion.position.x - initialPlayer.position.x,
        y: initialCompanion.position.y - initialPlayer.position.y
      };
      const finalRelative = {
        x: finalCompanion.position.x - finalPlayer.position.x,
        y: finalCompanion.position.y - finalPlayer.position.y
      };
      expect(finalRelative.x).toBeCloseTo(initialRelative.x, 9);
      expect(finalRelative.y).toBeCloseTo(initialRelative.y, 9);
      expect(world.snapshot()).toEqual(before);
      expect(world.latestAuthorityA0StepEvidence()).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("publishes reciprocal dynamic contact when player and companion futures meet head-on", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(1, 0));
      const h1 = interventionFor(world, situation, 0.75, "OWNER_REQUEST_CONTINUATION");
      const realization = directRealization(world, situation.tick, 0.75, { x: -3, y: 0 });

      const result = rehearseA1DirectJointPhysicalFuture({
        world,
        situation,
        playerIntervention: h1,
        companionRealization: realization
      });
      expect(result.worldStepCount).toBe(45);
      expect(result.qualification.g2.status).toBe("PASS_STATIC_HARD_LEGALITY");

      const contactFrame = result.physical.frames.find((frame) =>
        actor(frame.actors, "player").contacts.some((contact) => contact.with === "companion") &&
        actor(frame.actors, "companion").contacts.some((contact) => contact.with === "player")
      );
      expect(contactFrame).toBeDefined();
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("refuses G2-illegal companion commands before same-physics contact response can make them look executable", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(0, 0));
      const h1 = interventionFor(world, situation, 1.5, "OWNER_REQUEST_CONTINUATION");
      const realization = directRealization(world, situation.tick, 1.5, { x: -3, y: 0 });
      const qualification = newQualification(world, situation, realization);
      expect(qualification.g2.status).toBe("FAIL_STATIC_HARD_LEGALITY");

      expect(() => rehearseA1DirectJointPhysicalFuture({
        world,
        situation,
        playerIntervention: h1,
        companionRealization: realization
      })).toThrow(/G2 static hard legality failed.*pillar\.center/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("refuses unresolved player evidence instead of silently substituting H1 or H3", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(1, 0));
      const h2 = interventionFor(world, situation, 0.5, "BODY_RESPONSE_CONTINUATION");
      expect(h2.status).toBe("UNRESOLVED");
      const realization = directRealization(world, situation.tick, 0.5, { x: 3, y: 0 });

      expect(() => rehearseA1DirectJointPhysicalFuture({
        world,
        situation,
        playerIntervention: h2,
        companionRealization: realization
      })).toThrow(/refuses unresolved player future/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("requires the A1 situation to match current live body positions, not only the tick number", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(1, 0));
      const h1 = interventionFor(world, situation, 0.5, "OWNER_REQUEST_CONTINUATION");
      const realization = directRealization(world, situation.tick, 0.5, { x: 3, y: 0 });
      const forgedSituation: A1Situation = {
        ...situation,
        situated: {
          ...situation.situated,
          companionBody: {
            ...situation.situated.companionBody,
            position: {
              x: situation.situated.companionBody.position.x + 0.5,
              y: situation.situated.companionBody.position.y
            }
          }
        }
      };

      expect(() => rehearseA1DirectJointPhysicalFuture({
        world,
        situation: forgedSituation,
        playerIntervention: h1,
        companionRealization: realization
      })).toThrow(/companion situated position does not match current live World state/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("rejects mismatched player/companion horizons before creating a joint trajectory", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(1, 0));
      const h1 = interventionFor(world, situation, 0.5, "OWNER_REQUEST_CONTINUATION");
      const realization = directRealization(world, situation.tick, 0.25, { x: 3, y: 0 });

      expect(() => rehearseA1DirectJointPhysicalFuture({
        world,
        situation,
        playerIntervention: h1,
        companionRealization: realization
      })).toThrow(/player and companion rehearsal horizons must match exactly/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("rejects stale joint evidence after live World advances", async () => {
    const world = await LabWorld.create("open");
    try {
      const initial = world.snapshot();
      const situation = buildSituation(world, initial, playerIntent(1, 0));
      const h1 = interventionFor(world, situation, 0.5, "OWNER_REQUEST_CONTINUATION");
      const realization = directRealization(world, situation.tick, 0.5, { x: 3, y: 0 });
      world.step([playerIntent(1, 0), companionHold()]);
      const advanced = world.snapshot();

      expect(() => rehearseA1DirectJointPhysicalFuture({
        world,
        situation,
        playerIntervention: h1,
        companionRealization: realization
      })).toThrow(/situation tick 0 does not equal live World tick 1/i);
      expect(world.snapshot()).toEqual(advanced);
    } finally {
      world.dispose();
    }
  });
});
