import { describe, expect, it } from "vitest";
import {
  buildA1ConcreteCommandProposalSet,
  type A1ConcreteCommandProposal
} from "./a1-concrete-command-proposals";
import {
  buildA1FixedCommandCrossFutureProfile,
  type A1FixedCommandFutureRehearsed
} from "./a1-fixed-command-cross-future-profile";
import { compareA1G4ConcreteCommands } from "./a1-g4-concrete-command-comparison";
import { compareA1G4CooperationCandidates } from "./a1-g4-cooperation-preference";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function buildDecision(input: {
  world: LabWorld;
  playerMove: Vec2;
  snapshot?: WorldSnapshot;
  horizonSeconds?: number;
  localAlternativeDeltaSpeed?: number;
}) {
  const snapshot = input.snapshot ?? input.world.snapshot();
  const horizonSeconds = input.horizonSeconds ?? 0.5;
  const situation = buildA1Situation({
    snapshot,
    playerIntent: playerIntent(input.playerMove.x, input.playerMove.y),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0 ? null : input.world.latestAuthorityA0StepEvidence()
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventionPlan = buildA1PlayerFutureInterventionPlan(futures);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation,
    interventionPlan,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed ?? 1
  });
  return { situation, interventionPlan, proposalSet };
}

function h1Entry(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
  proposal: A1ConcreteCommandProposal;
}): A1FixedCommandFutureRehearsed {
  const profile = buildA1FixedCommandCrossFutureProfile({
    world: input.world,
    situation: input.decision.situation,
    interventionPlan: input.decision.interventionPlan,
    proposal: input.proposal
  });
  const entry = profile.entries.find(
    (candidate) => candidate.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (!entry || entry.status !== "REHEARSED") {
    throw new Error(`expected rehearsed H1 entry for ${input.proposal.proposalId}`);
  }
  return entry;
}

function proposalByOrigin(input: {
  decision: ReturnType<typeof buildDecision>;
  futureFamily: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD";
  seedFamily: string;
}): A1ConcreteCommandProposal {
  const result = input.decision.proposalSet.proposals.find((proposal) =>
    proposal.generationOrigins.some((origin) =>
      origin.futureFamily === input.futureFamily && origin.seedFamily === input.seedFamily
    )
  );
  if (!result) {
    throw new Error(`missing ${input.futureFamily}/${input.seedFamily} concrete proposal`);
  }
  return result;
}

function commandDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sameProvenanceDifferentCommandPair(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
}): [A1FixedCommandFutureRehearsed, A1FixedCommandFutureRehearsed] {
  const entries = input.decision.proposalSet.proposals
    .map((proposal) => h1Entry({ world: input.world, decision: input.decision, proposal }))
    .filter((entry) => entry.g3.decision === "PASS" || entry.g3.decision === "REQUIRE_G4");

  for (let aIndex = 0; aIndex < entries.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < entries.length; bIndex += 1) {
      const a = entries[aIndex]!;
      const b = entries[bIndex]!;
      if (
        a.g3.companionCandidateId === b.g3.companionCandidateId &&
        a.proposalId !== b.proposalId &&
        commandDistance(a.commandVelocity, b.commandVelocity) > 1e-9
      ) {
        return [a, b];
      }
    }
  }
  throw new Error("expected two distinct concrete commands with the same legacy candidate provenance id");
}

