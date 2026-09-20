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
import type { MotionIntent } from "../world/types";

const H1 = "OWNER_REQUEST_CONTINUATION" as const;
const HORIZON_SECONDS = 0.5;
const MATERIAL_METERS = 0.01;

function intent(actorId: "player" | "companion", x: number): MotionIntent {
  return { actorId, move: { x, y: 0 } };
}

function hold(actorId: "player" | "companion"): MotionIntent {
  return intent(actorId, 0);
}

async function characterize(input: {
  id: string;
  companionApproachSteps: number;
}) {
  const world = await LabWorld.create("open");
  try {
    for (let step = 0; step < input.companionApproachSteps; step += 1) {
      world.step([hold("player"), intent("companion", -1)]);
    }
    const snapshot = world.step([hold("player"), hold("companion")]);
    const situation = buildA1Situation({
      snapshot,
      playerIntent: intent("player", -1),
      playerCapability: world.actorMovementCapability("player"),
      companionCapability: world.actorMovementCapability("companion"),
      previousWorldStep: world.latestAuthorityA0StepEvidence()
    });
    const hypotheses = buildA1PlayerFutureHypotheses({
      situation,
      horizonSeconds: HORIZON_SECONDS,
      staticTraversal: (from, target, radius, options) =>
        world.staticCircleTraversal(from, target, radius, options)
    });
    const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
    const proposalSet = buildA1ConcreteCommandProposalSet({
      situation,
      interventionPlan,
      localAlternativeDeltaSpeed: 1
    });
    const orientation = evaluateA1RelationshipOrientation({ situation });
    const utilityProfiles = proposalSet.proposals.map((proposal) => {
      const physical = buildA1FixedCommandCrossFutureProfile({
        world,
        situation,
        interventionPlan,
        proposal
      });
      return {
        proposal,
        utility: buildA1TerminalRelationshipUtilityProfile({
          profile: physical,
          situation,
          orientation,
          objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
        })
      };
    });

    const initialRelativeOffset = utilityProfiles[0]!.utility.initialRelativeOffset;
    const initialRadius = Math.hypot(initialRelativeOffset.x, initialRelativeOffset.y);
    const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
    const initialSignedOffset = initialRadius - preferredRadius;
    const initialAbsoluteError = Math.abs(initialSignedOffset);

    const rows = utilityProfiles.flatMap(({ proposal, utility }) => {
      const entry = utility.entries.find((candidate) => candidate.futureFamily === H1);
      if (!entry?.relationshipUtility) return [];
      const terminalRadius = entry.relationshipUtility.terminalUtility.radius;
      const terminalSignedOffset = terminalRadius - preferredRadius;
      const terminalAbsoluteError = Math.abs(terminalSignedOffset);
      return [{
        proposalId: proposal.proposalId,
        commandVelocity: proposal.commandVelocity,
        origins: proposal.generationOrigins.map((origin) => ({
          futureFamily: origin.futureFamily,
          seedFamily: origin.seedFamily,
          desiredVelocity: origin.desiredVelocity,
          capabilityClipped: origin.capabilityClipped
        })),
        q: entry.relationshipUtility.terminalUtility.totalUtility,
        terminalRadius,
        radiusDelta: terminalRadius - initialRadius,
        terminalSignedOffset,
        absoluteErrorDelta: terminalAbsoluteError - initialAbsoluteError
      }];
    });

    const bestErrorDelta = Math.min(...rows.map((row) => row.absoluteErrorDelta));
    const worstErrorDelta = Math.max(...rows.map((row) => row.absoluteErrorDelta));
    const improving = rows.filter((row) => row.absoluteErrorDelta < -MATERIAL_METERS);
    const worsening = rows.filter((row) => row.absoluteErrorDelta > MATERIAL_METERS);
    const stable = rows.filter((row) => Math.abs(row.absoluteErrorDelta) <= MATERIAL_METERS);
    const best = rows.filter((row) => Math.abs(row.absoluteErrorDelta - bestErrorDelta) <= 1e-3);

    return {
      id: input.id,
      preparationSteps: input.companionApproachSteps,
      tick: snapshot.tick,
      transitionReasons: hypotheses.transitionReasons,
      h1Clipped: hypotheses.hypotheses.find((future) => future.family === H1)?.staticFeasibility.clipped ?? null,
      orientation: { source: orientation.source, direction: orientation.direction },
      preferredRadius,
      initialRadius,
      initialSignedOffset,
      initialAbsoluteError,
      proposalCount: proposalSet.proposalCount,
      availableH1Count: rows.length,
      bestErrorDelta,
      worstErrorDelta,
      improvingCount: improving.length,
      worseningCount: worsening.length,
      stableCount: stable.length,
      best: best.map((row) => ({
        proposalId: row.proposalId,
        commandVelocity: row.commandVelocity,
        radiusDelta: row.radiusDelta,
        absoluteErrorDelta: row.absoluteErrorDelta,
        origins: row.origins
      })),
      rows
    };
  } finally {
    world.dispose();
  }
}

describe("Authority-A1.2t radial PACE regime characterization", () => {
  it("requires progress semantics to reverse across the preferred radius without inventing a useful-region shell", async () => {
    const far = await characterize({ id: "too-far", companionApproachSteps: 40 });
    const near = await characterize({ id: "near-preferred", companionApproachSteps: 71 });
    const close = await characterize({ id: "too-close", companionApproachSteps: 84 });
    const results = [far, near, close];

    console.log("[A1_2T_RADIAL_PACE_REGIMES]", JSON.stringify({
      materialMeters: MATERIAL_METERS,
      results
    }));

    for (const result of results) {
      expect(result.h1Clipped).toBe(false);
      expect(result.orientation.source).toBe("SAME_STEP_OWNER");
      expect(result.orientation.direction).toEqual({ x: -1, y: 0 });
      expect(result.availableH1Count).toBe(result.proposalCount);
    }

    expect(far.initialSignedOffset).toBeGreaterThan(1);
    expect(far.improvingCount).toBe(0);
    expect(far.bestErrorDelta).toBeLessThanOrEqual(MATERIAL_METERS);
    expect(far.worseningCount).toBeGreaterThan(0);
    expect(far.best.some((row) => row.commandVelocity.x < -2.9 && Math.abs(row.commandVelocity.y) < 1e-6)).toBe(true);

    expect(Math.abs(near.initialSignedOffset)).toBeLessThan(0.12);
    expect(near.worseningCount).toBeGreaterThan(0);
    expect(near.bestErrorDelta).toBeLessThanOrEqual(MATERIAL_METERS);

    expect(close.initialSignedOffset).toBeLessThan(-0.4);
    expect(close.improvingCount).toBeGreaterThan(0);
    expect(close.worseningCount).toBeGreaterThan(0);
    expect(close.best.some((row) => row.radiusDelta > MATERIAL_METERS)).toBe(true);
  });
});
