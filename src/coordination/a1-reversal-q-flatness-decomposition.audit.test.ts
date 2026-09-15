import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import {
  buildA1FixedCommandCrossFutureProfile,
  type A1FixedCommandCrossFutureProfile
} from "./a1-fixed-command-cross-future-profile";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";

const H1 = "OWNER_REQUEST_CONTINUATION" as const;

function intent(actorId: "player" | "companion", x: number): MotionIntent {
  return { actorId, move: { x, y: 0 } };
}

function spread(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function nullableSpread(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length === values.length ? spread(finite) : null;
}

describe("Authority-A1.2t unclipped reversal q-flatness decomposition", () => {
  it("locates whether H1 command differences disappear in physics, semantic projection or utility", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.step([intent("player", 1), intent("companion", 0)]);
      const situation = buildA1Situation({
        snapshot,
        playerIntent: intent("player", -1),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      const horizonSeconds = 0.5;
      const hypotheses = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const h1 = hypotheses.hypotheses.find((future) => future.family === H1)!;
      const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
      const proposalSet = buildA1ConcreteCommandProposalSet({
        situation,
        interventionPlan,
        localAlternativeDeltaSpeed: 1
      });
      const physicalProfiles: A1FixedCommandCrossFutureProfile[] = proposalSet.proposals.map((proposal) =>
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

      const rows = utilityProfiles.map((profile) => {
        const entry = profile.entries.find((candidate) => candidate.futureFamily === H1)!;
        if (!entry.relationshipUtility) {
          return {
            proposalId: profile.proposalId,
            commandVelocity: profile.commandVelocity,
            status: entry.sourceStatus,
            terminalRelativeOffset: null,
            radius: null,
            radialUtility: null,
            relativeBearingRadians: null,
            frontness: null,
            directionalUtility: null,
            totalUtility: null
          };
        }
        const utility = entry.relationshipUtility.terminalUtility;
        return {
          proposalId: profile.proposalId,
          commandVelocity: profile.commandVelocity,
          status: entry.sourceStatus,
          terminalRelativeOffset: entry.relationshipUtility.terminalRelativeOffset,
          radius: utility.radius,
          radialUtility: utility.radialUtility,
          relativeBearingRadians: utility.relativeBearingRadians,
          frontness: utility.frontness,
          directionalUtility: utility.directionalUtility,
          totalUtility: utility.totalUtility
        };
      });

      const available = rows.filter((row) => row.totalUtility !== null);
      const offsets = available.map((row) => row.terminalRelativeOffset!);
      const metrics = {
        commandVelocityXSpread: spread(available.map((row) => row.commandVelocity.x)),
        commandVelocityYSpread: spread(available.map((row) => row.commandVelocity.y)),
        terminalRelativeXSpread: spread(offsets.map((offset) => offset.x)),
        terminalRelativeYSpread: spread(offsets.map((offset) => offset.y)),
        radiusSpread: spread(available.map((row) => row.radius!)),
        radialUtilitySpread: spread(available.map((row) => row.radialUtility!)),
        relativeBearingSpread: nullableSpread(available.map((row) => row.relativeBearingRadians)),
        frontnessSpread: nullableSpread(available.map((row) => row.frontness)),
        directionalUtilitySpread: nullableSpread(available.map((row) => row.directionalUtility)),
        totalUtilitySpread: spread(available.map((row) => row.totalUtility!))
      };

      console.log("[A1_2T_Q_FLATNESS_DECOMPOSITION]", JSON.stringify({
        horizonSeconds,
        transitionReasons: hypotheses.transitionReasons,
        h1StaticFeasibility: h1.staticFeasibility,
        orientation: {
          source: orientation.source,
          direction: orientation.direction,
          strength: orientation.strength
        },
        initialRelativeOffset: utilityProfiles[0]?.initialRelativeOffset ?? null,
        proposalCount: proposalSet.proposalCount,
        availableCount: available.length,
        metrics,
        rows
      }));

      expect(hypotheses.transitionReasons).toContain("OWNER_REQUEST_REVERSED");
      expect(h1.staticFeasibility.clipped).toBe(false);
      expect(orientation.source).toBe("SAME_STEP_OWNER");
      expect(orientation.direction).toEqual({ x: -1, y: 0 });
      expect(available.length).toBe(proposalSet.proposalCount);
      expect(proposalSet.proposalCount).toBeGreaterThan(1);
      expect(metrics.commandVelocityXSpread + metrics.commandVelocityYSpread).toBeGreaterThan(0);
      expect(metrics.totalUtilitySpread).toBeLessThanOrEqual(1e-9);
    } finally {
      world.dispose();
    }
  });
});