describe("Authority-A1.2r0 concrete-command identity bridge for G4", () => {
  it("compares two distinct A1.2o commands even when they share the same legacy candidate provenance id", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({
        world,
        playerMove: { x: -1, y: 0 },
        snapshot: after
      });
      const [a, b] = sameProvenanceDifferentCommandPair({ world, decision });

      expect(a.proposalId).not.toBe(b.proposalId);
      expect(commandDistance(a.commandVelocity, b.commandVelocity)).toBeGreaterThan(1e-9);
      expect(a.g3.companionCandidateId).toBe(b.g3.companionCandidateId);
      expect(a.playerAgency.companionCandidateId).toBe(b.playerAgency.companionCandidateId);

      expect(() => compareA1G4CooperationCandidates({
        candidateA: {
          candidateId: a.g3.companionCandidateId,
          g3: a.g3,
          agency: a.playerAgency
        },
        candidateB: {
          candidateId: b.g3.companionCandidateId,
          g3: b.g3,
          agency: b.playerAgency
        }
      })).toThrow(/two distinct comparison action ids|two distinct candidate ids/i);

      const comparison = compareA1G4ConcreteCommands({ commandA: a, commandB: b });
      expect(comparison.proposalAId).toBe(a.proposalId);
      expect(comparison.proposalBId).toBe(b.proposalId);
      expect(comparison.sameCandidateProvenanceId).toBe(true);
      expect(comparison.candidateAProvenanceId).toBe(comparison.candidateBProvenanceId);
      expect(comparison.actionIdentityClaim).toBe("A1_2O_PROPOSAL_ID_EXECUTABLE_COMMAND_IDENTITY");
      expect(comparison.candidateIdClaim)
        .toBe("A1_2L_M_CANDIDATE_ID_PROVENANCE_ONLY_NOT_ACTION_ID_A1_2R0");
      expect(comparison.graphAggregationClaim).toBe("NONE_PAIRWISE_COMPARISON_ONLY_A1_2R0");
      expect(comparison.selectionClaim).toBe("NONE_PAIRWISE_RELATION_ONLY_A1_2R0");
      expect(comparison.runtimeAuthorityClaim).toBe("NONE_A1_2R0");
    } finally {
      world.dispose();
    }
  });

  it("maps the qualified head-on G4 preference onto proposal identity instead of candidate-family identity", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        localAlternativeDeltaSpeed: 3
      });
      const pressureProposal = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_RADIAL_INWARD"
      });
      const tangentProposal = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_TANGENT_POSITIVE"
      });
      const pressure = h1Entry({ world, decision, proposal: pressureProposal });
      const tangent = h1Entry({ world, decision, proposal: tangentProposal });

      expect(pressure.g3.decision).toBe("REQUIRE_G4");
      expect(tangent.g3.decision).toBe("PASS");

      const forward = compareA1G4ConcreteCommands({ commandA: pressure, commandB: tangent });
      const reversed = compareA1G4ConcreteCommands({ commandA: tangent, commandB: pressure });

      expect(forward.decision).toBe("PREFER_B");
      expect(reversed.decision).toBe("PREFER_A");
      expect(forward.preferredProposalId).toBe(tangent.proposalId);
      expect(reversed.preferredProposalId).toBe(tangent.proposalId);
      expect(forward.policy.preferredCandidateId).toBe(tangent.g3.companionCandidateId);
      expect(forward.preferredProposalId).not.toBe(forward.policy.preferredCandidateId);
    } finally {
      world.dispose();
    }
  });

  it("rejects same proposal identity and forged duplicate executable command identity", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const proposals = decision.proposalSet.proposals;
      if (proposals.length < 2) throw new Error("expected at least two concrete proposals");
      const a = h1Entry({ world, decision, proposal: proposals[0]! });
      const b = h1Entry({ world, decision, proposal: proposals[1]! });

      expect(() => compareA1G4ConcreteCommands({ commandA: a, commandB: a }))
        .toThrow(/two distinct A1\.2o proposal ids/i);

      const forgedB: A1FixedCommandFutureRehearsed = {
        ...b,
        commandVelocity: { ...a.commandVelocity },
        rehearsal: {
          ...b.rehearsal,
          companionCommandVelocity: { ...a.commandVelocity }
        },
        playerAgency: {
          ...b.playerAgency,
          companionCommandVelocity: { ...a.commandVelocity }
        }
      };
      expect(() => compareA1G4ConcreteCommands({ commandA: a, commandB: forgedB }))
        .toThrow(/dedup identity is violated/i);
    } finally {
      world.dispose();
    }
  });

  it("preserves the same-player-future causal boundary and does not mutate the live World", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const proposals = decision.proposalSet.proposals.filter((proposal) =>
        Math.hypot(proposal.commandVelocity.x, proposal.commandVelocity.y) > 1e-9
      );
      if (proposals.length < 2) throw new Error("expected at least two nonzero concrete proposals");

      const profileA = buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal: proposals[0]!
      });
      const profileB = buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal: proposals[1]!
      });
      const h1 = profileA.entries.find((entry) => entry.futureFamily === "OWNER_REQUEST_CONTINUATION");
      const h2 = profileB.entries.find((entry) => entry.futureFamily === "BODY_RESPONSE_CONTINUATION");
      if (h1?.status !== "REHEARSED" || h2?.status !== "REHEARSED") {
        throw new Error("expected rehearsed H1/H2 entries for causal-boundary falsifier");
      }
      const before = world.snapshot();

      expect(() => compareA1G4ConcreteCommands({ commandA: h1, commandB: h2 }))
        .toThrow(/same player-future id|same player-future family|same rehearsed player velocity/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });
});
