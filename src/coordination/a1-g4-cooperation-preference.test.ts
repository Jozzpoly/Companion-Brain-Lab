import { describe, expect, it } from "vitest";
import {
  buildA1CompanionCandidateSet,
  realizeA1DirectCandidate,
  type A1CompanionCandidateFamily,
  type A1CompanionCandidateSeed
} from "./a1-companion-candidates";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import {
  compareA1G4CooperationCandidates,
  type A1G4CandidateEvidence
} from "./a1-g4-cooperation-preference";
import { evaluateA1G3JointTracePolicy } from "./a1-g3-joint-trace-policy";
import { buildA1JointHardBodyTrace } from "./a1-joint-hard-body-trace";
import { buildA1PlayerAgencyTrajectoryEvidence } from "./a1-player-agency-trajectory";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import {
  buildA1PlayerFutureInterventionPlan,
  type A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function actor(world: LabWorld, id: "player" | "companion"): ActorSnapshot {
  const value = world.snapshot().actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function seedByFamily(
  seeds: readonly A1CompanionCandidateSeed[],
  family: A1CompanionCandidateFamily
): A1CompanionCandidateSeed {
  const result = seeds.find((candidate) => candidate.family === family);
  if (!result) throw new Error(`missing generated candidate ${family}`);
  return result;
}

function setup(input: {
  world: LabWorld;
  playerMove: Vec2;
  horizonSeconds: number;
  deltaSpeed: number;
}) {
  const snapshot = input.world.snapshot();
  const intent = playerIntent(input.playerMove.x, input.playerMove.y);
  const situation = buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: null
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds: input.horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const plan = buildA1PlayerFutureInterventionPlan(futures);
  const h1 = plan.interventions.find(
    (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (!h1 || h1.status !== "REHEARSABLE") {
    throw new Error("A1.2n requires rehearsable generated H1 evidence");
  }

  const player = actor(input.world, "player");
  const companion = actor(input.world, "companion");
  const candidates = buildA1CompanionCandidateSet({
    tick: situation.tick,
    companionCurrentVelocity: {
      id: "a1-2n-current-companion",
      sourceTick: situation.tick,
      velocity: companion.actualVelocity
    },
    playerFuture: {
      id: h1.futureId,
      sourceTick: situation.tick,
      velocity: h1.repeatedVelocity
    },
    currentRelativeOffset: subtract(companion.position, player.position),
    capability: input.world.actorMovementCapability("companion"),
    localAlternativeDeltaSpeed: input.deltaSpeed
  });

  return { situation, h1, candidates };
}

function candidateEvidence(input: {
  world: LabWorld;
  situation: ReturnType<typeof buildA1Situation>;
  h1: A1RehearsablePlayerFutureIntervention;
  seed: A1CompanionCandidateSeed;
  horizonSeconds: number;
}): A1G4CandidateEvidence {
  const realization = realizeA1DirectCandidate({
    candidate: input.seed,
    capability: input.world.actorMovementCapability("companion"),
    horizonSeconds: input.horizonSeconds
  });
  const rehearsal = rehearseA1DirectJointPhysicalFuture({
    world: input.world,
    situation: input.situation,
    playerIntervention: input.h1,
    companionRealization: realization
  });
  const trace = buildA1JointHardBodyTrace({
    situation: input.situation,
    rehearsal
  });
  const g3 = evaluateA1G3JointTracePolicy(trace);
  const agency = buildA1PlayerAgencyTrajectoryEvidence({ rehearsal, trace });
  return {
    candidateId: realization.candidateId,
    g3,
    agency
  };
}

function generatedPair(input: {
  world: LabWorld;
  playerMove: Vec2;
  horizonSeconds: number;
  deltaSpeed: number;
  familyA: A1CompanionCandidateFamily;
  familyB: A1CompanionCandidateFamily;
}) {
  const setupResult = setup(input);
  const a = candidateEvidence({
    world: input.world,
    situation: setupResult.situation,
    h1: setupResult.h1,
    seed: seedByFamily(setupResult.candidates.seeds, input.familyA),
    horizonSeconds: input.horizonSeconds
  });
  const b = candidateEvidence({
    world: input.world,
    situation: setupResult.situation,
    h1: setupResult.h1,
    seed: seedByFamily(setupResult.candidates.seeds, input.familyB),
    horizonSeconds: input.horizonSeconds
  });
  return { a, b };
}

describe("Authority-A1.2n bounded asymmetric G4 cooperation preference", () => {
  it("prefers a generated clear tangent future over a generated head-on pressure future under the same Owner H1", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const before = world.snapshot();
      const { a: pressure, b: tangent } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        deltaSpeed: 3,
        familyA: "RELATIVE_RADIAL_INWARD",
        familyB: "RELATIVE_TANGENT_POSITIVE"
      });

      expect(pressure.g3.decision).toBe("REQUIRE_G4");
      expect(pressure.g3.status).toBe("REQUIRE_G4_NEW_RECIPROCAL_CONTACT");
      expect(pressure.agency.reciprocalContactFrameCount).toBeGreaterThan(0);
      expect(tangent.g3.decision).toBe("PASS");
      expect(tangent.g3.status).toBe("PASS_CLEAR");
      expect(tangent.agency.contactFrameCount).toBe(0);

      const result = compareA1G4CooperationCandidates({
        candidateA: pressure,
        candidateB: tangent
      });

      expect(result.status).toBe("YIELD_PREFERRED_OVER_NEW_CONTACT");
      expect(result.decision).toBe("PREFER_B");
      expect(result.preferredCandidateId).toBe(tangent.candidateId);
      expect(result.playerCausalMeaning).toBe("OWNER_REQUEST_PERSISTS_COUNTERFACTUAL");
      expect(result.candidateFamilySemanticsClaim).toBe("NONE_OUTCOME_EVIDENCE_ONLY_A1_2N");
      expect(result.comfortEnvelopeClaim).toBe("NONE_A1_2N");
      expect(result.globalSelectionClaim).toBe("NONE_PAIRWISE_COOPERATION_ONLY_A1_2N");
      expect(result.runtimeAuthorityClaim).toBe("NONE_A1_2N");
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("does not demand gratuitous yielding when two generated same-player futures both remain G3-clear", async () => {
    const world = await LabWorld.create("open");
    try {
      const { a: feedForward, b: tangent } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 0.5,
        deltaSpeed: 1,
        familyA: "PLAYER_FEED_FORWARD",
        familyB: "RELATIVE_TANGENT_POSITIVE"
      });

      expect(feedForward.g3.decision).toBe("PASS");
      expect(tangent.g3.decision).toBe("PASS");
      const result = compareA1G4CooperationCandidates({
        candidateA: feedForward,
        candidateB: tangent
      });

      expect(result.status).toBe("NO_COOPERATION_PREFERENCE_BOTH_G3_PASS");
      expect(result.decision).toBe("NO_PREFERENCE");
      expect(result.preferredCandidateId).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("respects stationary player occupancy without inventing a flow lane", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const { a: inward, b: outward } = generatedPair({
        world,
        playerMove: { x: 0, y: 0 },
        horizonSeconds: 1,
        deltaSpeed: 3,
        familyA: "RELATIVE_RADIAL_INWARD",
        familyB: "RELATIVE_RADIAL_OUTWARD"
      });

      expect(inward.agency.flowBasisState).toBe("FLOW_BASIS_UNAVAILABLE_STATIONARY");
      expect(outward.agency.flowBasisState).toBe("FLOW_BASIS_UNAVAILABLE_STATIONARY");
      expect(inward.g3.decision).toBe("REQUIRE_G4");
      expect(outward.g3.decision).toBe("PASS");

      const result = compareA1G4CooperationCandidates({
        candidateA: inward,
        candidateB: outward
      });
      expect(result.decision).toBe("PREFER_B");
      expect(result.preferredCandidateId).toBe(outward.candidateId);
      expect(result.playerFlowBasisState).toBe("FLOW_BASIS_UNAVAILABLE_STATIONARY");
    } finally {
      world.dispose();
    }
  });

  it("reports forced contention when two distinct generated candidates both create new reciprocal contact", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const { a: hold, b: inward } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        deltaSpeed: 3,
        familyA: "HOLD",
        familyB: "RELATIVE_RADIAL_INWARD"
      });

      expect(hold.g3.decision).toBe("REQUIRE_G4");
      expect(inward.g3.decision).toBe("REQUIRE_G4");
      const result = compareA1G4CooperationCandidates({
        candidateA: hold,
        candidateB: inward
      });
      expect(result.status).toBe("FORCED_CONTENTION_NO_G3_PASS_ALTERNATIVE");
      expect(result.decision).toBe("FORCED_CONTENTION");
      expect(result.preferredCandidateId).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("reverses A/B preference when the exact same generated futures are presented in reverse order", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const { a: pressure, b: tangent } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        deltaSpeed: 3,
        familyA: "RELATIVE_RADIAL_INWARD",
        familyB: "RELATIVE_TANGENT_NEGATIVE"
      });
      const forward = compareA1G4CooperationCandidates({
        candidateA: pressure,
        candidateB: tangent
      });
      const reversed = compareA1G4CooperationCandidates({
        candidateA: tangent,
        candidateB: pressure
      });

      expect(forward.decision).toBe("PREFER_B");
      expect(reversed.decision).toBe("PREFER_A");
      expect(forward.preferredCandidateId).toBe(tangent.candidateId);
      expect(reversed.preferredCandidateId).toBe(tangent.candidateId);
    } finally {
      world.dispose();
    }
  });

  it("does not change preference when candidate family labels are swapped while physical and causal evidence stays identical", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const { a: pressure, b: tangent } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        deltaSpeed: 3,
        familyA: "RELATIVE_RADIAL_INWARD",
        familyB: "RELATIVE_TANGENT_POSITIVE"
      });
      const baseline = compareA1G4CooperationCandidates({ candidateA: pressure, candidateB: tangent });
      const swappedLabelsA: A1G4CandidateEvidence = {
        ...pressure,
        agency: {
          ...pressure.agency,
          companionCandidateFamily: tangent.agency.companionCandidateFamily
        }
      };
      const swappedLabelsB: A1G4CandidateEvidence = {
        ...tangent,
        agency: {
          ...tangent.agency,
          companionCandidateFamily: pressure.agency.companionCandidateFamily
        }
      };
      const swapped = compareA1G4CooperationCandidates({
        candidateA: swappedLabelsA,
        candidateB: swappedLabelsB
      });

      expect(swapped.decision).toBe(baseline.decision);
      expect(swapped.preferredCandidateId).toBe(baseline.preferredCandidateId);
      expect(swapped.status).toBe(baseline.status);
    } finally {
      world.dispose();
    }
  });

  it("rejects comparison across different player-future identities even when each candidate is internally aligned", async () => {
    const world = await LabWorld.create("open");
    try {
      const { a, b } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 0.5,
        deltaSpeed: 1,
        familyA: "PLAYER_FEED_FORWARD",
        familyB: "RELATIVE_TANGENT_POSITIVE"
      });
      const forgedB: A1G4CandidateEvidence = {
        ...b,
        agency: { ...b.agency, playerFutureId: `${b.agency.playerFutureId}-other` },
        g3: { ...b.g3, playerFutureId: `${b.g3.playerFutureId}-other` }
      };

      expect(() => compareA1G4CooperationCandidates({ candidateA: a, candidateB: forgedB }))
        .toThrow(/same player-future id/i);
    } finally {
      world.dispose();
    }
  });

  it("refuses to reinterpret a G3 HOLD/FAIL/UNRESOLVED candidate as a cooperation-comparable future", async () => {
    const world = await LabWorld.create("open");
    try {
      const { a, b } = generatedPair({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 0.5,
        deltaSpeed: 1,
        familyA: "PLAYER_FEED_FORWARD",
        familyB: "RELATIVE_TANGENT_POSITIVE"
      });
      const blockedA: A1G4CandidateEvidence = {
        ...a,
        g3: {
          ...a.g3,
          decision: "HOLD",
          status: "HOLD_PREEXISTING_CONTACT_NOT_EGRESSING"
        }
      };

      expect(() => compareA1G4CooperationCandidates({ candidateA: blockedA, candidateB: b }))
        .toThrow(/upstream G3 decision HOLD is not cooperation-comparable/i);
    } finally {
      world.dispose();
    }
  });
});
