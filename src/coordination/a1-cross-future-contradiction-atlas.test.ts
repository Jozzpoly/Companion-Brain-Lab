import { describe, expect, it } from "vitest";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1CrossFutureContradictionAtlas } from "./a1-cross-future-contradiction-atlas";
import {
  buildA1FixedCommandCrossFutureProfile,
  type A1FixedCommandCrossFutureProfile
} from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
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
  const hypotheses = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation,
    interventionPlan,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed ?? 1
  });
  return { situation, interventionPlan, proposalSet };
}

function buildResearch(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
}) {
  const physicalProfiles: A1FixedCommandCrossFutureProfile[] = input.decision.proposalSet.proposals.map(
    (proposal) => buildA1FixedCommandCrossFutureProfile({
      world: input.world,
      situation: input.decision.situation,
      interventionPlan: input.decision.interventionPlan,
      proposal
    })
  );
  const orientation = evaluateA1RelationshipOrientation({ situation: input.decision.situation });
  const utilityProfiles = physicalProfiles.map((profile) =>
    buildA1TerminalRelationshipUtilityProfile({
      profile,
      situation: input.decision.situation,
      orientation,
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
    })
  );
  const relationGraphs = buildA1G4CrossFutureRelationGraphs({
    proposalSet: input.decision.proposalSet,
    profiles: physicalProfiles
  });
  return buildA1CommandRobustnessResearchSet({
    proposalSet: input.decision.proposalSet,
    physicalProfiles,
    utilityProfiles,
    relationGraphs
  });
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
  if (!proposal) throw new Error(`missing ${input.futureFamily}/${input.seedFamily} proposal`);
  return proposal;
}

function pairFor(
  atlas: ReturnType<typeof buildA1CrossFutureContradictionAtlas>,
  a: string,
  b: string
) {
  const pair = atlas.pairs.find((candidate) =>
    (candidate.proposalAId === a && candidate.proposalBId === b) ||
    (candidate.proposalAId === b && candidate.proposalBId === a)
  );
  if (!pair) throw new Error(`missing pair ${a}/${b}`);
  return pair;
}

function future(
  pair: ReturnType<typeof pairFor>,
  family: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD"
) {
  const value = pair.observations.find((observation) => observation.futureFamily === family);
  if (!value) throw new Error(`missing ${family} pair observation`);
  return value;
}

function utilityDiscriminates(order: string): boolean {
  return order === "A_HIGHER" || order === "B_HIGHER";
}

function cooperationDiscriminates(relation: string): boolean {
  return relation === "A_PREFERRED" || relation === "B_PREFERRED";
}

function decisionInformation(atlas: ReturnType<typeof buildA1CrossFutureContradictionAtlas>) {
  const ownerUtilityDiscriminatingPairs = atlas.pairs.filter((pair) =>
    utilityDiscriminates(pair.ownerUtilityOrder)
  );
  const ownerUtilityEqualPairs = atlas.pairs.filter((pair) => pair.ownerUtilityOrder === "EQUAL");
  const ownerCooperationDiscriminatingPairs = atlas.pairs.filter((pair) =>
    cooperationDiscriminates(pair.ownerCooperationRelation)
  );
  const alternateUtilityDiscriminatesWhenOwnerEqual = atlas.pairs.filter((pair) =>
    pair.ownerUtilityOrder === "EQUAL" && pair.observations.some((observation) =>
      observation.futureFamily !== "OWNER_REQUEST_CONTINUATION" &&
      utilityDiscriminates(observation.utilityOrder)
    )
  );
  return {
    ownerUtilityDiscriminatingPairs,
    ownerUtilityEqualPairs,
    ownerCooperationDiscriminatingPairs,
    alternateUtilityDiscriminatesWhenOwnerEqual
  };
}

