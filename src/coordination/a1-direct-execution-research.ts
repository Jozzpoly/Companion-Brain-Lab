import type { MovementCapability } from "../world/movement-capability";
import type { AuthorityA0WorldStepEvidence } from "../world/authority-a0-step-evidence";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import type { A1ConcreteCommandProposal } from "./a1-concrete-command-proposals";
import type { A1DirectJointPhysicalRehearsal } from "./a1-direct-joint-physical-rehearsal";
import type { A1Situation } from "./a1-situation";

const ALIGNMENT_EPSILON = 1e-9;
const OUTCOME_MATCH_EPSILON = 1e-8;

export interface A1DirectExecutionResearchCapsule {
  kind: "A1_DIRECT_EXECUTION_RESEARCH_CAPSULE";
  sourceTick: number;
  proposalId: string;
  horizonSeconds: number;
  commandVelocity: Vec2;
  capabilityMaxSpeed: number;
  motionIntent: MotionIntent;
  commandRepresentationError: number;
  proposalIdentityClaim: "CALLER_SUPPLIED_A1_2O_PROPOSAL_P0";
  executionRepresentationClaim: "DIRECT_MOTION_INTENT_EQUIVALENT_WORLD_VELOCITY_P0";
  selectionClaim: "NONE_CALLER_SUPPLIED_PROPOSAL_P0";
  liveRuntimeIntegrationClaim: "NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0";
  runtimeAuthorityClaim: "NONE_P0";
}

export interface A1DirectExecutionActorOutcomeDelta {
  actorId: ActorSnapshot["id"];
  positionError: number;
  requestedVelocityError: number;
  actualVelocityError: number;
  motionErrorDelta: number;
  contactsMatch: boolean;
}

export interface A1DirectExecutionOutcomeClosure {
  kind: "A1_DIRECT_EXECUTION_OUTCOME_CLOSURE";
  sourceTick: number;
  outcomeTick: number;
  proposalId: string;
  commandVelocity: Vec2;
  a0CommandVelocity: Vec2;
  commandVelocityError: number;
  predictedFirstStepSource: "A1_SAME_PHYSICS_H1_REHEARSAL_FIRST_STEP";
  actorDeltas: readonly A1DirectExecutionActorOutcomeDelta[];
  maxNumericStateError: number;
  disposition: "MATCHED_FIRST_STEP" | "DIVERGED_FIRST_STEP";
  a0OutcomeAttribution: AuthorityA0WorldStepEvidence["companionOutcomeAttribution"];
  selectionClaim: "NONE_CALLER_SUPPLIED_PROPOSAL_P0";
  liveRuntimeIntegrationClaim: "NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0";
  runtimeAuthorityClaim: "NONE_P0";
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`P0 execution outcome is missing ${id}.`);
  return value;
}

function contactSignature(value: ActorSnapshot): string {
  return JSON.stringify(
    [...value.contacts]
      .map((contact) => ({ with: contact.with, contactCount: contact.contactCount }))
      .sort((a, b) => a.with.localeCompare(b.with) || a.contactCount - b.contactCount)
  );
}

function cloneAttribution(
  value: AuthorityA0WorldStepEvidence["companionOutcomeAttribution"]
): AuthorityA0WorldStepEvidence["companionOutcomeAttribution"] {
  return {
    ...value,
    contacts: [...value.contacts]
  };
}

/**
 * P0 is deliberately not a selector or live actuator. It converts one
 * caller-supplied, already-qualified A1.2o DIRECT proposal into the exact
 * MotionIntent representation that an isolated real World step would consume.
 */
