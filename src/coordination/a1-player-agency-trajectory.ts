import type { A1DirectJointPhysicalRehearsal } from "./a1-direct-joint-physical-rehearsal";
import type {
  A1JointHardBodyTraceEvidence,
  A1JointHardBodyTraceFrame
} from "./a1-joint-hard-body-trace";
import type { ActorSnapshot, Vec2 } from "../world/types";

const ALIGNMENT_EPSILON = 1e-8;
const DIRECTION_EPSILON = 1e-9;

export type A1PlayerFlowBasisState =
  | "MOVING_PLAYER_FUTURE"
  | "FLOW_BASIS_UNAVAILABLE_STATIONARY";

export type A1LongitudinalOrder = "AHEAD" | "ALIGNED" | "BEHIND";
export type A1LateralSide = "LEFT" | "CENTER" | "RIGHT";

export interface A1PlayerAgencyRelativeFrameInput {
  stepIndex: number;
  timeSeconds: number;
  relativeOffset: Vec2;
}

export interface A1PlayerAgencyProjectedFrame extends A1PlayerAgencyRelativeFrameInput {
  longitudinalOffset: number | null;
  lateralOffset: number | null;
  longitudinalOrder: A1LongitudinalOrder | null;
  lateralSide: A1LateralSide | null;
}

export interface A1PlayerAgencyTrajectoryGeometry {
  playerSpeed: number;
  flowBasisState: A1PlayerFlowBasisState;
  forwardAxis: Vec2 | null;
  lateralAxis: Vec2 | null;
  initialRelativeOffset: Vec2;
  initialLongitudinalOffset: number | null;
  initialLateralOffset: number | null;
  initialLongitudinalOrder: A1LongitudinalOrder | null;
  initialLateralSide: A1LateralSide | null;
  frames: readonly A1PlayerAgencyProjectedFrame[];
  terminalRelativeOffset: Vec2;
  terminalLongitudinalOffset: number | null;
  terminalLateralOffset: number | null;
  terminalLongitudinalOrder: A1LongitudinalOrder | null;
  terminalLateralSide: A1LateralSide | null;
  minimumAbsoluteLateralOffsetIncludingInitial: number | null;
  minimumAbsoluteLateralSampleStepIndex: number | null;
  longitudinalOrderingChangeCount: number;
  lateralSideChangeCount: number;
  geometryClaim: "PLAYER_FUTURE_VELOCITY_BASIS_OR_EXPLICIT_STATIONARY_A1_2M";
}

export interface A1PlayerAgencyTrajectoryFrame extends A1PlayerAgencyProjectedFrame {
  playerPosition: Vec2;
  companionPosition: Vec2;
  centerDistance: number;
  hardClearance: number;
  reciprocalPlayerCompanionContact: boolean;
}

