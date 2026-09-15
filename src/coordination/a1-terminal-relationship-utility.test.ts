import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  evaluateA1RelationshipUtility
} from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";

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

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function proposalByOrigin(input: {
  decision: ReturnType<typeof buildDecision>;
  futureFamily: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD";
  seedFamily: string;
}) {
  const proposal = input.decision.proposalSet.proposals.find((candidate) =>
    candidate.generationOrigins.some((origin) =>
      origin.futureFamily === input.futureFamily && origin.seedFamily === input.seedFamily
    )
  );
  if (!proposal) throw new Error(`missing ${input.futureFamily}/${input.seedFamily} concrete proposal`);
  return proposal;
}

function zeroProposal(decision: ReturnType<typeof buildDecision>) {
  const proposal = decision.proposalSet.proposals.find(
    (candidate) => Math.hypot(candidate.commandVelocity.x, candidate.commandVelocity.y) <= 1e-9
  );
  if (!proposal) throw new Error("missing zero concrete proposal");
  return proposal;
}

function buildP(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
  proposal: ReturnType<typeof zeroProposal>;
}) {
  return buildA1FixedCommandCrossFutureProfile({
    world: input.world,
    situation: input.decision.situation,
    interventionPlan: input.decision.interventionPlan,
    proposal: input.proposal
  });
}

function utilityEntry(
  profile: ReturnType<typeof buildA1TerminalRelationshipUtilityProfile>,
  family: string
) {
  const entry = profile.entries.find((candidate) => candidate.futureFamily === family);
  if (!entry) throw new Error(`missing utility entry ${family}`);
  return entry;
}

