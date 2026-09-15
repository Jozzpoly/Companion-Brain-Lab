import type { A1DirectJointPhysicalRehearsal } from "./a1-direct-joint-physical-rehearsal";
import type { A1Situation } from "./a1-situation";
import type { ActorSnapshot, Vec2 } from "../world/types";

const ALIGNMENT_EPSILON = 1e-8;

export interface A1JointHardBodyTraceFrame {
  stepIndex: number;
  timeSeconds: number;
  playerPosition: Vec2;
  companionPosition: Vec2;
  playerRadius: number;
  companionRadius: number;
  hardRadiusThreshold: number;
  centerDistance: number;
  hardClearance: number;
  playerReportsCompanionContact: boolean;
  companionReportsPlayerContact: boolean;
  reciprocalPlayerCompanionContact: boolean;
  playerCompanionContactCount: number;
  companionPlayerContactCount: number;
}

export interface A1JointHardBodyTraceEvidence {
  kind: "A1_JOINT_HARD_BODY_TRACE_EVIDENCE";
  sourceTick: number;
  playerFutureId: string;
  companionCandidateId: string;
  worldStepSeconds: number;
  worldStepCount: number;
  declaredHorizonSeconds: number;
  executedHorizonSeconds: number;
  playerRadius: number;
  companionRadius: number;
  hardRadiusThreshold: number;
  initialPlayerPosition: Vec2;
  initialCompanionPosition: Vec2;
  initialCenterDistance: number;
  initialHardClearance: number;
  frames: readonly A1JointHardBodyTraceFrame[];
  minimumSampledHardClearance: number;
  minimumSampledStepIndex: number;
  minimumSampledTimeSeconds: number;
  minimumObservedHardClearanceIncludingInitial: number;
  terminalHardClearance: number;
  minimumSampledDeltaFromInitial: number;
  terminalDeltaFromInitial: number;
  sampledNegativeClearanceFrameCount: number;
  contactFrameCount: number;
  reciprocalContactFrameCount: number;
  asymmetricContactFrameCount: number;
  firstContactStepIndex: number | null;
  lastContactStepIndex: number | null;
  samplingScopeClaim: "INITIAL_STATE_PLUS_POST_STEP_SAMPLES_A1_2K";
  contactEvidenceClaim: "RAPIER_CONTACT_RECORDS_PER_POST_STEP_FRAME_A1_2K";
  continuousClosestApproachClaim: "NONE_DISCRETE_SAMPLES_PLUS_CONTACT_RECORDS_ONLY_A1_2K";
  g3PolicyClaim: "NONE_A1_2K_TRACE_ONLY";
  cooperationClaim: "NONE_A1_2K_TRACE_ONLY";
  selectionClaim: "NONE_A1_2K_TRACE_ONLY";
  runtimeAuthorityClaim: "NONE_A1_2K_TRACE_ONLY";
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function positiveFinite(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} must be positive.`);
  return value;
}

function finiteVector(value: Vec2, label: string): Vec2 {
  finite(value.x, `${label}.x`);
  finite(value.y, `${label}.y`);
  return { ...value };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(actors: readonly ActorSnapshot[], id: "player" | "companion"): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1.2k trace frame is missing ${id}.`);
  return value;
}

function contactCount(actorSnapshot: ActorSnapshot, withId: "player" | "companion"): number {
  let total = 0;
  for (const record of actorSnapshot.contacts) {
    if (!Number.isInteger(record.contactCount) || record.contactCount <= 0) {
      throw new Error("A1.2k contact records require positive integer contactCount values.");
    }
    if (record.with === withId) total += record.contactCount;
  }
  return total;
}

