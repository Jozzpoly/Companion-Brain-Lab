import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function buildInput(
  world: LabWorld,
  playerMove: Vec2,
  snapshot: ReturnType<LabWorld["snapshot"]> = world.snapshot(),
  horizonSeconds = 0.5
) {
  const situation = buildA1Situation({
    snapshot,
    playerIntent: playerIntent(playerMove.x, playerMove.y),
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
  const interventionPlan = buildA1PlayerFutureInterventionPlan(futures);
  return { situation, interventionPlan };
}

function buildProposals(input: ReturnType<typeof buildInput>, localAlternativeDeltaSpeed = 1) {
  return buildA1ConcreteCommandProposalSet({
    situation: input.situation,
    interventionPlan: input.interventionPlan,
    localAlternativeDeltaSpeed
  });
}

function velocityKey(value: Vec2): string {
  return `${value.x.toFixed(9)},${value.y.toFixed(9)}`;
}

describe("Authority-A1.2o concrete DIRECT command proposals", () => {
  it("keeps stationary H2 unresolved and generates no substitute commands for it", async () => {
    const world = await LabWorld.create("open");
    try {
      const input = buildInput(world, { x: 1, y: 0 });
      const body = input.interventionPlan.interventions.find(
        (value) => value.futureFamily === "BODY_RESPONSE_CONTINUATION"
      );
      expect(body?.status).toBe("UNRESOLVED");

      const proposals = buildProposals(input);
      expect(proposals.rehearsableFutureIds).toEqual(["owner-request-continuation"]);
      expect(proposals.unresolvedFutures).toEqual([
        {
          futureId: "body-response-continuation",
          futureFamily: "BODY_RESPONSE_CONTINUATION",
          unresolvedReason: "H2_STATIONARY_IS_OBSERVATION_NOT_QUALIFIED_CONTROL"
        }
      ]);
      expect(proposals.generationOriginCount).toBe(7);
      expect(proposals.proposalCount).toBeLessThan(proposals.generationOriginCount);
      expect(
        proposals.proposals.reduce((sum, proposal) => sum + proposal.generationOriginCount, 0)
      ).toBe(7);
      expect(new Set(proposals.proposals.map((proposal) => velocityKey(proposal.commandVelocity))).size)
        .toBe(proposals.proposalCount);
      expect(proposals.proposals.some((proposal) => proposal.generationOriginCount > 1)).toBe(true);
      expect(
        proposals.proposals.flatMap((proposal) => proposal.generationOrigins)
          .some((origin) => origin.futureFamily === "BODY_RESPONSE_CONTINUATION")
      ).toBe(false);
      expect(proposals.unresolvedFutureClaim).toBe("PRESERVED_NO_GENERATION_NO_SUBSTITUTION_A1_2O");
      expect(proposals.selectionClaim).toBe("NONE_A1_2O");
      expect(proposals.runtimeAuthorityClaim).toBe("NONE_A1_2O");
    } finally {
      world.dispose();
    }
  });

  it("deduplicates shared H1/H2 commands while preserving genuinely future-specific commands", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const input = buildInput(world, { x: 1, y: 0 }, after);
      const rehearsable = input.interventionPlan.interventions.filter(
        (value) => value.status === "REHEARSABLE"
      );
      expect(rehearsable.map((value) => value.futureFamily)).toEqual([
        "OWNER_REQUEST_CONTINUATION",
        "BODY_RESPONSE_CONTINUATION"
      ]);

      const proposals = buildProposals(input);
      expect(proposals.generationOriginCount).toBe(14);
      expect(proposals.proposalCount).toBeLessThan(14);
      expect(proposals.unresolvedFutures).toEqual([]);
      expect(
        proposals.proposals.reduce((sum, proposal) => sum + proposal.generationOriginCount, 0)
      ).toBe(14);

      const futureFamilies = (proposal: (typeof proposals.proposals)[number]) =>
        new Set(proposal.generationOrigins.map((origin) => origin.futureFamily));
      const shared = proposals.proposals.filter((proposal) => {
        const futures = futureFamilies(proposal);
        return futures.has("OWNER_REQUEST_CONTINUATION") && futures.has("BODY_RESPONSE_CONTINUATION");
      });
      const futureSpecific = proposals.proposals.filter((proposal) => futureFamilies(proposal).size === 1);

      expect(shared.length).toBeGreaterThan(0);
      expect(futureSpecific.length).toBeGreaterThan(0);

      const sharedHold = shared.find(
        (proposal) => Math.hypot(proposal.commandVelocity.x, proposal.commandVelocity.y) <= 1e-9
      );
      if (!sharedHold) throw new Error("missing shared zero/HOLD concrete command");
      const sharedHoldFutures = new Set(
        sharedHold.generationOrigins
          .filter((origin) => origin.seedFamily === "HOLD")
          .map((origin) => origin.futureFamily)
      );
      expect(sharedHoldFutures).toEqual(
        new Set(["OWNER_REQUEST_CONTINUATION", "BODY_RESPONSE_CONTINUATION"])
      );
      expect(proposals.commandDedupClaim).toBe("DEDUP_BY_EXECUTABLE_COMMAND_VELOCITY_A1_2O");
    } finally {
      world.dispose();
    }
  });

  it("keeps the same family label as different concrete commands when H1/H2/H3 imply different velocities", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const input = buildInput(world, { x: -1, y: 0 }, after);
      const families = input.interventionPlan.interventions.map((value) => [value.futureFamily, value.status]);
      expect(families).toEqual([
        ["OWNER_REQUEST_CONTINUATION", "REHEARSABLE"],
        ["BODY_RESPONSE_CONTINUATION", "REHEARSABLE"],
        ["TRANSITION_HOLD", "REHEARSABLE"]
      ]);

      const proposals = buildProposals(input);
      const feedForwardOrigins = proposals.proposals.flatMap((proposal) =>
        proposal.generationOrigins
          .filter((origin) => origin.seedFamily === "PLAYER_FEED_FORWARD")
          .map((origin) => ({ proposalId: proposal.proposalId, velocity: velocityKey(proposal.commandVelocity), origin }))
      );

      expect(feedForwardOrigins).toHaveLength(3);
      expect(new Set(feedForwardOrigins.map((entry) => entry.velocity)).size).toBe(3);
      expect(new Set(feedForwardOrigins.map((entry) => entry.proposalId)).size).toBe(3);
      expect(new Set(feedForwardOrigins.map((entry) => entry.origin.seedFamily))).toEqual(
        new Set(["PLAYER_FEED_FORWARD"])
      );
      expect(proposals.familySemanticsClaim).toBe("NONE_COMMAND_IDENTITY_NOT_FAMILY_LABEL_A1_2O");
    } finally {
      world.dispose();
    }
  });

  it("can merge different family labels when they produce the same executable command", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const input = buildInput(world, { x: -1, y: 0 }, after);
      const proposals = buildProposals(input);
      const zero = proposals.proposals.find(
        (proposal) => Math.hypot(proposal.commandVelocity.x, proposal.commandVelocity.y) <= 1e-9
      );
      if (!zero) throw new Error("missing zero concrete command proposal");

      const originFamilies = new Set(zero.generationOrigins.map((origin) => origin.seedFamily));
      const originFutures = new Set(zero.generationOrigins.map((origin) => origin.futureFamily));
      expect(originFamilies.has("HOLD")).toBe(true);
      expect(originFamilies.has("PLAYER_FEED_FORWARD")).toBe(true);
      expect(originFutures.has("TRANSITION_HOLD")).toBe(true);
      expect(zero.commandIdentityClaim).toBe("EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME_A1_2O");
      expect(zero.familySemanticsClaim).toBe("NONE_GENERATION_PROVENANCE_ONLY_A1_2O");
    } finally {
      world.dispose();
    }
  });

  it("is deterministic for the same decision evidence and preserves canonical command velocity exactly", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const input = buildInput(world, { x: -1, y: 0 }, after);
      const a = buildProposals(input, 3);
      const b = buildProposals(input, 3);

      expect(b).toEqual(a);
      for (const proposal of a.proposals) {
        expect(proposal.canonicalRealization.commandVelocity).toEqual(proposal.commandVelocity);
        expect(proposal.physicsExecutionClaim).toBe("NONE_A1_2O_GENERATION_ONLY");
        expect(proposal.cooperationClaim).toBe("NONE_A1_2O");
        expect(proposal.selectionClaim).toBe("NONE_A1_2O");
        expect(proposal.runtimeAuthorityClaim).toBe("NONE_A1_2O");
      }
    } finally {
      world.dispose();
    }
  });

  it("rejects misaligned intervention evidence instead of generating commands from it", async () => {
    const world = await LabWorld.create("open");
    try {
      const input = buildInput(world, { x: 1, y: 0 });
      const forged = {
        ...input.interventionPlan,
        sourceTick: input.interventionPlan.sourceTick + 1
      };
      expect(() => buildA1ConcreteCommandProposalSet({
        situation: input.situation,
        interventionPlan: forged,
        localAlternativeDeltaSpeed: 1
      })).toThrow(/source ticks are misaligned/i);
    } finally {
      world.dispose();
    }
  });
});
