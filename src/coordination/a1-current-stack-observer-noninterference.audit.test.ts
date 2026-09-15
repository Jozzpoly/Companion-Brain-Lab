import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";
import { buildA1CandidateEvidenceCertificateSet } from "./a1-candidate-evidence-certificate";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1FixedCommandRadialPaceProfile } from "./a1-radial-pace-evidence";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function queryCurrentA12EvidenceStack(
  world: LabWorld,
  decisionSnapshot: ReturnType<LabWorld["snapshot"]>,
  playerMove: Vec2
) {
  const beforeFresh = world.snapshot();
  const previousWorldStep =
    decisionSnapshot.tick === 0 ? null : world.latestAuthorityA0StepEvidence();
  const situation = buildA1Situation({
    snapshot: decisionSnapshot,
    playerIntent: motion("player", playerMove),
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep
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
  const relationshipProfiles = physicalProfiles.map((profile) =>
    buildA1TerminalRelationshipUtilityProfile({
      profile,
      situation,
      orientation,
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
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
      radialObjective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial
    })
  );
  const certificates = buildA1CandidateEvidenceCertificateSet({
    research,
    relationshipProfiles,
    paceProfiles,
    objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
  });

  // Force traversal of the research result so the audit does not merely construct
  // lazy-looking object references and then discard them.
  const evidenceDigest = JSON.stringify({
    hypotheses,
    interventionPlan,
    proposalIds: proposalSet.proposals.map((proposal) => proposal.proposalId),
    profileStatuses: physicalProfiles.map((profile) =>
      profile.entries.map((entry) => [entry.futureFamily, entry.status])
    ),
    relationGraphs,
    certificateCount: certificates.certificates.length,
    objectiveSignature: certificates.objectiveSignature
  });

  expect(evidenceDigest.length).toBeGreaterThan(100);
  expect(world.snapshot()).toEqual(beforeFresh);

  return {
    sourceTick: decisionSnapshot.tick,
    proposalCount: proposalSet.proposalCount,
    certificateCount: certificates.certificates.length
  };
}

function playerMoveForPhase(step: number): Vec2 {
  if (step < 4) return { x: 1, y: 0 };
  if (step < 8) return { x: 0, y: 0 };
  return { x: -1, y: 0 };
}

describe("Authority-A1.2z1 donor-derived observer-query non-interference", () => {
  it("keeps an aggressively queried current-A1.2 World identical to an unobserved live twin", async () => {
    const control = await LabWorld.create("open");
    const observed = await LabWorld.create("open");

    try {
      let controlDecisionSnapshot = control.snapshot();
      let observedDecisionSnapshot = observed.snapshot();

      expect(observedDecisionSnapshot).toEqual(controlDecisionSnapshot);
      expect(observed.snapshot()).toEqual(control.snapshot());
      expect(observed.latestAuthorityA0StepEvidence()).toEqual(control.latestAuthorityA0StepEvidence());

      const observations: Array<{ sourceTick: number; proposalCount: number; certificateCount: number }> = [];

      for (let step = 0; step < 12; step += 1) {
        const playerMove = playerMoveForPhase(step);
        const controlBeforeFresh = control.snapshot();
        const observedBeforeFresh = observed.snapshot();

        expect(observedDecisionSnapshot).toEqual(controlDecisionSnapshot);
        expect(observedBeforeFresh).toEqual(controlBeforeFresh);
        expect(observed.latestAuthorityA0StepEvidence()).toEqual(control.latestAuthorityA0StepEvidence());

        observations.push(
          queryCurrentA12EvidenceStack(observed, observedDecisionSnapshot, playerMove)
        );

        // Re-read the public/current authority surfaces after the expensive research query.
        // These reads are intentionally absent from the control twin.
        expect(observed.snapshot()).toEqual(observedBeforeFresh);
        observed.actorMovementCapability("player");
        observed.actorMovementCapability("companion");
        observed.latestAuthorityA0StepEvidence();
        expect(observed.snapshot()).toEqual(observedBeforeFresh);
        expect(observed.latestAuthorityA0StepEvidence()).toEqual(control.latestAuthorityA0StepEvidence());

        const intents = [
          motion("player", playerMove),
          motion("companion", { x: 0, y: 0 })
        ];
        controlDecisionSnapshot = control.step(intents);
        observedDecisionSnapshot = observed.step(intents);

        expect(observedDecisionSnapshot).toEqual(controlDecisionSnapshot);
        expect(observed.snapshot()).toEqual(control.snapshot());
        expect(observed.latestAuthorityA0StepEvidence()).toEqual(control.latestAuthorityA0StepEvidence());
      }

      expect(observations).toHaveLength(12);
      expect(observations.map((entry) => entry.sourceTick)).toEqual(
        Array.from({ length: 12 }, (_, index) => index)
      );
      expect(observations.every((entry) => entry.proposalCount > 0)).toBe(true);
      expect(observations.every((entry) => entry.certificateCount === entry.proposalCount)).toBe(true);
      expect(observedDecisionSnapshot).toEqual(controlDecisionSnapshot);
      expect(observed.snapshot()).toEqual(control.snapshot());
      expect(observed.latestAuthorityA0StepEvidence()).toEqual(control.latestAuthorityA0StepEvidence());
    } finally {
      control.dispose();
      observed.dispose();
    }
  });
});