function assertAligned(input: {
  situation: A1Situation;
  rehearsal: A1DirectJointPhysicalRehearsal;
}): void {
  const { situation, rehearsal } = input;
  if (rehearsal.kind !== "A1_DIRECT_JOINT_PHYSICAL_REHEARSAL") {
    throw new Error("A1.2k requires an A1.2j joint physical rehearsal.");
  }
  if (rehearsal.g3SafetyClaim !== "NONE_A1_2J_TRAJECTORY_EVIDENCE_ONLY") {
    throw new Error("A1.2k refuses upstream evidence that already claims G3 safety authority.");
  }
  if (rehearsal.cooperationClaim !== "NONE_A1_2J") {
    throw new Error("A1.2k refuses upstream evidence that already claims cooperation authority.");
  }
  if (rehearsal.selectionClaim !== "NONE_A1_2J") {
    throw new Error("A1.2k refuses upstream evidence that already claims selection authority.");
  }
  if (rehearsal.runtimeAuthorityClaim !== "NONE_A1_2J") {
    throw new Error("A1.2k refuses upstream evidence that already claims runtime authority.");
  }
  if (rehearsal.sourceTick !== situation.tick) {
    throw new Error("A1.2k rehearsal source tick must equal A1 situation tick.");
  }
  if (rehearsal.qualification.sourceTick !== situation.tick) {
    throw new Error("A1.2k qualification source tick must equal A1 situation tick.");
  }
  if (rehearsal.qualification.g0.status !== "PASS") {
    throw new Error("A1.2k requires G0-qualified A1.2j evidence.");
  }
  if (rehearsal.qualification.g1.status !== "PASS_DIRECT_COMMAND_ADMISSIBLE") {
    throw new Error("A1.2k requires G1-qualified A1.2j evidence.");
  }
  if (rehearsal.qualification.g2.status !== "PASS_STATIC_HARD_LEGALITY") {
    throw new Error("A1.2k requires G2-qualified A1.2j evidence.");
  }
  if (rehearsal.physical.physicsProvenance !== "LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE") {
    throw new Error("A1.2k requires the qualified same-physics rehearsal provenance.");
  }
  if (rehearsal.physical.liveWorldMutationClaim !== "NONE_QUERY_ONLY_CLONE") {
    throw new Error("A1.2k requires query-only upstream rehearsal evidence.");
  }
  if (rehearsal.physical.frames.length !== rehearsal.worldStepCount) {
    throw new Error("A1.2k physical frame count must equal the declared World-step count.");
  }
  if (rehearsal.worldStepCount < 1) {
    throw new Error("A1.2k requires at least one physical rehearsal frame.");
  }
}

/**
 * A1.2k converts one qualified A1.2j joint rehearsal into factual hard-body
 * trace evidence. It intentionally does not decide whether contact, overlap or
 * egress is acceptable policy.
 */