describe("Authority-A1.2s1 cross-future contradiction atlas", () => {
  it("preserves missing H2/H3 evidence instead of manufacturing votes or adverse outcomes", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const research = buildResearch({ world, decision });
      const atlas = buildA1CrossFutureContradictionAtlas(research);
      const expectedPairs = research.dossiers.length * (research.dossiers.length - 1) / 2;

      expect(atlas.pairCount).toBe(expectedPairs);
      expect(atlas.proposalIds).toEqual(research.proposalIds);
      for (const pair of atlas.pairs) {
        expect(pair.observations).toHaveLength(3);
        expect(future(pair, "OWNER_REQUEST_CONTINUATION").role)
          .toBe("OWNER_REQUEST_PRIMARY_COUNTERFACTUAL");
        expect(future(pair, "BODY_RESPONSE_CONTINUATION").role)
          .toBe("BODY_RESPONSE_DIAGNOSTIC_COUNTERFACTUAL");
        expect(future(pair, "TRANSITION_HOLD").role)
          .toBe("TRANSITION_HOLD_DIAGNOSTIC_COUNTERFACTUAL");
        expect(future(pair, "BODY_RESPONSE_CONTINUATION").utilityOrder).toBe("UNAVAILABLE");
        expect(future(pair, "TRANSITION_HOLD").utilityOrder).toBe("UNAVAILABLE");
        expect(pair.missingUtilityFutureFamilies).toEqual([
          "BODY_RESPONSE_CONTINUATION",
          "TRANSITION_HOLD"
        ]);
        expect(pair.weightingClaim).toBe("NONE_A1_2S1");
        expect(pair.voteClaim).toBe("NONE_A1_2S1");
        expect(pair.vetoClaim).toBe("NONE_A1_2S1");
        expect(pair.worstCaseClaim).toBe("NONE_A1_2S1");
      }
      expect("winnerProposalId" in atlas).toBe(false);
      expect("scores" in atlas).toBe(false);
      expect("votes" in atlas).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("records the reversal decision-information gap instead of fabricating an Owner-vs-alternate conflict", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const atlas = buildA1CrossFutureContradictionAtlas(buildResearch({ world, decision }));
      const info = decisionInformation(atlas);

      expect(info.ownerUtilityDiscriminatingPairs).toHaveLength(0);
      expect(info.ownerUtilityEqualPairs).toHaveLength(atlas.pairCount);
      expect(info.ownerCooperationDiscriminatingPairs).toHaveLength(0);
      expect(info.alternateUtilityDiscriminatesWhenOwnerEqual.length).toBeGreaterThan(0);
      expect(atlas.pairs.some((pair) => pair.hasOwnerAlternateUtilityPreferenceConflict)).toBe(false);
      expect(atlas.pairs.every((pair) => pair.ownerCooperationRelation === "NO_PREFERENCE")).toBe(true);
      expect(atlas.weightingClaim).toBe("NONE_A1_2S1");
      expect(atlas.selectionClaim).toBe("NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1");
    } finally {
      world.dispose();
    }
  });

  it("characterizes whether reversal H1 decision information appears at longer bounded horizons", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const horizons = [0.5, 1, 1.5] as const;
      const characterization = horizons.map((horizonSeconds) => {
        const decision = buildDecision({
          world,
          playerMove: { x: -1, y: 0 },
          snapshot: after,
          horizonSeconds
        });
        const atlas = buildA1CrossFutureContradictionAtlas(buildResearch({ world, decision }));
        const info = decisionInformation(atlas);
        return {
          horizonSeconds,
          proposalCount: decision.proposalSet.proposalCount,
          pairCount: atlas.pairCount,
          ownerUtilityDiscriminatingPairCount: info.ownerUtilityDiscriminatingPairs.length,
          ownerUtilityEqualPairCount: info.ownerUtilityEqualPairs.length,
          ownerCooperationDiscriminatingPairCount: info.ownerCooperationDiscriminatingPairs.length,
          alternateUtilityDiscriminatesWhenOwnerEqualPairCount:
            info.alternateUtilityDiscriminatesWhenOwnerEqual.length
        };
      });

      console.log("[A1_2S1_INFO] reversal-horizon-decision-information", JSON.stringify(characterization));
      expect(characterization).toHaveLength(3);
      expect(characterization[0]!.horizonSeconds).toBe(0.5);
      expect(characterization[0]!.ownerUtilityDiscriminatingPairCount).toBe(0);
      expect(characterization[0]!.ownerUtilityEqualPairCount).toBe(characterization[0]!.pairCount);
      expect(characterization[0]!.alternateUtilityDiscriminatesWhenOwnerEqualPairCount).toBeGreaterThan(0);
      expect(characterization.every((entry) => entry.pairCount >= 0)).toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("retains qualified head-on G4 preference without turning it into a cross-future winner", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        localAlternativeDeltaSpeed: 3
      });
      const pressure = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_RADIAL_INWARD"
      });
      const tangent = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_TANGENT_POSITIVE"
      });
      const atlas = buildA1CrossFutureContradictionAtlas(buildResearch({ world, decision }));
      const pair = pairFor(atlas, pressure.proposalId, tangent.proposalId);
      const h1 = future(pair, "OWNER_REQUEST_CONTINUATION");
      const tangentIsA = pair.proposalAId === tangent.proposalId;

      expect(h1.cooperationRelation).toBe(tangentIsA ? "A_PREFERRED" : "B_PREFERRED");
      expect(h1.utilityOrder).not.toBe("UNAVAILABLE");
      expect(pair.weightingClaim).toBe("NONE_A1_2S1");
      expect(pair.selectionClaim).toBe("NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1");
      expect("winnerProposalId" in pair).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("retains bounded forced contention as unordered conflict rather than preference or veto", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1.5,
        localAlternativeDeltaSpeed: 2
      });
      const hold = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "HOLD"
      });
      const inward = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_RADIAL_INWARD"
      });
      expect(hold.proposalId).not.toBe(inward.proposalId);
      const atlas = buildA1CrossFutureContradictionAtlas(buildResearch({ world, decision }));
      const pair = pairFor(atlas, hold.proposalId, inward.proposalId);
      const h1 = future(pair, "OWNER_REQUEST_CONTINUATION");

      expect(h1.cooperationRelation).toBe("FORCED_CONTENTION");
      expect(["A_PREFERRED", "B_PREFERRED"]).not.toContain(h1.cooperationRelation);
      expect(pair.vetoClaim).toBe("NONE_A1_2S1");
      expect(pair.selectionClaim).toBe("NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1");
    } finally {
      world.dispose();
    }
  });

  it("rejects corrupted s0 dossier ordering before deriving contradiction evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const research = buildResearch({ world, decision });
      expect(research.proposalIds.length).toBeGreaterThan(1);

      expect(() => buildA1CrossFutureContradictionAtlas({
        ...research,
        proposalIds: [...research.proposalIds].reverse()
      })).toThrow(/exact ordered A1\.2s0 dossier coverage/i);
    } finally {
      world.dispose();
    }
  });
});
