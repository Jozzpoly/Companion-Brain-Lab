import { describe, expect, it } from "vitest";
import { buildA1CandidateEvidenceCertificateSet } from "./a1-candidate-evidence-certificate";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1FixedCommandRadialPaceProfile } from "./a1-radial-pace-evidence";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  a1RelationshipObjectiveSignature,
  type A1RelationshipObjectiveProfile
} from "./a1-relationship-utility";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";

function playerIntent(): MotionIntent {
  return { actorId: "player", move: { x: 1, y: 0 } };
}

function copyObjective(): A1RelationshipObjectiveProfile {
  const source = A1_DEFAULT_RELATIONSHIP_OBJECTIVE;
  const radial = { ...source.radial };
  if (source.directional.kind === "NONE") return { radial, directional: { kind: "NONE" } };
  if (source.directional.kind === "AVOID_FORWARD_HEMISPHERE") {
    return {
      radial,
      directional: {
        kind: "AVOID_FORWARD_HEMISPHERE",
        weight: source.directional.weight
      }
    };
  }
  return {
    radial,
    directional: {
      kind: "PREFER_BEARING",
      preferredBearingRadians: source.directional.preferredBearingRadians,
      sigmaRadians: source.directional.sigmaRadians,
      weight: source.directional.weight
    }
  };
}

describe("Authority-A1.2v certificate objective provenance isolation", () => {
  it("detaches the stored objective from caller mutation after certification", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.snapshot();
      const situation = buildA1Situation({
        snapshot,
        playerIntent: playerIntent(),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const hypotheses = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: 0.5,
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
        buildA1FixedCommandCrossFutureProfile({
          world,
          situation,
          interventionPlan,
          proposal
        })
      );
      const orientation = evaluateA1RelationshipOrientation({ situation });
      const objective = copyObjective();
      const certifiedObjective = copyObjective();
      const expectedSignature = a1RelationshipObjectiveSignature(certifiedObjective);
      const relationshipProfiles = physicalProfiles.map((profile) =>
        buildA1TerminalRelationshipUtilityProfile({
          profile,
          situation,
          orientation,
          objective
        })
      );
      const relationGraphs = buildA1G4CrossFutureRelationGraphs({
        proposalSet,
        profiles: physicalProfiles
      });
      const research = buildA1CommandRobustnessResearchSet({
        proposalSet,
        physicalProfiles,
        utilityProfiles: relationshipProfiles,
        relationGraphs
      });
      const paceProfiles = physicalProfiles.map((profile) =>
        buildA1FixedCommandRadialPaceProfile({
          profile,
          situation,
          radialObjective: objective.radial
        })
      );
      const certificates = buildA1CandidateEvidenceCertificateSet({
        research,
        relationshipProfiles,
        paceProfiles,
        objective
      });

      objective.radial.preferredRadius = 9;
      objective.radial.sigma = 8;
      objective.radial.weight = 7;
      if (objective.directional.kind === "AVOID_FORWARD_HEMISPHERE") {
        objective.directional.weight = 6;
      }

      expect(certificates.objective).toEqual(certifiedObjective);
      expect(certificates.objectiveSignature).toBe(expectedSignature);
      expect(certificates.certificates.length).toBeGreaterThan(0);
      for (const certificate of certificates.certificates) {
        expect(certificate.objective).toEqual(certifiedObjective);
        expect(certificate.objectiveSignature).toBe(expectedSignature);
        expect(certificate.objective).not.toBe(objective);
      }
      expect(certificates.objective).not.toBe(objective);
      expect(world.snapshot()).toEqual(snapshot);
    } finally {
      world.dispose();
    }
  });
});