export function buildA1JointHardBodyTrace(input: {
  situation: A1Situation;
  rehearsal: A1DirectJointPhysicalRehearsal;
}): A1JointHardBodyTraceEvidence {
  assertAligned(input);

  const playerRadius = positiveFinite(
    input.situation.situated.playerCapability.radius,
    "A1.2k player radius"
  );
  const companionRadius = positiveFinite(
    input.situation.situated.companionCapability.radius,
    "A1.2k companion radius"
  );
  const hardRadiusThreshold = playerRadius + companionRadius;
  const initialPlayerPosition = finiteVector(
    input.situation.situated.playerBody.position,
    "A1.2k initial player position"
  );
  const initialCompanionPosition = finiteVector(
    input.situation.situated.companionBody.position,
    "A1.2k initial companion position"
  );
  const initialCenterDistance = distance(initialPlayerPosition, initialCompanionPosition);
  const initialHardClearance = initialCenterDistance - hardRadiusThreshold;

  if (Math.abs(input.rehearsal.qualification.companionRadius - companionRadius) > ALIGNMENT_EPSILON) {
    throw new Error("A1.2k companion radius does not match A1.2j qualification evidence.");
  }
  if (
    distance(input.rehearsal.qualification.companionOrigin, initialCompanionPosition) >
    ALIGNMENT_EPSILON
  ) {
    throw new Error("A1.2k companion origin does not match A1 situation evidence.");
  }

  let minimumSampledHardClearance = Number.POSITIVE_INFINITY;
  let minimumSampledStepIndex = -1;
  let minimumSampledTimeSeconds = Number.NaN;
  let sampledNegativeClearanceFrameCount = 0;
  let contactFrameCount = 0;
  let reciprocalContactFrameCount = 0;
  let asymmetricContactFrameCount = 0;
  let firstContactStepIndex: number | null = null;
  let lastContactStepIndex: number | null = null;

  const frames = input.rehearsal.physical.frames.map((physicalFrame, index) => {
    if (physicalFrame.stepIndex !== index) {
      throw new Error("A1.2k requires contiguous zero-based physical rehearsal step indices.");
    }
    const player = actor(physicalFrame.actors, "player");
    const companion = actor(physicalFrame.actors, "companion");
    if (Math.abs(player.radius - playerRadius) > ALIGNMENT_EPSILON) {
      throw new Error("A1.2k player radius changed across the physical rehearsal trace.");
    }
    if (Math.abs(companion.radius - companionRadius) > ALIGNMENT_EPSILON) {
      throw new Error("A1.2k companion radius changed across the physical rehearsal trace.");
    }

    const playerPosition = finiteVector(player.position, `A1.2k player position at step ${index}`);
    const companionPosition = finiteVector(
      companion.position,
      `A1.2k companion position at step ${index}`
    );
    const centerDistance = distance(playerPosition, companionPosition);
    const hardClearance = centerDistance - hardRadiusThreshold;
    const playerCompanionContactCount = contactCount(player, "companion");
    const companionPlayerContactCount = contactCount(companion, "player");
    const playerReportsCompanionContact = playerCompanionContactCount > 0;
    const companionReportsPlayerContact = companionPlayerContactCount > 0;
    const reciprocalPlayerCompanionContact =
      playerReportsCompanionContact && companionReportsPlayerContact;
    const anyActorContact = playerReportsCompanionContact || companionReportsPlayerContact;

    if (hardClearance < minimumSampledHardClearance) {
      minimumSampledHardClearance = hardClearance;
      minimumSampledStepIndex = index;
      minimumSampledTimeSeconds = (index + 1) * input.rehearsal.worldStepSeconds;
    }
    if (hardClearance < 0) sampledNegativeClearanceFrameCount += 1;
    if (anyActorContact) {
      contactFrameCount += 1;
      firstContactStepIndex ??= index;
      lastContactStepIndex = index;
      if (reciprocalPlayerCompanionContact) reciprocalContactFrameCount += 1;
      else asymmetricContactFrameCount += 1;
    }

    return {
      stepIndex: index,
      timeSeconds: (index + 1) * input.rehearsal.worldStepSeconds,
      playerPosition,
      companionPosition,
      playerRadius,
      companionRadius,
      hardRadiusThreshold,
      centerDistance,
      hardClearance,
      playerReportsCompanionContact,
      companionReportsPlayerContact,
      reciprocalPlayerCompanionContact,
      playerCompanionContactCount,
      companionPlayerContactCount
    } satisfies A1JointHardBodyTraceFrame;
  });

  const terminalHardClearance = frames.at(-1)!.hardClearance;

  return {
    kind: "A1_JOINT_HARD_BODY_TRACE_EVIDENCE",
    sourceTick: input.situation.tick,
    playerFutureId: input.rehearsal.playerFutureId,
    companionCandidateId: input.rehearsal.companionCandidateId,
    worldStepSeconds: input.rehearsal.worldStepSeconds,
    worldStepCount: input.rehearsal.worldStepCount,
    declaredHorizonSeconds: input.rehearsal.declaredHorizonSeconds,
    executedHorizonSeconds: input.rehearsal.executedHorizonSeconds,
    playerRadius,
    companionRadius,
    hardRadiusThreshold,
    initialPlayerPosition,
    initialCompanionPosition,
    initialCenterDistance,
    initialHardClearance,
    frames,
    minimumSampledHardClearance,
    minimumSampledStepIndex,
    minimumSampledTimeSeconds,
    minimumObservedHardClearanceIncludingInitial: Math.min(
      initialHardClearance,
      minimumSampledHardClearance
    ),
    terminalHardClearance,
    minimumSampledDeltaFromInitial: minimumSampledHardClearance - initialHardClearance,
    terminalDeltaFromInitial: terminalHardClearance - initialHardClearance,
    sampledNegativeClearanceFrameCount,
    contactFrameCount,
    reciprocalContactFrameCount,
    asymmetricContactFrameCount,
    firstContactStepIndex,
    lastContactStepIndex,
    samplingScopeClaim: "INITIAL_STATE_PLUS_POST_STEP_SAMPLES_A1_2K",
    contactEvidenceClaim: "RAPIER_CONTACT_RECORDS_PER_POST_STEP_FRAME_A1_2K",
    continuousClosestApproachClaim: "NONE_DISCRETE_SAMPLES_PLUS_CONTACT_RECORDS_ONLY_A1_2K",
    g3PolicyClaim: "NONE_A1_2K_TRACE_ONLY",
    cooperationClaim: "NONE_A1_2K_TRACE_ONLY",
    selectionClaim: "NONE_A1_2K_TRACE_ONLY",
    runtimeAuthorityClaim: "NONE_A1_2K_TRACE_ONLY"
  };
}
