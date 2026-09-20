import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
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
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
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

function buildEvidence(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
}) {
  const physicalProfiles = input.decision.proposalSet.proposals.map((proposal) =>
    buildA1FixedCommandCrossFutureProfile({
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
  const research = buildA1CommandRobustnessResearchSet({
    proposalSet: input.decision.proposalSet,
    physicalProfiles,
    utilityProfiles,
    relationGraphs
  });
  return { physicalProfiles, utilityProfiles, relationGraphs, research };
}

function dossier(
  research: ReturnType<typeof buildA1CommandRobustnessResearchSet>,
  proposalId: string
) {
  const value = research.dossiers.find((candidate) => candidate.proposalId === proposalId);
  if (!value) throw new Error(`missing dossier ${proposalId}`);
  return value;
}

function future(
  value: ReturnType<typeof dossier>,
  family: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD"
) {
  const observation = value.futures.find((candidate) => candidate.futureFamily === family);
  if (!observation) throw new Error(`missing ${family} observation for ${value.proposalId}`);
  return observation;
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

describe("Authority-A1.2s0 policy-free command robustness research dossier", () => {
  it("preserves unresolved and absent futures as missing evidence rather than synthetic adverse outcomes", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const before = world.snapshot();
      const { research } = buildEvidence({ world, decision });

      expect(research.proposalIds).toEqual(
        decision.proposalSet.proposals.map((proposal) => proposal.proposalId)
      );
      expect(research.dossiers).toHaveLength(decision.proposalSet.proposalCount);
      for (const value of research.dossiers) {
        expect(value.futures).toHaveLength(3);
        const h2 = future(value, "BODY_RESPONSE_CONTINUATION");
        const h3 = future(value, "TRANSITION_HOLD");
        expect(h2.physicalStatus).toBe("UNRESOLVED");
        expect(h2.relationship.relationshipUtility).toBeNull();
        expect(h2.relationNode.relationStatus).toBe("UNAVAILABLE_PLAYER_FUTURE_UNRESOLVED");
        expect(h3.physicalStatus).toBe("ABSENT");
        expect(h3.relationship.relationshipUtility).toBeNull();
        expect(h3.relationNode.relationStatus).toBe("UNAVAILABLE_PLAYER_FUTURE_ABSENT");
        expect(h2.missingEvidenceMeaning)
          .toBe("PRESERVE_SOURCE_STATUS_NEVER_IMPUTE_SCORE_OR_FAILURE_A1_2S0");
        expect(value.robustnessPolicyClaim).toBe("NONE_RESEARCH_DOSSIER_ONLY_A1_2S0");
        expect(value.voteClaim).toBe("NONE_A1_2S0");
        expect(value.vetoClaim).toBe("NONE_A1_2S0");
        expect(value.scalarScoreClaim).toBe("NONE_A1_2S0");
        expect(value.selectionClaim).toBe("NONE_A1_2S0");
      }
      expect(research.unresolvedMeaningClaim).toBe("MISSING_EVIDENCE_NOT_NEGATIVE_EVIDENCE_A1_2S0");
      expect("winnerProposalId" in research).toBe(false);
      expect("scores" in research).toBe(false);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("keeps three real reversal outcomes separate for one fixed command, including distinct semantic utilities", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const { research } = buildEvidence({ world, decision });
      const value = research.dossiers.find((candidate) =>
        candidate.futures.every((observation) => observation.physicalStatus === "REHEARSED")
      );
      if (!value) throw new Error("expected at least one proposal rehearsed across reversal H1/H2/H3");

      const observations = value.futures;
      expect(new Set(observations.map((observation) => observation.futureId)).size).toBe(3);
      expect(observations.every((observation) => observation.relationship.relationshipUtility !== null)).toBe(true);
      expect(observations.every((observation) =>
        observation.physical.commandVelocity.x === value.commandVelocity.x &&
        observation.physical.commandVelocity.y === value.commandVelocity.y
      )).toBe(true);

      const terminalUtilities = observations.map(
        (observation) => observation.relationship.relationshipUtility!.terminalUtility.totalUtility
      );
      expect(Math.max(...terminalUtilities) - Math.min(...terminalUtilities)).toBeGreaterThan(1e-6);
      expect(value.futureSeparationClaim).toBe("H1_H2_H3_PRESERVED_AS_SEPARATE_OBSERVATIONS_A1_2S0");
      expect("meanUtility" in value).toBe(false);
      expect("worstUtility" in value).toBe(false);
      expect("vote" in value).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("preserves relationship utility and cooperation as separate evidence channels in the qualified head-on case", async () => {
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
      const { research } = buildEvidence({ world, decision });
      const pressureH1 = future(dossier(research, pressure.proposalId), "OWNER_REQUEST_CONTINUATION");
      const tangentH1 = future(dossier(research, tangent.proposalId), "OWNER_REQUEST_CONTINUATION");

      expect(pressureH1.dominatedByProposalIds).toContain(tangent.proposalId);
      expect(tangentH1.preferredOverProposalIds).toContain(pressure.proposalId);
      expect(pressureH1.relationship.relationshipUtility).not.toBeNull();
      expect(tangentH1.relationship.relationshipUtility).not.toBeNull();
      expect(pressureH1.relationNode.relationStatus).toBe("COMPARABLE_G3_REQUIRES_COOPERATION");
      expect(tangentH1.relationNode.relationStatus).toBe("COMPARABLE_G3_PASS");
      expect("combinedScore" in pressureH1).toBe(false);
      expect("combinedScore" in tangentH1).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("preserves forced contention as a relation without converting the component into a winner or veto", async () => {
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
      const { research } = buildEvidence({ world, decision });
      const holdH1 = future(dossier(research, hold.proposalId), "OWNER_REQUEST_CONTINUATION");
      const inwardH1 = future(dossier(research, inward.proposalId), "OWNER_REQUEST_CONTINUATION");

      expect(holdH1.forcedContentionWithProposalIds).toContain(inward.proposalId);
      expect(inwardH1.forcedContentionWithProposalIds).toContain(hold.proposalId);
      expect(holdH1.forcedContentionComponentPeerIds).toContain(inward.proposalId);
      expect(inwardH1.forcedContentionComponentPeerIds).toContain(hold.proposalId);
      expect(holdH1.preferredOverProposalIds).not.toContain(inward.proposalId);
      expect(holdH1.dominatedByProposalIds).not.toContain(inward.proposalId);
      expect(inwardH1.preferredOverProposalIds).not.toContain(hold.proposalId);
      expect(inwardH1.dominatedByProposalIds).not.toContain(hold.proposalId);
    } finally {
      world.dispose();
    }
  });

  it("keeps family provenance descriptive when multiple generation origins collapse to one command dossier", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        localAlternativeDeltaSpeed: 3
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
      expect(hold.proposalId).toBe(inward.proposalId);
      const { research } = buildEvidence({ world, decision });
      const matching = research.dossiers.filter((candidate) => candidate.proposalId === hold.proposalId);
      expect(matching).toHaveLength(1);
      expect(matching[0]!.generationOriginCount).toBeGreaterThan(1);
      expect(matching[0]!.commandIdentityClaim).toBe("A1_2O_PROPOSAL_ID_EXECUTABLE_COMMAND_IDENTITY");
    } finally {
      world.dispose();
    }
  });

  it("rejects incomplete q coverage and relation-graph proposal-order corruption before composing research evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const { physicalProfiles, utilityProfiles, relationGraphs } = buildEvidence({ world, decision });
      expect(utilityProfiles.length).toBeGreaterThan(1);

      expect(() => buildA1CommandRobustnessResearchSet({
        proposalSet: decision.proposalSet,
        physicalProfiles,
        utilityProfiles: utilityProfiles.slice(1),
        relationGraphs
      })).toThrow(/exactly one A1\.2p and one A1\.2q profile per A1\.2o proposal/i);

      expect(() => buildA1CommandRobustnessResearchSet({
        proposalSet: decision.proposalSet,
        physicalProfiles,
        utilityProfiles,
        relationGraphs: {
          ...relationGraphs,
          proposalIds: [...relationGraphs.proposalIds].reverse()
        }
      })).toThrow(/exact A1\.2o proposal ordering\/coverage/i);
    } finally {
      world.dispose();
    }
  });
});
