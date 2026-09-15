import { describe, expect, it } from "vitest";
import {
  buildA1CandidateEvidenceCertificateSet,
  type A1CandidateEvidenceCertificateSet
} from "./a1-candidate-evidence-certificate";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import {
  buildA1FixedCommandCrossFutureProfile,
  type A1FixedCommandCrossFutureProfile
} from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1FixedCommandRadialPaceProfile } from "./a1-radial-pace-evidence";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  type A1RelationshipObjectiveProfile
} from "./a1-relationship-utility";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

const DEFAULT_OBJECTIVE = A1_DEFAULT_RELATIONSHIP_OBJECTIVE;

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

function buildSources(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
  objective?: A1RelationshipObjectiveProfile;
  paceRadial?: A1RelationshipObjectiveProfile["radial"];
}) {
  const objective = input.objective ?? DEFAULT_OBJECTIVE;
  const physicalProfiles = input.decision.proposalSet.proposals.map((proposal) =>
    buildA1FixedCommandCrossFutureProfile({
      world: input.world,
      situation: input.decision.situation,
      interventionPlan: input.decision.interventionPlan,
      proposal
    })
  );
  const orientation = evaluateA1RelationshipOrientation({ situation: input.decision.situation });
  const relationshipProfiles = physicalProfiles.map((profile) =>
    buildA1TerminalRelationshipUtilityProfile({
      profile,
      situation: input.decision.situation,
      orientation,
      objective
    })
  );
  const relationGraphs = buildA1G4CrossFutureRelationGraphs({
    proposalSet: input.decision.proposalSet,
    profiles: physicalProfiles
  });
  const research = buildA1CommandRobustnessResearchSet({
    proposalSet: input.decision.proposalSet,
    physicalProfiles,
    utilityProfiles: relationshipProfiles,
    relationGraphs
  });
  const paceProfiles = physicalProfiles.map((profile) =>
    buildA1FixedCommandRadialPaceProfile({
      profile,
      situation: input.decision.situation,
      radialObjective: input.paceRadial ?? objective.radial
    })
  );
  return { objective, physicalProfiles, relationshipProfiles, relationGraphs, research, paceProfiles };
}

function buildCertificate(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
  objective?: A1RelationshipObjectiveProfile;
  paceRadial?: A1RelationshipObjectiveProfile["radial"];
}) {
  const sources = buildSources(input);
  const certificates = buildA1CandidateEvidenceCertificateSet({
    research: sources.research,
    relationshipProfiles: sources.relationshipProfiles,
    paceProfiles: sources.paceProfiles,
    objective: sources.objective
  });
  return { ...sources, certificates };
}