describe("Authority-A1.2q actual-terminal A1.1 relationship utility", () => {
  it("attaches utility only to REHEARSED futures and preserves UNRESOLVED/ABSENT without fabricated scores", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const p = buildP({ world, decision, proposal: zeroProposal(decision) });
      const orientation = evaluateA1RelationshipOrientation({ situation: decision.situation });
      const q = buildA1TerminalRelationshipUtilityProfile({
        profile: p,
        situation: decision.situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });

      expect(q.utilityAvailableCount).toBe(1);
      expect(q.utilityUnavailableCount).toBe(2);
      const h1 = utilityEntry(q, "OWNER_REQUEST_CONTINUATION");
      expect(h1.sourceStatus).toBe("REHEARSED");
      expect(h1.utilityAvailability).toBe("AVAILABLE_REHEARSED_TERMINAL_STATE");
      expect(h1.relationshipUtility).not.toBeNull();

      const h2 = utilityEntry(q, "BODY_RESPONSE_CONTINUATION");
      expect(h2.sourceStatus).toBe("UNRESOLVED");
      expect(h2.relationshipUtility).toBeNull();
      expect(h2.utilityAvailability).toBe("UNAVAILABLE_NON_REHEARSED_FUTURE");

      const h3 = utilityEntry(q, "TRANSITION_HOLD");
      expect(h3.sourceStatus).toBe("ABSENT");
      expect(h3.relationshipUtility).toBeNull();
      expect(q.utilityAggregationClaim).toBe("NONE_PRESERVE_PLAYER_FUTURES_A1_2Q");
      expect(q.selectionClaim).toBe("NONE_A1_2Q");
      expect(q.runtimeAuthorityClaim).toBe("NONE_A1_2Q");
    } finally {
      world.dispose();
    }
  });

  it("uses the actual last same-physics frame after head-on solver contact instead of a velocity endpoint", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        localAlternativeDeltaSpeed: 3
      });
      const proposal = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_RADIAL_INWARD"
      });
      const p = buildP({ world, decision, proposal });
      const orientation = evaluateA1RelationshipOrientation({ situation: decision.situation });
      const q = buildA1TerminalRelationshipUtilityProfile({
        profile: p,
        situation: decision.situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });
      const h1p = p.entries.find((entry) => entry.futureFamily === "OWNER_REQUEST_CONTINUATION");
      const h1q = utilityEntry(q, "OWNER_REQUEST_CONTINUATION");
      if (h1p?.status !== "REHEARSED" || !h1q.relationshipUtility) {
        throw new Error("expected rehearsed H1 utility evidence");
      }
      expect(h1p.g3.status).toBe("REQUIRE_G4_NEW_RECIPROCAL_CONTACT");

      const frame = h1p.rehearsal.physical.frames.at(-1);
      if (!frame) throw new Error("missing actual terminal frame");
      const actual = subtract(
        actor(frame.actors, "companion").position,
        actor(frame.actors, "player").position
      );
      expect(h1q.relationshipUtility.terminalRelativeOffset.x).toBeCloseTo(actual.x, 12);
      expect(h1q.relationshipUtility.terminalRelativeOffset.y).toBeCloseTo(actual.y, 12);

      const initialPlayer = decision.situation.situated.playerBody.position;
      const initialCompanion = decision.situation.situated.companionBody.position;
      const naivePlayer = {
        x: initialPlayer.x + h1p.playerVelocity.x * p.horizonSeconds,
        y: initialPlayer.y + h1p.playerVelocity.y * p.horizonSeconds
      };
      const naiveCompanion = {
        x: initialCompanion.x + proposal.commandVelocity.x * p.horizonSeconds,
        y: initialCompanion.y + proposal.commandVelocity.y * p.horizonSeconds
      };
      const naiveRelative = subtract(naiveCompanion, naivePlayer);
      expect(distance(actual, naiveRelative)).toBeGreaterThan(0.001);
      expect(h1q.relationshipUtility.terminalStateSource)
        .toBe("A1_2P_LAST_SAME_PHYSICS_REHEARSAL_FRAME");
    } finally {
      world.dispose();
    }
  });

  it("matches direct A1.1 utility exactly for initial and actual terminal relative states", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const p = buildP({ world, decision, proposal: zeroProposal(decision) });
      const orientation = evaluateA1RelationshipOrientation({ situation: decision.situation });
      const q = buildA1TerminalRelationshipUtilityProfile({
        profile: p,
        situation: decision.situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });
      const h1 = utilityEntry(q, "OWNER_REQUEST_CONTINUATION");
      if (!h1.relationshipUtility) throw new Error("expected H1 relationship utility");

      const directInitial = evaluateA1RelationshipUtility({
        state: { relativeOffset: h1.relationshipUtility.initialRelativeOffset },
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });
      const directTerminal = evaluateA1RelationshipUtility({
        state: { relativeOffset: h1.relationshipUtility.terminalRelativeOffset },
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });
      expect(h1.relationshipUtility.initialUtility).toEqual(directInitial);
      expect(h1.relationshipUtility.terminalUtility).toEqual(directTerminal);
      expect(h1.relationshipUtility.utilityDelta).toBeCloseTo(
        directTerminal.totalUtility - directInitial.totalUtility,
        12
      );
      expect(q.playerFlowUsage).toBe("NONE_A1_2Q");
      expect(q.samplingUsage).toBe("NONE_A1_2Q");
      expect("sampling" in q).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("keeps each reversal H1/H2/H3 utility separate instead of aggregating counterfactuals", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const proposal = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "PLAYER_FEED_FORWARD"
      });
      const p = buildP({ world, decision, proposal });
      expect(p.rehearsedCount).toBe(3);
      const orientation = evaluateA1RelationshipOrientation({ situation: decision.situation });
      const q = buildA1TerminalRelationshipUtilityProfile({
        profile: p,
        situation: decision.situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });

      expect(q.utilityAvailableCount).toBe(3);
      expect(q.entries.map((entry) => entry.futureFamily)).toEqual([
        "OWNER_REQUEST_CONTINUATION",
        "BODY_RESPONSE_CONTINUATION",
        "TRANSITION_HOLD"
      ]);
      expect(q.entries.every((entry) => entry.relationshipUtility !== null)).toBe(true);
      expect(q.utilityAggregationClaim).toBe("NONE_PRESERVE_PLAYER_FUTURES_A1_2Q");
      expect("totalUtility" in q).toBe(false);
      expect("utilityScore" in q).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("keeps stationary NONE orientation directionless and does not invent player-flow semantics", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 0, y: 0 } });
      const p = buildP({ world, decision, proposal: zeroProposal(decision) });
      const orientation = evaluateA1RelationshipOrientation({ situation: decision.situation });
      expect(orientation.source).toBe("NONE");
      const q = buildA1TerminalRelationshipUtilityProfile({
        profile: p,
        situation: decision.situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      });
      const h1 = utilityEntry(q, "OWNER_REQUEST_CONTINUATION");
      if (!h1.relationshipUtility) throw new Error("expected stationary H1 utility");
      expect(h1.relationshipUtility.initialUtility.directionalSemanticsActive).toBe(false);
      expect(h1.relationshipUtility.terminalUtility.directionalSemanticsActive).toBe(false);
      expect(h1.relationshipUtility.terminalUtility.directionalUtility).toBeNull();
      expect(q.orientationSource).toBe("NONE");
      expect(q.playerFlowUsage).toBe("NONE_A1_2Q");
    } finally {
      world.dispose();
    }
  });

  it("rejects stale orientation provenance before attaching semantic utility", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const p = buildP({ world, decision, proposal: zeroProposal(decision) });
      const orientation = evaluateA1RelationshipOrientation({ situation: decision.situation });
      const stale = { ...orientation, tick: orientation.tick + 1 };
      expect(() => buildA1TerminalRelationshipUtilityProfile({
        profile: p,
        situation: decision.situation,
        orientation: stale,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      })).toThrow(/orientation tick must equal/i);
    } finally {
      world.dispose();
    }
  });
});