export interface A1PlayerAgencyTrajectoryEvidence {
  kind: "A1_PLAYER_AGENCY_TRAJECTORY_EVIDENCE";
  sourceTick: number;
  playerFutureId: string;
  playerFutureFamily: A1DirectJointPhysicalRehearsal["playerFutureFamily"];
  playerCausalMeaning: A1DirectJointPhysicalRehearsal["playerCausalMeaning"];
  playerVelocity: Vec2;
  companionCandidateId: string;
  companionCandidateFamily: A1DirectJointPhysicalRehearsal["companionCandidateFamily"];
  companionCommandVelocity: Vec2;
  playerSpeed: number;
  flowBasisState: A1PlayerFlowBasisState;
  forwardAxis: Vec2 | null;
  lateralAxis: Vec2 | null;
  initialRelativeOffset: Vec2;
  initialCenterDistance: number;
  initialHardClearance: number;
  initialLongitudinalOffset: number | null;
  initialLateralOffset: number | null;
  initialLongitudinalOrder: A1LongitudinalOrder | null;
  initialLateralSide: A1LateralSide | null;
  frames: readonly A1PlayerAgencyTrajectoryFrame[];
  terminalRelativeOffset: Vec2;
  terminalCenterDistance: number;
  terminalHardClearance: number;
  terminalCenterDistanceDeltaFromInitial: number;
  terminalLongitudinalOffset: number | null;
  terminalLateralOffset: number | null;
  terminalLongitudinalOrder: A1LongitudinalOrder | null;
  terminalLateralSide: A1LateralSide | null;
  minimumAbsoluteLateralOffsetIncludingInitial: number | null;
  minimumAbsoluteLateralSampleStepIndex: number | null;
  longitudinalOrderingChangeCount: number;
  lateralSideChangeCount: number;
  contactFrameCount: number;
  reciprocalContactFrameCount: number;
  firstContactStepIndex: number | null;
  lastContactStepIndex: number | null;
  terminalContactPersists: boolean;
  playerAgencyProvenanceClaim: "REHEARSED_PLAYER_INTERVENTION_CAUSAL_MEANING_A1_2M";
  flowGeometryClaim: "PLAYER_FUTURE_VELOCITY_BASIS_OR_EXPLICIT_STATIONARY_A1_2M";
  comfortEnvelopeClaim: "NONE_A1_2M";
  cooperationDecisionClaim: "NONE_A1_2M_EVIDENCE_ONLY";
  selectionClaim: "NONE_A1_2M_EVIDENCE_ONLY";
  runtimeAuthorityClaim: "NONE_A1_2M_EVIDENCE_ONLY";
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function finiteVector(value: Vec2, label: string): Vec2 {
  finite(value.x, `${label}.x`);
  finite(value.y, `${label}.y`);
  return { ...value };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalized(value: Vec2): Vec2 | null {
  const length = magnitude(value);
  return length > DIRECTION_EPSILON
    ? { x: value.x / length, y: value.y / length }
    : null;
}

function longitudinalOrder(value: number): A1LongitudinalOrder {
  if (value > ALIGNMENT_EPSILON) return "AHEAD";
  if (value < -ALIGNMENT_EPSILON) return "BEHIND";
  return "ALIGNED";
}

function lateralSide(value: number): A1LateralSide {
  if (value > ALIGNMENT_EPSILON) return "LEFT";
  if (value < -ALIGNMENT_EPSILON) return "RIGHT";
  return "CENTER";
}

function oppositeLongitudinal(a: A1LongitudinalOrder, b: A1LongitudinalOrder): boolean {
  return (a === "AHEAD" && b === "BEHIND") || (a === "BEHIND" && b === "AHEAD");
}

function oppositeLateral(a: A1LateralSide, b: A1LateralSide): boolean {
  return (a === "LEFT" && b === "RIGHT") || (a === "RIGHT" && b === "LEFT");
}

function countNonNeutralChanges<T>(
  initial: T,
  frames: readonly T[],
  neutral: T,
  isOpposite: (a: T, b: T) => boolean
): number {
  let previous: T | null = initial === neutral ? null : initial;
  let changes = 0;
  for (const value of frames) {
    if (value === neutral) continue;
    if (previous !== null && isOpposite(previous, value)) changes += 1;
    previous = value;
  }
  return changes;
}

/**
 * Pure geometric projection used by A1.2m. It gives no cooperation meaning to
 * crossing, ordering or lateral side changes. A zero player-future velocity
 * produces no fabricated flow basis.
 */
export function analyzeA1PlayerAgencyRelativeTrajectory(input: {
  playerVelocity: Vec2;
  initialRelativeOffset: Vec2;
  frames: readonly A1PlayerAgencyRelativeFrameInput[];
}): A1PlayerAgencyTrajectoryGeometry {
  const playerVelocity = finiteVector(input.playerVelocity, "A1.2m player velocity");
  const initialRelativeOffset = finiteVector(
    input.initialRelativeOffset,
    "A1.2m initial relative offset"
  );
  if (input.frames.length < 1) throw new Error("A1.2m geometry requires at least one trajectory frame.");

  const playerSpeed = magnitude(playerVelocity);
  const forwardAxis = normalized(playerVelocity);
  if (!forwardAxis) {
    const frames = input.frames.map((frame, index) => {
      if (frame.stepIndex !== index) {
        throw new Error("A1.2m geometry requires contiguous zero-based step indices.");
      }
      return {
        stepIndex: frame.stepIndex,
        timeSeconds: finite(frame.timeSeconds, `A1.2m frame ${index} time`),
        relativeOffset: finiteVector(frame.relativeOffset, `A1.2m frame ${index} relative offset`),
        longitudinalOffset: null,
        lateralOffset: null,
        longitudinalOrder: null,
        lateralSide: null
      } satisfies A1PlayerAgencyProjectedFrame;
    });
    return {
      playerSpeed,
      flowBasisState: "FLOW_BASIS_UNAVAILABLE_STATIONARY",
      forwardAxis: null,
      lateralAxis: null,
      initialRelativeOffset,
      initialLongitudinalOffset: null,
      initialLateralOffset: null,
      initialLongitudinalOrder: null,
      initialLateralSide: null,
      frames,
      terminalRelativeOffset: { ...frames.at(-1)!.relativeOffset },
      terminalLongitudinalOffset: null,
      terminalLateralOffset: null,
      terminalLongitudinalOrder: null,
      terminalLateralSide: null,
      minimumAbsoluteLateralOffsetIncludingInitial: null,
      minimumAbsoluteLateralSampleStepIndex: null,
      longitudinalOrderingChangeCount: 0,
      lateralSideChangeCount: 0,
      geometryClaim: "PLAYER_FUTURE_VELOCITY_BASIS_OR_EXPLICIT_STATIONARY_A1_2M"
    };
  }

  const lateralAxis = { x: -forwardAxis.y, y: forwardAxis.x };
  const initialLongitudinalOffset = dot(initialRelativeOffset, forwardAxis);
  const initialLateralOffset = dot(initialRelativeOffset, lateralAxis);
  const initialLongitudinalOrder = longitudinalOrder(initialLongitudinalOffset);
  const initialLateralSide = lateralSide(initialLateralOffset);

  let minimumAbsoluteLateralOffsetIncludingInitial = Math.abs(initialLateralOffset);
  let minimumAbsoluteLateralSampleStepIndex: number | null = null;

  const frames = input.frames.map((frame, index) => {
    if (frame.stepIndex !== index) {
      throw new Error("A1.2m geometry requires contiguous zero-based step indices.");
    }
    const relativeOffset = finiteVector(frame.relativeOffset, `A1.2m frame ${index} relative offset`);
    const longitudinalOffset = dot(relativeOffset, forwardAxis);
    const lateralOffset = dot(relativeOffset, lateralAxis);
    const absoluteLateral = Math.abs(lateralOffset);
    if (absoluteLateral < minimumAbsoluteLateralOffsetIncludingInitial) {
      minimumAbsoluteLateralOffsetIncludingInitial = absoluteLateral;
      minimumAbsoluteLateralSampleStepIndex = index;
    }
    return {
      stepIndex: frame.stepIndex,
      timeSeconds: finite(frame.timeSeconds, `A1.2m frame ${index} time`),
      relativeOffset,
      longitudinalOffset,
      lateralOffset,
      longitudinalOrder: longitudinalOrder(longitudinalOffset),
      lateralSide: lateralSide(lateralOffset)
    } satisfies A1PlayerAgencyProjectedFrame;
  });

  const terminal = frames.at(-1)!;
  return {
    playerSpeed,
    flowBasisState: "MOVING_PLAYER_FUTURE",
    forwardAxis,
    lateralAxis,
    initialRelativeOffset,
    initialLongitudinalOffset,
    initialLateralOffset,
    initialLongitudinalOrder,
    initialLateralSide,
    frames,
    terminalRelativeOffset: { ...terminal.relativeOffset },
    terminalLongitudinalOffset: terminal.longitudinalOffset,
    terminalLateralOffset: terminal.lateralOffset,
    terminalLongitudinalOrder: terminal.longitudinalOrder,
    terminalLateralSide: terminal.lateralSide,
    minimumAbsoluteLateralOffsetIncludingInitial,
    minimumAbsoluteLateralSampleStepIndex,
    longitudinalOrderingChangeCount: countNonNeutralChanges(
      initialLongitudinalOrder,
      frames.map((frame) => frame.longitudinalOrder!),
      "ALIGNED",
      oppositeLongitudinal
    ),
    lateralSideChangeCount: countNonNeutralChanges(
      initialLateralSide,
      frames.map((frame) => frame.lateralSide!),
      "CENTER",
      oppositeLateral
    ),
    geometryClaim: "PLAYER_FUTURE_VELOCITY_BASIS_OR_EXPLICIT_STATIONARY_A1_2M"
  };
}

function actor(actors: readonly ActorSnapshot[], id: "player" | "companion"): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1.2m physical rehearsal is missing ${id}.`);
  return value;
}

function validateAligned(input: {
  rehearsal: A1DirectJointPhysicalRehearsal;
  trace: A1JointHardBodyTraceEvidence;
}): void {
  const { rehearsal, trace } = input;
  if (rehearsal.kind !== "A1_DIRECT_JOINT_PHYSICAL_REHEARSAL") {
    throw new Error("A1.2m requires an A1.2j joint physical rehearsal.");
  }
  if (trace.kind !== "A1_JOINT_HARD_BODY_TRACE_EVIDENCE") {
    throw new Error("A1.2m requires an A1.2k joint hard-body trace.");
  }
  if (rehearsal.cooperationClaim !== "NONE_A1_2J") {
    throw new Error("A1.2m refuses rehearsal evidence that already claims cooperation authority.");
  }
  if (trace.cooperationClaim !== "NONE_A1_2K_TRACE_ONLY") {
    throw new Error("A1.2m refuses trace evidence that already claims cooperation authority.");
  }
  if (trace.sourceTick !== rehearsal.sourceTick) {
    throw new Error("A1.2m trace/rehearsal source ticks are misaligned.");
  }
  if (trace.playerFutureId !== rehearsal.playerFutureId) {
    throw new Error("A1.2m trace/rehearsal player-future ids are misaligned.");
  }
  if (trace.companionCandidateId !== rehearsal.companionCandidateId) {
    throw new Error("A1.2m trace/rehearsal companion-candidate ids are misaligned.");
  }
  if (trace.worldStepCount !== rehearsal.worldStepCount || trace.frames.length !== rehearsal.physical.frames.length) {
    throw new Error("A1.2m trace/rehearsal frame counts are misaligned.");
  }
  if (Math.abs(trace.executedHorizonSeconds - rehearsal.executedHorizonSeconds) > ALIGNMENT_EPSILON) {
    throw new Error("A1.2m trace/rehearsal horizons are misaligned.");
  }

  for (let index = 0; index < trace.frames.length; index += 1) {
    const traceFrame = trace.frames[index]!;
    const physicalFrame = rehearsal.physical.frames[index]!;
    if (traceFrame.stepIndex !== physicalFrame.stepIndex) {
      throw new Error("A1.2m trace/physical step indices are misaligned.");
    }
    const player = actor(physicalFrame.actors, "player");
    const companion = actor(physicalFrame.actors, "companion");
    if (distance(traceFrame.playerPosition, player.position) > ALIGNMENT_EPSILON) {
      throw new Error("A1.2m trace player position does not match physical rehearsal.");
    }
    if (distance(traceFrame.companionPosition, companion.position) > ALIGNMENT_EPSILON) {
      throw new Error("A1.2m trace companion position does not match physical rehearsal.");
    }
  }
}

/**
 * A1.2m projects one qualified joint trajectory into the causal player's
 * physical future basis. It publishes geometry/provenance only and deliberately
 * makes no cooperation decision.
 */
export function buildA1PlayerAgencyTrajectoryEvidence(input: {
  rehearsal: A1DirectJointPhysicalRehearsal;
  trace: A1JointHardBodyTraceEvidence;
}): A1PlayerAgencyTrajectoryEvidence {
  validateAligned(input);
  const initialRelativeOffset = subtract(
    input.trace.initialCompanionPosition,
    input.trace.initialPlayerPosition
  );
  const geometry = analyzeA1PlayerAgencyRelativeTrajectory({
    playerVelocity: input.rehearsal.playerVelocity,
    initialRelativeOffset,
    frames: input.trace.frames.map((frame) => ({
      stepIndex: frame.stepIndex,
      timeSeconds: frame.timeSeconds,
      relativeOffset: subtract(frame.companionPosition, frame.playerPosition)
    }))
  });

  const frames = geometry.frames.map((projected, index) => {
    const traceFrame: A1JointHardBodyTraceFrame = input.trace.frames[index]!;
    return {
      ...projected,
      playerPosition: { ...traceFrame.playerPosition },
      companionPosition: { ...traceFrame.companionPosition },
      centerDistance: traceFrame.centerDistance,
      hardClearance: traceFrame.hardClearance,
      reciprocalPlayerCompanionContact: traceFrame.reciprocalPlayerCompanionContact
    } satisfies A1PlayerAgencyTrajectoryFrame;
  });
  const terminal = frames.at(-1)!;

  return {
    kind: "A1_PLAYER_AGENCY_TRAJECTORY_EVIDENCE",
    sourceTick: input.rehearsal.sourceTick,
    playerFutureId: input.rehearsal.playerFutureId,
    playerFutureFamily: input.rehearsal.playerFutureFamily,
    playerCausalMeaning: input.rehearsal.playerCausalMeaning,
    playerVelocity: { ...input.rehearsal.playerVelocity },
    companionCandidateId: input.rehearsal.companionCandidateId,
    companionCandidateFamily: input.rehearsal.companionCandidateFamily,
    companionCommandVelocity: { ...input.rehearsal.companionCommandVelocity },
    playerSpeed: geometry.playerSpeed,
    flowBasisState: geometry.flowBasisState,
    forwardAxis: geometry.forwardAxis ? { ...geometry.forwardAxis } : null,
    lateralAxis: geometry.lateralAxis ? { ...geometry.lateralAxis } : null,
    initialRelativeOffset: { ...geometry.initialRelativeOffset },
    initialCenterDistance: input.trace.initialCenterDistance,
    initialHardClearance: input.trace.initialHardClearance,
    initialLongitudinalOffset: geometry.initialLongitudinalOffset,
    initialLateralOffset: geometry.initialLateralOffset,
    initialLongitudinalOrder: geometry.initialLongitudinalOrder,
    initialLateralSide: geometry.initialLateralSide,
    frames,
    terminalRelativeOffset: { ...geometry.terminalRelativeOffset },
    terminalCenterDistance: terminal.centerDistance,
    terminalHardClearance: terminal.hardClearance,
    terminalCenterDistanceDeltaFromInitial: terminal.centerDistance - input.trace.initialCenterDistance,
    terminalLongitudinalOffset: geometry.terminalLongitudinalOffset,
    terminalLateralOffset: geometry.terminalLateralOffset,
    terminalLongitudinalOrder: geometry.terminalLongitudinalOrder,
    terminalLateralSide: geometry.terminalLateralSide,
    minimumAbsoluteLateralOffsetIncludingInitial: geometry.minimumAbsoluteLateralOffsetIncludingInitial,
    minimumAbsoluteLateralSampleStepIndex: geometry.minimumAbsoluteLateralSampleStepIndex,
    longitudinalOrderingChangeCount: geometry.longitudinalOrderingChangeCount,
    lateralSideChangeCount: geometry.lateralSideChangeCount,
    contactFrameCount: input.trace.contactFrameCount,
    reciprocalContactFrameCount: input.trace.reciprocalContactFrameCount,
    firstContactStepIndex: input.trace.firstContactStepIndex,
    lastContactStepIndex: input.trace.lastContactStepIndex,
    terminalContactPersists:
      input.trace.lastContactStepIndex === input.trace.worldStepCount - 1 &&
      input.trace.contactFrameCount > 0,
    playerAgencyProvenanceClaim: "REHEARSED_PLAYER_INTERVENTION_CAUSAL_MEANING_A1_2M",
    flowGeometryClaim: "PLAYER_FUTURE_VELOCITY_BASIS_OR_EXPLICIT_STATIONARY_A1_2M",
    comfortEnvelopeClaim: "NONE_A1_2M",
    cooperationDecisionClaim: "NONE_A1_2M_EVIDENCE_ONLY",
    selectionClaim: "NONE_A1_2M_EVIDENCE_ONLY",
    runtimeAuthorityClaim: "NONE_A1_2M_EVIDENCE_ONLY"
  };
}
