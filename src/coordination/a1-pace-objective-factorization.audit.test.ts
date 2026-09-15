import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  type A1RelationshipObjectiveProfile
} from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";

const H1 = "OWNER_REQUEST_CONTINUATION" as const;
const HORIZON_SECONDS = 0.5;
const BEST_TOLERANCE_METERS = 1e-3;

const SHIFTED_RADIAL_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: {
    preferredRadius: 2,
    sigma: A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.sigma,
    weight: A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.weight
  },
  directional: { ...A1_DEFAULT_RELATIONSHIP_OBJECTIVE.directional }
};

const LATERAL_DIRECTIONAL_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { ...A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial },
  directional: {
    kind: "PREFER_BEARING",
    preferredBearingRadians: Math.PI / 2,
    sigmaRadians: Math.PI / 8,
    weight: 2
  }
};

function intent(actorId: "player" | "companion", x: number): MotionIntent {
  return { actorId, move: { x, y: 0 } };
}

function hold(actorId: "player" | "companion"): MotionIntent {
  return intent(actorId, 0);
}

describe("Authority-A1.2t PACE objective factorization audit", () => {
  it("moves radial progress semantics with explicit radial objective provenance while remaining invariant to directional-only objective changes", async () => {
    const world = await LabWorld.create("open");
    try {
      // Build a real physical state near 1.7 m separation. With a 1.5 m/s
      // player future and 0.5 m/s local alternatives, inward/outward commands
      // can move the relationship toward different radial objective centres.
      for (let step = 0; step < 66; step += 1) {
        world.step([hold("player"), intent("companion", -1)]);
      }
      const snapshot = world.step([hold("player"), hold("companion")]);
      const situation = buildA1Situation({
        snapshot,
        playerIntent: intent("player", -0.5),
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
      const h1 = hypotheses.hypotheses.find((future) => future.family === H1)!;
      const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
      const proposalSet = buildA1ConcreteCommandProposalSet({
        situation,
        interventionPlan,
        localAlternativeDeltaSpeed: 0.5
      });
      const physicalProfiles = proposalSet.proposals.map((proposal) => ({
        proposal,
        profile: buildA1FixedCommandCrossFutureProfile({
          world,
          situation,
          interventionPlan,
          proposal
        })
      }));
      const orientation = evaluateA1RelationshipOrientation({ situation });

      function evaluate(objective: A1RelationshipObjectiveProfile) {
        const utilityProfiles = physicalProfiles.map(({ proposal, profile }) => ({
          proposal,
          utility: buildA1TerminalRelationshipUtilityProfile({
            profile,
            situation,
            orientation,
            objective
          })
        }));
        const initialOffset = utilityProfiles[0]!.utility.initialRelativeOffset;
        const initialRadius = Math.hypot(initialOffset.x, initialOffset.y);
        const preferredRadius = objective.radial.preferredRadius;
        const initialSignedError = initialRadius - preferredRadius;
        const initialAbsoluteError = Math.abs(initialSignedError);
        const rows = utilityProfiles.flatMap(({ proposal, utility }) => {
          const entry = utility.entries.find((candidate) => candidate.futureFamily === H1);
          if (!entry?.relationshipUtility) return [];
          const terminalRadius = entry.relationshipUtility.terminalUtility.radius;
          const terminalSignedError = terminalRadius - preferredRadius;
          const terminalAbsoluteError = Math.abs(terminalSignedError);
          return [{
            proposalId: proposal.proposalId,
            commandVelocity: proposal.commandVelocity,
            initialRadius,
            terminalRadius,
            radiusDelta: terminalRadius - initialRadius,
            initialSignedError,
            terminalSignedError,
            absoluteErrorDelta: terminalAbsoluteError - initialAbsoluteError,
            q: entry.relationshipUtility.terminalUtility.totalUtility
          }];
        });
        const bestDelta = Math.min(...rows.map((row) => row.absoluteErrorDelta));
        const best = rows.filter(
          (row) => Math.abs(row.absoluteErrorDelta - bestDelta) <= BEST_TOLERANCE_METERS
        );
        return { preferredRadius, initialRadius, initialSignedError, bestDelta, best, rows };
      }

      const defaultObjective = evaluate(A1_DEFAULT_RELATIONSHIP_OBJECTIVE);
      const shiftedRadial = evaluate(SHIFTED_RADIAL_OBJECTIVE);
      const lateralDirectional = evaluate(LATERAL_DIRECTIONAL_OBJECTIVE);

      const directionalQChanged = defaultObjective.rows.some((row, index) =>
        Math.abs(row.q - lateralDirectional.rows[index]!.q) > 1e-6
      );
      const progressInvariantToDirectional = defaultObjective.rows.every((row, index) => {
        const lateral = lateralDirectional.rows[index]!;
        return row.proposalId === lateral.proposalId &&
          Math.abs(row.initialSignedError - lateral.initialSignedError) <= 1e-12 &&
          Math.abs(row.terminalSignedError - lateral.terminalSignedError) <= 1e-12 &&
          Math.abs(row.absoluteErrorDelta - lateral.absoluteErrorDelta) <= 1e-12;
      });

      console.log("[A1_2T_PACE_OBJECTIVE_FACTORIZATION]", JSON.stringify({
        horizonSeconds: HORIZON_SECONDS,
        h1StaticFeasibility: h1.staticFeasibility,
        orientation: {
          source: orientation.source,
          direction: orientation.direction,
          strength: orientation.strength
        },
        proposalCount: proposalSet.proposalCount,
        defaultObjective,
        shiftedRadial,
        lateralDirectional,
        directionalQChanged,
        progressInvariantToDirectional
      }));

      expect(h1.staticFeasibility.clipped).toBe(false);
      expect(orientation.source).toBe("SAME_STEP_OWNER");
      expect(orientation.direction).toEqual({ x: -1, y: 0 });
      expect(defaultObjective.rows.length).toBe(proposalSet.proposalCount);
      expect(shiftedRadial.rows.length).toBe(proposalSet.proposalCount);
      expect(lateralDirectional.rows.length).toBe(proposalSet.proposalCount);

      // Same physical state, different explicit radial objective centre:
      // default 1.45 m should prefer relative inward motion, while 2.0 m
      // should prefer relative outward motion.
      expect(defaultObjective.initialRadius).toBeGreaterThan(defaultObjective.preferredRadius);
      expect(shiftedRadial.initialRadius).toBeLessThan(shiftedRadial.preferredRadius);
      expect(defaultObjective.best.some((row) =>
        row.commandVelocity.x < -1.9 && row.commandVelocity.x > -2.1 && Math.abs(row.commandVelocity.y) < 1e-6
      )).toBe(true);
      expect(shiftedRadial.best.some((row) =>
        row.commandVelocity.x < -0.9 && row.commandVelocity.x > -1.1 && Math.abs(row.commandVelocity.y) < 1e-6
      )).toBe(true);
      expect(new Set(defaultObjective.best.map((row) => row.proposalId))).not.toEqual(
        new Set(shiftedRadial.best.map((row) => row.proposalId))
      );

      // Directional semantics may change relationship-quality q, but cannot
      // silently redefine radial PACE when radial objective provenance is the same.
      expect(progressInvariantToDirectional).toBe(true);
      expect(directionalQChanged).toBe(true);
      expect(lateralDirectional.best.map((row) => row.proposalId)).toEqual(
        defaultObjective.best.map((row) => row.proposalId)
      );
    } finally {
      world.dispose();
    }
  });
});
