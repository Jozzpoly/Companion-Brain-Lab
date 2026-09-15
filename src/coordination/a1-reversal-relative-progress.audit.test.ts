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
const EPSILON = 1e-6;
// Audit-only materiality bands, not runtime policy. #1041 measured 0.0000286 m
// physical drift for exact equal-speed feed-forward while the next alternatives
// worsened radial error by about 0.099 m or more.
const PHYSICAL_STABILITY_TOLERANCE_METERS = 1e-3;
const MATERIAL_CATCHUP_METERS = 1e-2;
const MATERIAL_WORSENING_METERS = 5e-2;

function intent(actorId: "player" | "companion", x: number): MotionIntent {
  return { actorId, move: { x, y: 0 } };
}

function magnitude(value: { x: number; y: number }): number {
  return Math.hypot(value.x, value.y);
}

describe("Authority-A1.2t reversal relative-progress audit", () => {
  it("tests whether equal-speed deficit contains progress evidence that absolute q utility cannot resolve", async () => {
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

      const initialOffset = utilityProfiles[0]!.initialRelativeOffset;
      const initialRadius = magnitude(initialOffset);
      const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
      const initialRadialError = Math.abs(initialRadius - preferredRadius);

      const rows = utilityProfiles.map((profile) => {
        const proposal = proposalSet.proposals.find((candidate) => candidate.proposalId === profile.proposalId)!;
        const entry = profile.entries.find((candidate) => candidate.futureFamily === H1)!;
        const relationship = entry.relationshipUtility;
        if (!relationship) {
          return {
            proposalId: profile.proposalId,
            commandVelocity: profile.commandVelocity,
            generationOrigins: proposal.generationOrigins,
            status: entry.sourceStatus,
            terminalRadius: null,
            terminalRadialError: null,
            radialErrorDelta: null,
            radialErrorRate: null,
            totalUtility: null
          };
        }
        const terminalRadius = relationship.terminalUtility.radius;
        const terminalRadialError = Math.abs(terminalRadius - preferredRadius);
        const radialErrorDelta = terminalRadialError - initialRadialError;
        return {
          proposalId: profile.proposalId,
          commandVelocity: profile.commandVelocity,
          generationOrigins: proposal.generationOrigins.map((origin) => ({
            futureFamily: origin.futureFamily,
            seedFamily: origin.seedFamily,
            desiredVelocity: origin.desiredVelocity,
            capabilityClipped: origin.capabilityClipped
          })),
          status: entry.sourceStatus,
          terminalRadius,
          terminalRadialError,
          radialErrorDelta,
          radialErrorRate: radialErrorDelta / horizonSeconds,
          totalUtility: relationship.terminalUtility.totalUtility
        };
      });

      const available = rows.filter((row) => row.radialErrorDelta !== null);
      const bestDelta = Math.min(...available.map((row) => row.radialErrorDelta!));
      const worstDelta = Math.max(...available.map((row) => row.radialErrorDelta!));
      const best = available.filter(
        (row) => Math.abs(row.radialErrorDelta! - bestDelta) <= PHYSICAL_STABILITY_TOLERANCE_METERS
      );
      const materiallyStable = available.filter(
        (row) => Math.abs(row.radialErrorDelta!) <= PHYSICAL_STABILITY_TOLERANCE_METERS
      );
      const materialCatchup = available.filter(
        (row) => row.radialErrorDelta! < -MATERIAL_CATCHUP_METERS
      );
      const materiallyWorsening = available.filter(
        (row) => row.radialErrorDelta! > MATERIAL_WORSENING_METERS
      );
      const playerSpeed = magnitude(h1.effectiveVelocity);
      const companionMaxSpeed = situation.situated.companionCapability.maxSpeed;

      console.log("[A1_2T_RELATIVE_PROGRESS]", JSON.stringify({
        horizonSeconds,
        transitionReasons: hypotheses.transitionReasons,
        h1Clipped: h1.staticFeasibility.clipped,
        playerSpeed,
        companionMaxSpeed,
        initialRadius,
        preferredRadius,
        initialRadialError,
        auditMaterialityMeters: {
          physicalStability: PHYSICAL_STABILITY_TOLERANCE_METERS,
          materialCatchup: MATERIAL_CATCHUP_METERS,
          materialWorsening: MATERIAL_WORSENING_METERS
        },
        bestDelta,
        worstDelta,
        bestProposalIds: best.map((row) => row.proposalId),
        materiallyStableProposalIds: materiallyStable.map((row) => row.proposalId),
        materialCatchupProposalIds: materialCatchup.map((row) => row.proposalId),
        materiallyWorseningCount: materiallyWorsening.length,
        rows
      }));

      expect(hypotheses.transitionReasons).toContain("OWNER_REQUEST_REVERSED");
      expect(h1.staticFeasibility.clipped).toBe(false);
      expect(Math.abs(playerSpeed - companionMaxSpeed)).toBeLessThanOrEqual(EPSILON);
      expect(initialRadius).toBeGreaterThan(preferredRadius);
      expect(available.length).toBe(proposalSet.proposalCount);
      expect(materialCatchup).toHaveLength(0);
      expect(bestDelta).toBeLessThanOrEqual(PHYSICAL_STABILITY_TOLERANCE_METERS);
      expect(materiallyStable.length).toBeGreaterThanOrEqual(1);
      expect(materiallyWorsening.length).toBeGreaterThanOrEqual(1);
      expect(materiallyStable.some((row) =>
        Math.abs(row.commandVelocity.x + companionMaxSpeed) <= EPSILON &&
        Math.abs(row.commandVelocity.y) <= EPSILON
      )).toBe(true);
    } finally {
      world.dispose();
    }
  });
});