function certificate(set: A1CandidateEvidenceCertificateSet, proposalId: string) {
  const value = set.certificates.find((candidate) => candidate.proposalId === proposalId);
  if (!value) throw new Error(`missing certificate ${proposalId}`);
  return value;
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

function replaceFirstRehearsedTerminalOffset(
  profiles: readonly A1FixedCommandCrossFutureProfile[]
): readonly A1FixedCommandCrossFutureProfile[] {
  const target = profiles.find((profile) => profile.entries.some((entry) => entry.status === "REHEARSED"));
  if (!target) throw new Error("missing rehearsed profile");
  return profiles.map((profile) => profile === target ? {
    ...profile,
    entries: profile.entries.map((entry) => {
      if (entry.status !== "REHEARSED") return entry;
      const frames = entry.rehearsal.physical.frames;
      const last = frames.at(-1);
      if (!last) return entry;
      return {
        ...entry,
        rehearsal: {
          ...entry.rehearsal,
          physical: {
            ...entry.rehearsal.physical,
            frames: [
              ...frames.slice(0, -1),
              {
                ...last,
                actors: last.actors.map((actor) => actor.id === "companion"
                  ? { ...actor, position: { x: actor.position.x + 0.25, y: actor.position.y } }
                  : actor)
              }
            ]
          }
        }
      };
    })
  } : profile);
}

describe("Authority-A1.2v policy-free candidate evidence certificate", () => {
  it("preserves exact proposal/future coverage and missing evidence without inventing a score or winner", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const before = world.snapshot();
      const { certificates } = buildCertificate({ world, decision });

      expect(certificates.proposalIds).toEqual(
        decision.proposalSet.proposals.map((proposal) => proposal.proposalId)
      );
      expect(certificates.certificates).toHaveLength(decision.proposalSet.proposalCount);
      for (const value of certificates.certificates) {
        expect(value.futures).toHaveLength(3);
        const unresolved = value.futures.find((future) => future.futureFamily === "BODY_RESPONSE_CONTINUATION")!;
        const absent = value.futures.find((future) => future.futureFamily === "TRANSITION_HOLD")!;
        expect(unresolved.physicalStatus).toBe("UNRESOLVED");
        expect(unresolved.relationship.relationshipUtility).toBeNull();
        expect(unresolved.radialPace.radialPace).toBeNull();
        expect(unresolved.terminalStateAlignment).toBe("ALIGNED_NON_REHEARSED_MISSING_EVIDENCE_A1_2V");
        expect(absent.physicalStatus).toBe("ABSENT");
        expect(absent.relationship.relationshipUtility).toBeNull();
        expect(absent.radialPace.radialPace).toBeNull();
        expect(value.scalarScoreClaim).toBe("NONE_A1_2V");
        expect(value.weightingClaim).toBe("NONE_A1_2V");
        expect(value.transitiveOrderClaim).toBe("NONE_A1_2V");
        expect(value.selectionClaim).toBe("NONE_CERTIFICATE_ONLY_A1_2V");
        expect("winnerProposalId" in value).toBe(false);
        expect("score" in value).toBe(false);
      }
      expect(certificates.cooperationRepresentationClaim).toBe("RELATIONAL_G4_REMAINS_RELATIONAL_A1_2V");
      expect("winnerProposalId" in certificates).toBe(false);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("proves q and PACE are aligned to the same A1.2p terminal physical state while remaining separate axes", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const { certificates } = buildCertificate({ world, decision });
      const fullyRehearsed = certificates.certificates.find((value) =>
        value.futures.every((future) => future.physicalStatus === "REHEARSED")
      );
      if (!fullyRehearsed) throw new Error("expected a fully rehearsed reversal certificate");

      for (const future of fullyRehearsed.futures) {
        const q = future.relationship.relationshipUtility;
        const pace = future.radialPace.radialPace;
        if (!q || !pace) throw new Error("expected aligned q/PACE evidence");
        expect(q.initialRelativeOffset).toEqual(pace.initialRelativeOffset);
        expect(q.terminalRelativeOffset).toEqual(pace.terminalRelativeOffset);
        expect(q.initialUtility.radius).toBeCloseTo(pace.initialRadius, 12);
        expect(q.terminalUtility.radius).toBeCloseTo(pace.terminalRadius, 12);
        expect(future.terminalStateAlignment).toBe("ALIGNED_SAME_PHYSICS_REHEARSED_TERMINAL_STATE_A1_2V");
      }
      expect(fullyRehearsed.unaryEvidenceClaim).toBe("Q_AND_RADIAL_PACE_PRESERVED_AS_SEPARATE_AXES_A1_2V");
      expect(fullyRehearsed.terminalTruthClaim).toBe("Q_AND_PACE_SHARE_A1_2P_SAME_PHYSICS_TERMINAL_STATE_A1_2V");
    } finally {
      world.dispose();
    }
  });

  it("retains G4 as pairwise relational evidence rather than converting cooperation into a candidate scalar", async () => {
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
      const { certificates } = buildCertificate({ world, decision });
      const pressureH1 = certificate(certificates, pressure.proposalId).futures.find(
        (future) => future.futureFamily === "OWNER_REQUEST_CONTINUATION"
      )!;
      const tangentH1 = certificate(certificates, tangent.proposalId).futures.find(
        (future) => future.futureFamily === "OWNER_REQUEST_CONTINUATION"
      )!;

      expect(pressureH1.robustness.dominatedByProposalIds).toContain(tangent.proposalId);
      expect(tangentH1.robustness.preferredOverProposalIds).toContain(pressure.proposalId);
      expect(pressureH1.cooperationRepresentationClaim)
        .toBe("PAIRWISE_RELATIONS_RETAINED_IN_A1_2S0_SOURCE_NOT_SCALARIZED_A1_2V");
      expect("cooperationScore" in pressureH1).toBe(false);
      expect("cooperationScore" in tangentH1).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("rejects objective-provenance mismatch between q and PACE before composing a certificate", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const sources = buildSources({
        world,
        decision,
        objective: DEFAULT_OBJECTIVE,
        paceRadial: { ...DEFAULT_OBJECTIVE.radial, preferredRadius: 2 }
      });
      expect(() => buildA1CandidateEvidenceCertificateSet({
        research: sources.research,
        relationshipProfiles: sources.relationshipProfiles,
        paceProfiles: sources.paceProfiles,
        objective: DEFAULT_OBJECTIVE
      })).toThrow(/PACE radial objective does not match the explicit certificate objective/i);

      const alteredObjective: A1RelationshipObjectiveProfile = {
        radial: { ...DEFAULT_OBJECTIVE.radial },
        directional: { kind: "NONE" }
      };
      const aligned = buildSources({ world, decision, objective: DEFAULT_OBJECTIVE });
      expect(() => buildA1CandidateEvidenceCertificateSet({
        research: aligned.research,
        relationshipProfiles: aligned.relationshipProfiles,
        paceProfiles: aligned.paceProfiles,
        objective: alteredObjective
      })).toThrow(/q objective signature does not match the explicit certificate objective/i);
    } finally {
      world.dispose();
    }
  });

  it("rejects q/PACE terminal-state mismatch instead of silently composing evidence from different physical truths", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const sources = buildSources({ world, decision });
      const forgedPhysical = replaceFirstRehearsedTerminalOffset(sources.physicalProfiles);
      const forgedPace = forgedPhysical.map((profile) =>
        buildA1FixedCommandRadialPaceProfile({
          profile,
          situation: decision.situation,
          radialObjective: DEFAULT_OBJECTIVE.radial
        })
      );

      expect(() => buildA1CandidateEvidenceCertificateSet({
        research: sources.research,
        relationshipProfiles: sources.relationshipProfiles,
        paceProfiles: forgedPace,
        objective: DEFAULT_OBJECTIVE
      })).toThrow(/q and PACE do not share the same physical relative state/i);
    } finally {
      world.dispose();
    }
  });
});