export function buildA1DirectExecutionResearchCapsule(input: {
  situation: A1Situation;
  proposal: A1ConcreteCommandProposal;
  companionCapability: MovementCapability;
}): A1DirectExecutionResearchCapsule {
  const { situation, proposal, companionCapability } = input;

  if (proposal.kind !== "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL") {
    throw new Error("P0 requires a qualified A1.2o concrete DIRECT command proposal.");
  }
  if (proposal.commandIdentityClaim !== "EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME_A1_2O") {
    throw new Error("P0 requires the qualified A1.2o executable command-identity boundary.");
  }
  if (
    proposal.physicsExecutionClaim !== "NONE_A1_2O_GENERATION_ONLY" ||
    proposal.selectionClaim !== "NONE_A1_2O" ||
    proposal.runtimeAuthorityClaim !== "NONE_A1_2O"
  ) {
    throw new Error("P0 refuses an A1.2o proposal that already claims execution, selection or runtime authority.");
  }
  if (
    situation.tick !== proposal.sourceTick ||
    situation.situated.tick !== situation.tick ||
    situation.situated.companionCapability.actorId !== "companion"
  ) {
    throw new Error("P0 situation and proposal source ticks/capability identity are misaligned.");
  }
  if (companionCapability.actorId !== "companion") {
    throw new Error("P0 requires companion MovementCapability truth.");
  }
  if (
    !Number.isFinite(companionCapability.maxSpeed) ||
    companionCapability.maxSpeed <= 0 ||
    Math.abs(companionCapability.maxSpeed - situation.situated.companionCapability.maxSpeed) > ALIGNMENT_EPSILON ||
    Math.abs(companionCapability.maxSpeed - proposal.canonicalRealization.capabilityMaxSpeed) > ALIGNMENT_EPSILON
  ) {
    throw new Error("P0 companion capability does not align with situation/proposal provenance.");
  }

  const commandVelocity = finiteVector(proposal.commandVelocity, "P0 proposal command velocity");
  if (vectorDistance(commandVelocity, proposal.canonicalRealization.commandVelocity) > ALIGNMENT_EPSILON) {
    throw new Error("P0 proposal canonical realization changed executable command velocity.");
  }
  if (magnitude(commandVelocity) > companionCapability.maxSpeed + ALIGNMENT_EPSILON) {
    throw new Error("P0 refuses a proposal outside companion DIRECT command capability.");
  }

  const motionIntent: MotionIntent = {
    actorId: "companion",
    move: {
      x: commandVelocity.x / companionCapability.maxSpeed,
      y: commandVelocity.y / companionCapability.maxSpeed
    }
  };
  const reconstructedVelocity = {
    x: motionIntent.move.x * companionCapability.maxSpeed,
    y: motionIntent.move.y * companionCapability.maxSpeed
  };
  const commandRepresentationError = vectorDistance(commandVelocity, reconstructedVelocity);
  if (commandRepresentationError > ALIGNMENT_EPSILON) {
    throw new Error(`P0 MotionIntent representation changed command velocity by ${commandRepresentationError}.`);
  }

  return {
    kind: "A1_DIRECT_EXECUTION_RESEARCH_CAPSULE",
    sourceTick: proposal.sourceTick,
    proposalId: proposal.proposalId,
    horizonSeconds: proposal.horizonSeconds,
    commandVelocity,
    capabilityMaxSpeed: companionCapability.maxSpeed,
    motionIntent,
    commandRepresentationError,
    proposalIdentityClaim: "CALLER_SUPPLIED_A1_2O_PROPOSAL_P0",
    executionRepresentationClaim: "DIRECT_MOTION_INTENT_EQUIVALENT_WORLD_VELOCITY_P0",
    selectionClaim: "NONE_CALLER_SUPPLIED_PROPOSAL_P0",
    liveRuntimeIntegrationClaim: "NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0",
    runtimeAuthorityClaim: "NONE_P0"
  };
}

/**
 * Closes one caller-supplied proposal against an isolated real World step.
 * The function only compares already-produced evidence; it does not execute the
 * World, choose a proposal, alter A1 runtime state or reinterpret A0 causality.
 */
