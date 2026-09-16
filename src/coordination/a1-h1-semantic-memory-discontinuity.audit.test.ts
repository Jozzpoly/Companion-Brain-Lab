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

describe("A1 H1 semantic-memory discontinuity audit", () => {
  it("shows H1 q matching directionless semantics when A1 Owner memory is still live", async () => {
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
      const forgotten = evaluateA1RelationshipOrientation({ situation });

      expect(remembered.source).toBe("OWNER_MEMORY");
      expect(remembered.direction).toEqual({ x: 1, y: 0 });
      expect(remembered.ageTicks).toBe(1);
      expect(remembered.strength).toBeGreaterThan(0.99);
      expect(forgotten.source).toBe("NONE");
      expect(forgotten.direction).toBeNull();

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
      const forgottenProfiles = physicalProfiles.map((profile) =>
        buildA1TerminalRelationshipUtilityProfile({
          profile,
          situation,
          orientation: forgotten,
          objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
        })
      );

      expect(rememberedProfiles.every((profile) => profile.orientationSource === "OWNER_MEMORY")).toBe(true);
      expect(forgottenProfiles.every((profile) => profile.orientationSource === "NONE")).toBe(true);

      const h1 = evaluateA1H1PrimaryShadowHorizon({
        world,
        situation,
        horizonSeconds
      });
      const traceRows = h1.stageTrace.proposals.filter((row) =>
        row.comparisonEligible && row.q !== null
      );
      expect(traceRows.length).toBeGreaterThan(0);

      let materiallyDifferentCount = 0;
      const evidence = traceRows.map((row) => {
        const rememberedProfile = rememberedProfiles.find((profile) => profile.proposalId === row.proposalId);
        const forgottenProfile = forgottenProfiles.find((profile) => profile.proposalId === row.proposalId);
        expect(rememberedProfile).toBeDefined();
        expect(forgottenProfile).toBeDefined();
        if (!rememberedProfile || !forgottenProfile || row.q === null) {
          throw new Error(`H1 semantic-memory audit lost proposal ${row.proposalId}.`);
        }

        const rememberedQ = h1Q(rememberedProfile);
        const forgottenQ = h1Q(forgottenProfile);
        expect(rememberedQ).not.toBeNull();
        expect(forgottenQ).not.toBeNull();
        if (rememberedQ === null || forgottenQ === null) {
          throw new Error(`H1 semantic-memory audit lost H1 utility for ${row.proposalId}.`);
        }

        expect(row.q).toBeCloseTo(forgottenQ, 12);
        const semanticDelta = Math.abs(rememberedQ - forgottenQ);
        if (semanticDelta > 1e-4) materiallyDifferentCount += 1;
        return {
          proposalId: row.proposalId,
          h1TraceQ: row.q,
          rememberedQ,
          directionlessQ: forgottenQ,
          semanticDelta
        };
      });

      expect(materiallyDifferentCount).toBeGreaterThan(0);

      console.info("[A1_H1_SEMANTIC_MEMORY_DISCONTINUITY]", JSON.stringify({
        sourceTick: situation.tick,
        rememberedOrientation: {
          source: remembered.source,
          sourceTick: remembered.sourceTick,
          ageTicks: remembered.ageTicks,
          strength: remembered.strength,
          direction: remembered.direction
        },
        h1CallerOrientationWithoutMemory: {
          source: forgotten.source,
          direction: forgotten.direction,
          strength: forgotten.strength
        },
        comparableProposalCount: traceRows.length,
        materiallyDifferentCount,
        proposalEvidence: evidence,
        interpretation: {
          a1ObserverCanRetainOwnerSemanticsWhileH1ForgetsThem: true,
          h1QCurrentlyMatchesDirectionlessUtility: true,
          semanticMemoryLossCanChangeCounterfactualUtility: true
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
