import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
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

function zeroProposal(decision: ReturnType<typeof buildDecision>) {
  const proposal = decision.proposalSet.proposals.find(
    (candidate) => Math.hypot(candidate.commandVelocity.x, candidate.commandVelocity.y) <= 1e-9
  );
  if (!proposal) throw new Error("expected a zero concrete command proposal");
  return proposal;
}

function proposalFromFuture(input: {
  decision: ReturnType<typeof buildDecision>;
  futureFamily: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD";
  seedFamily?: string;
}) {
  const proposal = input.decision.proposalSet.proposals.find((candidate) =>
    candidate.generationOrigins.some((origin) =>
      origin.futureFamily === input.futureFamily &&
      (input.seedFamily === undefined || origin.seedFamily === input.seedFamily)
    ) &&
    candidate.generationOrigins.every((origin) => origin.futureFamily === input.futureFamily)
  );
  if (!proposal) throw new Error(`expected a future-specific proposal for ${input.futureFamily}`);
  return proposal;
}

function entry(profile: ReturnType<typeof buildA1FixedCommandCrossFutureProfile>, family: string) {
  const value = profile.entries.find((candidate) => candidate.futureFamily === family);
  if (!value) throw new Error(`missing profile entry for ${family}`);
  return value;
}

describe("Authority-A1.2p fixed-command cross-future physical profile", () => {
  it("preserves REHEARSED, UNRESOLVED and ABSENT as distinct player-future states without mutating live World", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const before = world.snapshot();
      const profile = buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal: zeroProposal(decision)
      });

      expect(profile.rehearsedCount).toBe(1);
      expect(profile.unresolvedCount).toBe(1);
      expect(profile.absentCount).toBe(1);
      expect(profile.upstreamRejectedCount).toBe(0);
      expect(entry(profile, "OWNER_REQUEST_CONTINUATION").status).toBe("REHEARSED");

      const h2 = entry(profile, "BODY_RESPONSE_CONTINUATION");
      expect(h2.status).toBe("UNRESOLVED");
      if (h2.status !== "UNRESOLVED") throw new Error("expected unresolved H2");
      expect(h2.unresolvedReason).toBe("H2_STATIONARY_IS_OBSERVATION_NOT_QUALIFIED_CONTROL");
      expect("rehearsal" in h2).toBe(false);

      const h3 = entry(profile, "TRANSITION_HOLD");
      expect(h3.status).toBe("ABSENT");
      expect("rehearsal" in h3).toBe(false);
      expect(world.snapshot()).toEqual(before);
      expect(profile.selectionClaim).toBe("NONE_A1_2P");
      expect(profile.runtimeAuthorityClaim).toBe("NONE_A1_2P");
    } finally {
      world.dispose();
    }
  });

  it("reuses one actually future-specific concrete command unchanged under both rehearsable H1 and H2", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 }, snapshot: after });
      const h1Intervention = decision.interventionPlan.interventions.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      const h2Intervention = decision.interventionPlan.interventions.find(
        (value) => value.futureFamily === "BODY_RESPONSE_CONTINUATION"
      );
      expect(h1Intervention?.status).toBe("REHEARSABLE");
      expect(h2Intervention?.status).toBe("REHEARSABLE");
      if (h1Intervention?.status !== "REHEARSABLE" || h2Intervention?.status !== "REHEARSABLE") {
        throw new Error("expected rehearsable H1/H2");
      }
      expect(h1Intervention.repeatedVelocity).not.toEqual(h2Intervention.repeatedVelocity);

      const proposal = decision.proposalSet.proposals.find((candidate) => {
        const futures = new Set(candidate.generationOrigins.map((origin) => origin.futureFamily));
        return futures.size === 1 &&
          (futures.has("OWNER_REQUEST_CONTINUATION") || futures.has("BODY_RESPONSE_CONTINUATION"));
      });
      if (!proposal) throw new Error("expected at least one actually future-specific H1/H2 concrete command");
      const originFutureFamily = proposal.generationOrigins[0]?.futureFamily;
      if (
        originFutureFamily !== "OWNER_REQUEST_CONTINUATION" &&
        originFutureFamily !== "BODY_RESPONSE_CONTINUATION"
      ) {
        throw new Error("future-specific command did not originate from H1/H2");
      }
      expect(proposal.generationOrigins.every((origin) => origin.futureFamily === originFutureFamily)).toBe(true);
      const otherFutureFamily = originFutureFamily === "OWNER_REQUEST_CONTINUATION"
        ? "BODY_RESPONSE_CONTINUATION"
        : "OWNER_REQUEST_CONTINUATION";
      expect(proposal.generationOrigins.some((origin) => origin.futureFamily === otherFutureFamily)).toBe(false);

      const profile = buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal
      });
      const h1 = entry(profile, "OWNER_REQUEST_CONTINUATION");
      const h2 = entry(profile, "BODY_RESPONSE_CONTINUATION");
      expect(h1.status).toBe("REHEARSED");
      expect(h2.status).toBe("REHEARSED");
      if (h1.status !== "REHEARSED" || h2.status !== "REHEARSED") {
        throw new Error("expected rehearsed H1/H2");
      }

      expect(h1.playerVelocity).not.toEqual(h2.playerVelocity);
      expect(h1.rehearsal.companionCommandVelocity).toEqual(proposal.commandVelocity);
      expect(h2.rehearsal.companionCommandVelocity).toEqual(proposal.commandVelocity);
      expect(h1.playerAgency.companionCommandVelocity).toEqual(proposal.commandVelocity);
      expect(h2.playerAgency.companionCommandVelocity).toEqual(proposal.commandVelocity);
      expect(profile.regenerationClaim).toBe("NONE_A1_2P_REUSE_A1_2O_CANONICAL_REALIZATION");
    } finally {
      world.dispose();
    }
  });

  it("rehearses the same nonzero command under reversal H1, body-response H2 and zero-velocity H3", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const proposal = proposalFromFuture({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "PLAYER_FEED_FORWARD"
      });
      expect(Math.hypot(proposal.commandVelocity.x, proposal.commandVelocity.y)).toBeGreaterThan(0);
      const before = world.snapshot();

      const profile = buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal
      });
      expect(profile.rehearsedCount).toBe(3);
      expect(profile.unresolvedCount).toBe(0);
      expect(profile.absentCount).toBe(0);

      for (const value of profile.entries) {
        expect(value.status).toBe("REHEARSED");
        if (value.status !== "REHEARSED") throw new Error("expected all reversal futures rehearsed");
        expect(value.rehearsal.companionCommandVelocity).toEqual(proposal.commandVelocity);
        expect(value.playerAgency.companionCommandVelocity).toEqual(proposal.commandVelocity);
      }

      const h3 = entry(profile, "TRANSITION_HOLD");
      if (h3.status !== "REHEARSED") throw new Error("expected rehearsed H3");
      expect(h3.playerVelocity).toEqual({ x: 0, y: 0 });
      expect(h3.rehearsal.companionCommandVelocity).toEqual(proposal.commandVelocity);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("preserves the fixed proposal identity through j/k/l/m instead of borrowing per-future generation provenance", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        localAlternativeDeltaSpeed: 3
      });
      const proposal = proposalFromFuture({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_TANGENT_POSITIVE"
      });
      const profile = buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal
      });

      for (const value of profile.entries) {
        if (value.status !== "REHEARSED") continue;
        expect(value.proposalId).toBe(proposal.proposalId);
        expect(value.commandVelocity).toEqual(proposal.commandVelocity);
        expect(value.rehearsal.companionCandidateId).toBe(proposal.canonicalRealization.candidateId);
        expect(value.rehearsal.companionCandidateFamily).toBe(proposal.canonicalRealization.family);
        expect(value.hardBodyTrace.companionCandidateId).toBe(proposal.canonicalRealization.candidateId);
        expect(value.g3.companionCandidateId).toBe(proposal.canonicalRealization.candidateId);
        expect(value.fixedCommandClaim).toBe("EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P");
      }
    } finally {
      world.dispose();
    }
  });

  it("rejects stale tick, horizon and capability provenance before cross-future rehearsal", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const proposal = zeroProposal(decision);

      expect(() => buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal: { ...proposal, sourceTick: proposal.sourceTick + 1 }
      })).toThrow(/source ticks are misaligned/i);

      expect(() => buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal: { ...proposal, horizonSeconds: proposal.horizonSeconds + 0.1 }
      })).toThrow(/horizons are misaligned/i);

      expect(() => buildA1FixedCommandCrossFutureProfile({
        world,
        situation: decision.situation,
        interventionPlan: decision.interventionPlan,
        proposal: {
          ...proposal,
          canonicalRealization: {
            ...proposal.canonicalRealization,
            capabilityMaxSpeed: proposal.canonicalRealization.capabilityMaxSpeed + 1
          }
        }
      })).toThrow(/capability provenance/i);
    } finally {
      world.dispose();
    }
  });
});
