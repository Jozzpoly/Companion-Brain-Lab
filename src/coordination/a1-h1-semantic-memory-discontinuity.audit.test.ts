import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";
import { buildA1Situation } from "./a1-situation";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import {
  A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED,
  evaluateA1H1PrimaryShadowHorizon
} from "./a1-h1-primary-shadow";

function player(move: { x: number; y: number }): MotionIntent {
  return { actorId: "player", move };
}

function companion(move: { x: number; y: number }): MotionIntent {
  return { actorId: "companion", move };
}

function h1Q(profile: ReturnType<typeof buildA1TerminalRelationshipUtilityProfile>): number | null {
  const entry = profile.entries.find((candidate) =>
    candidate.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  return entry?.relationshipUtility?.terminalUtility.totalUtility ?? null;
}

describe("A1 H1 semantic-memory contract regression", () => {
  it("fails closed without inactive-control semantic evidence and preserves explicit Owner memory in H1 q", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const initialSituation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: player({ x: 1, y: 0 }),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const initialOrientation = evaluateA1RelationshipOrientation({ situation: initialSituation });
      expect(initialOrientation.source).toBe("SAME_STEP_OWNER");
      expect(initialOrientation.direction).toEqual({ x: 1, y: 0 });
      expect(initialOrientation.nextMemory).not.toBeNull();

      const snapshot = world.step([
        player({ x: 1, y: 0 }),
        companion({ x: 0, y: 0 })
      ]);
      const situation = buildA1Situation({
        snapshot,
        playerIntent: player({ x: 0, y: 0 }),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });

      const remembered = evaluateA1RelationshipOrientation({
        situation,
        memory: initialOrientation.nextMemory
      });
      const explicitNone = evaluateA1RelationshipOrientation({ situation });

      expect(remembered.source).toBe("OWNER_MEMORY");
      expect(remembered.direction).toEqual({ x: 1, y: 0 });
      expect(remembered.ageTicks).toBe(1);
      expect(remembered.strength).toBeGreaterThan(0.99);
      expect(explicitNone.source).toBe("NONE");
      expect(explicitNone.direction).toBeNull();

      const horizonSeconds = 1;
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
        localAlternativeDeltaSpeed: A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED
      });
      const physicalProfiles = proposalSet.proposals.map((proposal) =>
        buildA1FixedCommandCrossFutureProfile({
          world,
          situation,
          interventionPlan,
          proposal
        })
      );
      const rememberedProfiles = physicalProfiles.map((profile) =>
        buildA1TerminalRelationshipUtilityProfile({
          profile,
          situation,
          orientation: remembered,
          objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
        })
      );
      const directionlessProfiles = physicalProfiles.map((profile) =>
        buildA1TerminalRelationshipUtilityProfile({
          profile,
          situation,
          orientation: explicitNone,
          objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
        })
      );

      expect(rememberedProfiles.every((profile) => profile.orientationSource === "OWNER_MEMORY")).toBe(true);
      expect(directionlessProfiles.every((profile) => profile.orientationSource === "NONE")).toBe(true);

      expect(() => evaluateA1H1PrimaryShadowHorizon({
        world,
        situation,
        horizonSeconds
      })).toThrow(/requires explicit relationship orientation evidence when same-step Owner control is inactive/);

      const rememberedH1 = evaluateA1H1PrimaryShadowHorizon({
        world,
        situation,
        horizonSeconds,
        orientation: remembered
      });
      const directionlessH1 = evaluateA1H1PrimaryShadowHorizon({
        world,
        situation,
        horizonSeconds,
        orientation: explicitNone
      });

      const rememberedRows = rememberedH1.stageTrace.proposals.filter((row) =>
        row.comparisonEligible && row.q !== null
      );
      const directionlessRows = directionlessH1.stageTrace.proposals.filter((row) =>
        row.comparisonEligible && row.q !== null
      );
      expect(rememberedRows.length).toBeGreaterThan(0);
      expect(directionlessRows.map((row) => row.proposalId)).toEqual(
        rememberedRows.map((row) => row.proposalId)
      );

      let materiallyDifferentCount = 0;
      const evidence = rememberedRows.map((row) => {
        const directionlessRow = directionlessRows.find((candidate) => candidate.proposalId === row.proposalId);
        const rememberedProfile = rememberedProfiles.find((profile) => profile.proposalId === row.proposalId);
        const directionlessProfile = directionlessProfiles.find((profile) => profile.proposalId === row.proposalId);
        expect(directionlessRow).toBeDefined();
        expect(rememberedProfile).toBeDefined();
        expect(directionlessProfile).toBeDefined();
        if (!directionlessRow || !rememberedProfile || !directionlessProfile || row.q === null || directionlessRow.q === null) {
          throw new Error(`H1 semantic-memory regression lost proposal ${row.proposalId}.`);
        }

        const rememberedQ = h1Q(rememberedProfile);
        const directionlessQ = h1Q(directionlessProfile);
        expect(rememberedQ).not.toBeNull();
        expect(directionlessQ).not.toBeNull();
        if (rememberedQ === null || directionlessQ === null) {
          throw new Error(`H1 semantic-memory regression lost H1 utility for ${row.proposalId}.`);
        }

        expect(row.q).toBeCloseTo(rememberedQ, 12);
        expect(directionlessRow.q).toBeCloseTo(directionlessQ, 12);
        const semanticDelta = Math.abs(rememberedQ - directionlessQ);
        if (semanticDelta > 1e-4) materiallyDifferentCount += 1;
        return {
          proposalId: row.proposalId,
          rememberedTraceQ: row.q,
          directionlessTraceQ: directionlessRow.q,
          rememberedQ,
          directionlessQ,
          semanticDelta
        };
      });

      expect(materiallyDifferentCount).toBeGreaterThan(0);

      console.info("[A1_H1_SEMANTIC_MEMORY_CONTRACT_REGRESSION]", JSON.stringify({
        sourceTick: situation.tick,
        rememberedOrientation: {
          source: remembered.source,
          sourceTick: remembered.sourceTick,
          ageTicks: remembered.ageTicks,
          strength: remembered.strength,
          direction: remembered.direction
        },
        explicitDirectionlessOrientation: {
          source: explicitNone.source,
          direction: explicitNone.direction,
          strength: explicitNone.strength
        },
        comparableProposalCount: rememberedRows.length,
        materiallyDifferentCount,
        proposalEvidence: evidence,
        interpretation: {
          omittedInactiveControlEvidenceFailsClosed: true,
          explicitOwnerMemoryControlsH1Utility: true,
          explicitNoneRemainsAvailableWhenSemanticallyJustified: true,
          semanticMemoryLossCanNoLongerOccurByOmission: true
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