export function closeA1DirectExecutionOutcome(input: {
  capsule: A1DirectExecutionResearchCapsule;
  rehearsal: A1DirectJointPhysicalRehearsal;
  actualAfter: WorldSnapshot;
  actualA0: AuthorityA0WorldStepEvidence;
}): A1DirectExecutionOutcomeClosure {
  const { capsule, rehearsal, actualAfter, actualA0 } = input;
  if (capsule.kind !== "A1_DIRECT_EXECUTION_RESEARCH_CAPSULE") {
    throw new Error("P0 outcome closure requires a qualified execution capsule.");
  }
  if (
    capsule.selectionClaim !== "NONE_CALLER_SUPPLIED_PROPOSAL_P0" ||
    capsule.liveRuntimeIntegrationClaim !== "NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0" ||
    capsule.runtimeAuthorityClaim !== "NONE_P0"
  ) {
    throw new Error("P0 outcome closure refuses a capsule with selection or runtime authority.");
  }
  if (
    rehearsal.kind !== "A1_DIRECT_JOINT_PHYSICAL_REHEARSAL" ||
    rehearsal.sourceTick !== capsule.sourceTick ||
    rehearsal.companionCandidateId !== capsule.proposalId ||
    rehearsal.playerFutureFamily !== "OWNER_REQUEST_CONTINUATION"
  ) {
    throw new Error("P0 outcome closure requires the aligned H1 same-physics rehearsal for the supplied proposal.");
  }
  if (vectorDistance(rehearsal.companionCommandVelocity, capsule.commandVelocity) > ALIGNMENT_EPSILON) {
    throw new Error("P0 rehearsal companion command does not preserve capsule command identity.");
  }
  if (
    actualA0.observationTick !== capsule.sourceTick ||
    actualA0.outcomeTick !== capsule.sourceTick + 1 ||
    actualAfter.tick !== actualA0.outcomeTick ||
    actualA0.companionVelocityCommand.sourceTick !== capsule.sourceTick
  ) {
    throw new Error("P0 actual World/A0 evidence is not aligned to the capsule decision tick.");
  }

  const commandVelocityError = vectorDistance(
    actualA0.companionVelocityCommand.velocity,
    capsule.commandVelocity
  );
  const predictedFrame = rehearsal.physical.frames[0];
  if (!predictedFrame) throw new Error("P0 H1 rehearsal contains no first physical frame.");

  const actorDeltas = (["player", "companion"] as const).map((actorId) => {
    const predicted = predictedFrame.actors.find((candidate) => candidate.id === actorId);
    if (!predicted) throw new Error(`P0 H1 rehearsal first frame is missing ${actorId}.`);
    const actual = actor(actualAfter, actorId);
    return {
      actorId,
      positionError: vectorDistance(predicted.position, actual.position),
      requestedVelocityError: vectorDistance(predicted.requestedVelocity, actual.requestedVelocity),
      actualVelocityError: vectorDistance(predicted.actualVelocity, actual.actualVelocity),
      motionErrorDelta: Math.abs(predicted.motionError - actual.motionError),
      contactsMatch: contactSignature(predicted) === contactSignature(actual)
    } satisfies A1DirectExecutionActorOutcomeDelta;
  });

  const maxNumericStateError = Math.max(
    commandVelocityError,
    ...actorDeltas.flatMap((delta) => [
      delta.positionError,
      delta.requestedVelocityError,
      delta.actualVelocityError,
      delta.motionErrorDelta
    ])
  );
  const disposition =
    maxNumericStateError <= OUTCOME_MATCH_EPSILON && actorDeltas.every((delta) => delta.contactsMatch)
      ? "MATCHED_FIRST_STEP"
      : "DIVERGED_FIRST_STEP";

  return {
    kind: "A1_DIRECT_EXECUTION_OUTCOME_CLOSURE",
    sourceTick: capsule.sourceTick,
    outcomeTick: actualA0.outcomeTick,
    proposalId: capsule.proposalId,
    commandVelocity: { ...capsule.commandVelocity },
    a0CommandVelocity: { ...actualA0.companionVelocityCommand.velocity },
    commandVelocityError,
    predictedFirstStepSource: "A1_SAME_PHYSICS_H1_REHEARSAL_FIRST_STEP",
    actorDeltas,
    maxNumericStateError,
    disposition,
    a0OutcomeAttribution: cloneAttribution(actualA0.companionOutcomeAttribution),
    selectionClaim: "NONE_CALLER_SUPPLIED_PROPOSAL_P0",
    liveRuntimeIntegrationClaim: "NONE_ISOLATED_EXECUTION_RESEARCH_ONLY_P0",
    runtimeAuthorityClaim: "NONE_P0"
  };
}
