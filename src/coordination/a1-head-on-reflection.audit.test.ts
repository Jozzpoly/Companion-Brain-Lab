import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  evaluateA1RelationshipUtility
} from "./a1-relationship-utility";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

const H1: A1PlayerFutureFamily = "OWNER_REQUEST_CONTINUATION";
const HORIZONS = [0.5, 0.75, 1, 1.2, 1.5] as const;
const EPSILON = 1e-12;

function playerIntent(move: Vec2): MotionIntent {
  return { actorId: "player", move };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function reflectedAcrossPlayerAxis(value: Vec2): Vec2 {
  return { x: value.x, y: -value.y };
}

async function auditHorizon(horizonSeconds: number) {
  const world = await LabWorld.create("head-on");
  try {
    const snapshot = world.snapshot();
    const situation = buildA1Situation({
      snapshot,
      playerIntent: playerIntent({ x: 1, y: 0 }),
      playerCapability: world.actorMovementCapability("player"),
      companionCapability: world.actorMovementCapability("companion"),
      previousWorldStep: null
    });
    const hypotheses = buildA1PlayerFutureHypotheses({
      situation,
      horizonSeconds,
      staticTraversal: (from, target, radius, options) =>
        world.staticCircleTraversal(from, target, radius, options)
    });
    const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
    const proposalSet = buildA1ConcreteCommandProposalSet({
      situation,
      interventionPlan,
      localAlternativeDeltaSpeed: 3
    });

    const positive = proposalSet.proposals.find((proposal) =>
      proposal.generationOrigins.some((origin) => origin.seedFamily === "RELATIVE_TANGENT_POSITIVE")
    );
    const negative = proposalSet.proposals.find((proposal) =>
      proposal.generationOrigins.some((origin) => origin.seedFamily === "RELATIVE_TANGENT_NEGATIVE")
    );
    if (!positive || !negative) {
      throw new Error("A1.2z4a requires both reflected tangent proposals in the initial head-on fixture.");
    }

    const orientation = evaluateA1RelationshipOrientation({ situation });
    const profiles = [positive, negative].map((proposal) =>
      buildA1FixedCommandCrossFutureProfile({ world, situation, interventionPlan, proposal })
    );
    const relationshipProfiles = profiles.map((profile) =>
      buildA1TerminalRelationshipUtilityProfile({
        profile,
        situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      })
    );

    const positiveRelationship = relationshipProfiles[0]!.entries.find(
      (entry) => entry.futureFamily === H1
    )?.relationshipUtility;
    const negativeRelationship = relationshipProfiles[1]!.entries.find(
      (entry) => entry.futureFamily === H1
    )?.relationshipUtility;
    if (!positiveRelationship || !negativeRelationship) {
      throw new Error("A1.2z4a requires rehearsed H1 terminal relationship evidence for both tangent proposals.");
    }

    const reflectedPositiveTerminal = reflectedAcrossPlayerAxis(
      positiveRelationship.terminalRelativeOffset
    );
    const reflectedSemanticUtility = evaluateA1RelationshipUtility({
      state: { relativeOffset: reflectedPositiveTerminal },
      orientation,
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
    });

    return {
      horizonSeconds,
      initialRelativeOffset: { ...positiveRelationship.initialRelativeOffset },
      orientation: {
        source: orientation.source,
        direction: orientation.direction ? { ...orientation.direction } : null,
        strength: orientation.strength
      },
      positive: {
        proposalId: positive.proposalId,
        commandVelocity: { ...positive.commandVelocity },
        terminalRelativeOffset: { ...positiveRelationship.terminalRelativeOffset },
        q: positiveRelationship.terminalUtility.totalUtility
      },
      negative: {
        proposalId: negative.proposalId,
        commandVelocity: { ...negative.commandVelocity },
        terminalRelativeOffset: { ...negativeRelationship.terminalRelativeOffset },
        q: negativeRelationship.terminalUtility.totalUtility
      },
      reflectedPositiveTerminal,
      physicalMirrorErrorMeters: distance(
        reflectedPositiveTerminal,
        negativeRelationship.terminalRelativeOffset
      ),
      directSemanticReflectionError: Math.abs(
        reflectedSemanticUtility.totalUtility - positiveRelationship.terminalUtility.totalUtility
      ),
      actualTangentQDelta: negativeRelationship.terminalUtility.totalUtility -
        positiveRelationship.terminalUtility.totalUtility,
      authority: {
        proposalSelection: proposalSet.selectionClaim,
        proposalRuntime: proposalSet.runtimeAuthorityClaim,
        positiveRuntime: profiles[0]!.runtimeAuthorityClaim,
        negativeRuntime: profiles[1]!.runtimeAuthorityClaim
      }
    };
  } finally {
    world.dispose();
  }
}

describe("Authority-A1.2z4a initial head-on reflection audit", () => {
  it("separates semantic reflection symmetry from same-physics tangent symmetry breaking", async () => {
    const results = [];
    for (const horizonSeconds of HORIZONS) results.push(await auditHorizon(horizonSeconds));

    console.log("[A1_2Z4A_HEAD_ON_REFLECTION_AUDIT]", JSON.stringify({
      scenario: "head-on",
      reflectionAxis: "PLAYER_OWNER_DIRECTION_X_AXIS",
      horizons: HORIZONS,
      results
    }));

    expect(results).toHaveLength(HORIZONS.length);
    expect(results.every((result) => Math.abs(result.initialRelativeOffset.y) <= EPSILON)).toBe(true);
    expect(results.every((result) => result.orientation.source === "SAME_STEP_OWNER")).toBe(true);
    expect(results.every((result) =>
      result.orientation.direction !== null &&
      Math.abs(result.orientation.direction.x - 1) <= EPSILON &&
      Math.abs(result.orientation.direction.y) <= EPSILON
    )).toBe(true);

    expect(results.every((result) =>
      Math.abs(result.positive.commandVelocity.x - result.negative.commandVelocity.x) <= EPSILON &&
      Math.abs(result.positive.commandVelocity.y + result.negative.commandVelocity.y) <= EPSILON
    )).toBe(true);

    // Under the current radial + avoid-forward objective and +X Owner orientation,
    // reflecting only the relative Y coordinate has no semantic side preference.
    expect(results.every((result) => result.directSemanticReflectionError <= EPSILON)).toBe(true);

    // The current same-physics rehearsal nevertheless produces a small but real
    // mirror mismatch and q split. This is evidence to characterize, not a side
    // preference or a selector threshold.
    expect(results.some((result) => result.physicalMirrorErrorMeters > 1e-9)).toBe(true);
    expect(results.some((result) => Math.abs(result.actualTangentQDelta) > 1e-9)).toBe(true);
    expect(results.every((result) => Math.abs(result.actualTangentQDelta) < 1e-4)).toBe(true);

    expect(results.every((result) => result.authority.proposalSelection === "NONE_A1_2O")).toBe(true);
    expect(results.every((result) => result.authority.proposalRuntime === "NONE_A1_2O")).toBe(true);
    expect(results.every((result) => result.authority.positiveRuntime === "NONE_A1_2P")).toBe(true);
    expect(results.every((result) => result.authority.negativeRuntime === "NONE_A1_2P")).toBe(true);
  });
});
