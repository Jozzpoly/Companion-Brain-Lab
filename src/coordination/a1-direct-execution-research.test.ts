import { describe, expect, it } from "vitest";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import type { A1CompanionCandidateFamily } from "./a1-companion-candidates";
import { buildA1ConcreteCommandProposalSet, type A1ConcreteCommandProposal } from "./a1-concrete-command-proposals";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import {
  buildA1DirectExecutionResearchCapsule,
  closeA1DirectExecutionOutcome
} from "./a1-direct-execution-research";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import {
  buildA1PlayerFutureInterventionPlan,
  type A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";

const HORIZON_SECONDS = 1;
const LOCAL_ALTERNATIVE_DELTA_SPEED = 3;

function intent(actorId: MotionIntent["actorId"], move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function playerIntentFromWorldVelocity(world: LabWorld, velocity: Vec2): MotionIntent {
  const capability = world.actorMovementCapability("player");
  return {
    actorId: "player",
    move: {
      x: velocity.x / capability.maxSpeed,
      y: velocity.y / capability.maxSpeed
    }
  };
}

function proposalWithH1Origin(
  proposals: readonly A1ConcreteCommandProposal[],
  family: A1CompanionCandidateFamily
): A1ConcreteCommandProposal {
  const matches = proposals.filter((proposal) =>
    proposal.generationOrigins.some((origin) =>
      origin.futureFamily === "OWNER_REQUEST_CONTINUATION" && origin.seedFamily === family
    )
  );
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one H1 ${family} concrete proposal, got ${matches.length}.`);
  }
  return matches[0]!;
}

function h1Intervention(
  plan: ReturnType<typeof buildA1PlayerFutureInterventionPlan>
): A1RehearsablePlayerFutureIntervention {
  const value = plan.interventions.find(
    (candidate) => candidate.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (!value || value.status !== "REHEARSABLE") {
    throw new Error("P0 fixture requires a rehearsable H1 intervention.");
  }
  return value;
}

async function advanceIdentically(
  source: LabWorld,
  execution: LabWorld,
  steps: number
): Promise<{ sourceSnapshot: WorldSnapshot; executionSnapshot: WorldSnapshot }> {
  let sourceSnapshot = source.snapshot();
  let executionSnapshot = execution.snapshot();
  const approach = [
    intent("player", { x: 1, y: 0 }),
    intent("companion", { x: -1, y: 0 })
  ];

  for (let index = 0; index < steps; index += 1) {
    sourceSnapshot = source.step(approach);
    executionSnapshot = execution.step(approach);
    expect(executionSnapshot).toEqual(sourceSnapshot);
    expect(execution.latestAuthorityA0StepEvidence()).toEqual(source.latestAuthorityA0StepEvidence());
  }
  return { sourceSnapshot, executionSnapshot };
}

async function runClosureFixture(input: {
  sourceTick: 0 | 8;
  family: A1CompanionCandidateFamily;
}) {
  const source = await LabWorld.create("head-on");
  const execution = await LabWorld.create("head-on");
  try {
    const aligned = await advanceIdentically(source, execution, input.sourceTick);
    expect(aligned.sourceSnapshot.tick).toBe(input.sourceTick);
    expect(aligned.executionSnapshot).toEqual(aligned.sourceSnapshot);

    const sameStepPlayerIntent = intent("player", { x: 1, y: 0 });
    const situation = buildA1Situation({
      snapshot: aligned.sourceSnapshot,
      playerIntent: sameStepPlayerIntent,
      playerCapability: source.actorMovementCapability("player"),
      companionCapability: source.actorMovementCapability("companion"),
      previousWorldStep: source.latestAuthorityA0StepEvidence()
    });
    const hypotheses = buildA1PlayerFutureHypotheses({
      situation,
      horizonSeconds: HORIZON_SECONDS,
      staticTraversal: (from, target, radius, options) =>
        source.staticCircleTraversal(from, target, radius, options)
    });
    const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
    const proposalSet = buildA1ConcreteCommandProposalSet({
      situation,
      interventionPlan,
      localAlternativeDeltaSpeed: LOCAL_ALTERNATIVE_DELTA_SPEED
    });
    const proposal = proposalWithH1Origin(proposalSet.proposals, input.family);
    const h1 = h1Intervention(interventionPlan);

    const sourceBeforeResearch = source.snapshot();
    const sourceA0BeforeResearch = source.latestAuthorityA0StepEvidence();
    const rehearsal = rehearseA1DirectJointPhysicalFuture({
      world: source,
      situation,
      playerIntervention: h1,
      companionRealization: proposal.canonicalRealization
    });
    const capsule = buildA1DirectExecutionResearchCapsule({
      situation,
      proposal,
      companionCapability: source.actorMovementCapability("companion")
    });

    expect(source.snapshot()).toEqual(sourceBeforeResearch);
    expect(source.latestAuthorityA0StepEvidence()).toEqual(sourceA0BeforeResearch);
    expect(capsule.sourceTick).toBe(input.sourceTick);
    expect(capsule.proposalId).toBe(proposal.proposalId);
    expect(capsule.commandVelocity).toEqual(proposal.commandVelocity);
    expect(capsule.commandRepresentationError).toBeLessThanOrEqual(1e-12);
    expect(capsule.selectionClaim).toBe("NONE_CALLER_SUPPLIED_PROPOSAL_P0");
    expect(capsule.liveRuntimeIntegrationClaim).toBe("NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0");
    expect(capsule.runtimeAuthorityClaim).toBe("NONE_P0");

    const executionBefore = execution.snapshot();
    expect(executionBefore).toEqual(sourceBeforeResearch);
    const actualAfter = execution.step([
      playerIntentFromWorldVelocity(execution, h1.repeatedVelocity),
      capsule.motionIntent
    ]);
    const actualA0 = execution.latestAuthorityA0StepEvidence();
    if (!actualA0) throw new Error("P0 isolated execution did not publish A0 evidence.");

    const closure = closeA1DirectExecutionOutcome({
      capsule,
      rehearsal,
      actualAfter,
      actualA0
    });

    expect(source.snapshot()).toEqual(sourceBeforeResearch);
    expect(source.latestAuthorityA0StepEvidence()).toEqual(sourceA0BeforeResearch);
    expect(executionBefore.tick).toBe(input.sourceTick);
    expect(actualAfter.tick).toBe(input.sourceTick + 1);
    expect(actualA0.observationTick).toBe(input.sourceTick);
    expect(actualA0.outcomeTick).toBe(input.sourceTick + 1);
    expect(actualA0.companionVelocityCommand.velocity.x).toBeCloseTo(proposal.commandVelocity.x, 12);
    expect(actualA0.companionVelocityCommand.velocity.y).toBeCloseTo(proposal.commandVelocity.y, 12);
    expect(closure.commandVelocityError).toBeLessThanOrEqual(1e-12);
    expect(closure.disposition).toBe("MATCHED_FIRST_STEP");
    expect(closure.maxNumericStateError).toBeLessThanOrEqual(1e-8);
    expect(closure.actorDeltas.every((delta) => delta.contactsMatch)).toBe(true);
    expect(closure.selectionClaim).toBe("NONE_CALLER_SUPPLIED_PROPOSAL_P0");
    expect(closure.liveRuntimeIntegrationClaim).toBe("NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0");
    expect(closure.runtimeAuthorityClaim).toBe("NONE_P0");

    return { proposal, capsule, closure };
  } finally {
    source.dispose();
    execution.dispose();
  }
}

describe("Authority-A1.2 post-Z4 P0 DIRECT execution/outcome closure", () => {
  it("carries a caller-supplied tick-0 H1 tangent proposal through isolated real execution and A0 without granting authority", async () => {
    const result = await runClosureFixture({
      sourceTick: 0,
      family: "RELATIVE_TANGENT_NEGATIVE"
    });
    expect(result.proposal.generationOrigins.some((origin) =>
      origin.futureFamily === "OWNER_REQUEST_CONTINUATION" &&
      origin.seedFamily === "RELATIVE_TANGENT_NEGATIVE"
    )).toBe(true);
  });

  it("closes a later moving-state H1 MAINTAIN_CURRENT proposal against the same-physics first step", async () => {
    const result = await runClosureFixture({
      sourceTick: 8,
      family: "MAINTAIN_CURRENT"
    });
    expect(Math.hypot(result.proposal.commandVelocity.x, result.proposal.commandVelocity.y)).toBeGreaterThan(0.5);
    expect(result.closure.a0OutcomeAttribution.observationTick).toBe(8);
    expect(result.closure.a0OutcomeAttribution.outcomeTick).toBe(9);
  });

  it("rejects capability provenance drift before producing an execution representation", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: intent("player", { x: 1, y: 0 }),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const hypotheses = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: HORIZON_SECONDS,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
      const proposals = buildA1ConcreteCommandProposalSet({
        situation,
        interventionPlan: plan,
        localAlternativeDeltaSpeed: LOCAL_ALTERNATIVE_DELTA_SPEED
      });
      const proposal = proposalWithH1Origin(proposals.proposals, "RELATIVE_TANGENT_NEGATIVE");
      const capability = world.actorMovementCapability("companion");

      expect(() => buildA1DirectExecutionResearchCapsule({
        situation,
        proposal,
        companionCapability: { ...capability, maxSpeed: capability.maxSpeed + 0.25 }
      })).toThrow(/capability does not align/);
      expect(world.snapshot().tick).toBe(0);
    } finally {
      world.dispose();
    }
  });
});
