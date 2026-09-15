import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, ScenarioId, Vec2, WorldSnapshot } from "../world/types";

const H1 = "OWNER_REQUEST_CONTINUATION" as const;
const Q_EQUAL_EPSILON = 1e-9;
const PROGRESS_RESOLUTION_METERS = 1e-3;

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

interface StateCase {
  id: string;
  scenario: ScenarioId;
  prepare: (world: LabWorld) => WorldSnapshot;
  playerMove: Vec2;
}

const STATES: readonly StateCase[] = [
  {
    id: "open-initial-forward",
    scenario: "open",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "open-established-forward",
    scenario: "open",
    prepare: (world) => world.step([playerIntent(1, 0), companionHold()]),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "open-reversal",
    scenario: "open",
    prepare: (world) => world.step([playerIntent(1, 0), companionHold()]),
    playerMove: { x: -1, y: 0 }
  },
  {
    id: "head-on-forward",
    scenario: "head-on",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "doorway-forward",
    scenario: "doorway",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "pillar-forward",
    scenario: "pillar",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  }
];

async function characterize(state: StateCase) {
  const world = await LabWorld.create(state.scenario);
  try {
    const snapshot = state.prepare(world);
    const situation = buildA1Situation({
      snapshot,
      playerIntent: playerIntent(state.playerMove.x, state.playerMove.y),
      playerCapability: world.actorMovementCapability("player"),
      companionCapability: world.actorMovementCapability("companion"),
      previousWorldStep: snapshot.tick === 0 ? null : world.latestAuthorityA0StepEvidence()
    });
    const horizonSeconds = 0.5;
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
      localAlternativeDeltaSpeed: 1
    });
    const physicalProfiles = proposalSet.proposals.map((proposal) =>
      buildA1FixedCommandCrossFutureProfile({ world, situation, interventionPlan, proposal })
    );
    const orientation = evaluateA1RelationshipOrientation({ situation });
    const utilityProfiles = physicalProfiles.map((profile) =>
      buildA1TerminalRelationshipUtilityProfile({
        profile,
        situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      })
    );

    const initialRelativeOffset = utilityProfiles[0]?.initialRelativeOffset ?? { x: 0, y: 0 };
    const initialRadius = magnitude(initialRelativeOffset);
    const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
    const initialRadialError = Math.abs(initialRadius - preferredRadius);

    const rows = utilityProfiles.flatMap((profile) => {
      const entry = profile.entries.find((candidate) => candidate.futureFamily === H1);
      if (!entry?.relationshipUtility) return [];
      const terminalRadius = entry.relationshipUtility.terminalUtility.radius;
      const terminalRadialError = Math.abs(terminalRadius - preferredRadius);
      return [{
        proposalId: profile.proposalId,
        commandVelocity: profile.commandVelocity,
        q: entry.relationshipUtility.terminalUtility.totalUtility,
        terminalRadius,
        radialErrorDelta: terminalRadialError - initialRadialError
      }];
    });

    let comparablePairs = 0;
    let qDiscriminatingPairs = 0;
    let progressDiscriminatingPairs = 0;
    let qEqualProgressDifferentPairs = 0;
    let bothDiscriminateOppositePairs = 0;

    for (let a = 0; a < rows.length; a += 1) {
      for (let b = a + 1; b < rows.length; b += 1) {
        const left = rows[a]!;
        const right = rows[b]!;
        comparablePairs += 1;
        const qDelta = left.q - right.q;
        const progressDelta = left.radialErrorDelta - right.radialErrorDelta;
        const qDifferent = Math.abs(qDelta) > Q_EQUAL_EPSILON;
        const progressDifferent = Math.abs(progressDelta) > PROGRESS_RESOLUTION_METERS;
        if (qDifferent) qDiscriminatingPairs += 1;
        if (progressDifferent) progressDiscriminatingPairs += 1;
        if (!qDifferent && progressDifferent) qEqualProgressDifferentPairs += 1;
        // Higher q is better; lower radial-error delta is better.
        if (qDifferent && progressDifferent && Math.sign(qDelta) === Math.sign(progressDelta)) {
          bothDiscriminateOppositePairs += 1;
        }
      }
    }

    return {
      stateId: state.id,
      scenario: state.scenario,
      horizonSeconds,
      transitionReasons: hypotheses.transitionReasons,
      h1Clipped: hypotheses.hypotheses.find((future) => future.family === H1)?.staticFeasibility.clipped ?? null,
      initialRadius,
      initialRadialError,
      proposalCount: proposalSet.proposalCount,
      availableH1Count: rows.length,
      comparablePairs,
      qDiscriminatingPairs,
      progressDiscriminatingPairs,
      qEqualProgressDifferentPairs,
      bothDiscriminateOppositePairs,
      rows
    };
  } finally {
    world.dispose();
  }
}

describe("Authority-A1.2t q / relative-progress complementarity", () => {
  it("tests whether relative progress contributes decision evidence beyond the reversal fixture", async () => {
    const results = [];
    for (const state of STATES) results.push(await characterize(state));

    console.log("[A1_2T_PROGRESS_COMPLEMENTARITY]", JSON.stringify({
      qEqualEpsilon: Q_EQUAL_EPSILON,
      progressResolutionMeters: PROGRESS_RESOLUTION_METERS,
      results
    }));

    const reversal = results.find((entry) => entry.stateId === "open-reversal")!;
    expect(reversal.h1Clipped).toBe(false);
    expect(reversal.qDiscriminatingPairs).toBe(0);
    expect(reversal.progressDiscriminatingPairs).toBeGreaterThan(0);
    expect(reversal.qEqualProgressDifferentPairs).toBeGreaterThan(0);

    const nonReversal = results.filter((entry) => entry.stateId !== "open-reversal");
    expect(nonReversal.some((entry) => entry.qDiscriminatingPairs > 0)).toBe(true);
    expect(nonReversal.some((entry) => entry.qEqualProgressDifferentPairs > 0)).toBe(true);
  });
});
