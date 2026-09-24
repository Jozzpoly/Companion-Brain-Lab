import {
  FIELD_LAB_SQUAD_MEMBERS,
  type FieldLabMemberTarget,
  type SquadMemberAuthority,
  type SquadOrderMode
} from "./field-lab-squad-control";
import type { CooperativeEpisodeOutcome } from "../world/cooperative-episode-contract";
import type { ActorSnapshot, SquadMemberId, Vec2 } from "../world/types";

export const FIELD_LAB_TRIAL_SCHEMA = "companion-field-lab-trial-v1" as const;
export const FIELD_LAB_TRIAL_MAX_FRAMES = 7_200;
export type FieldLabTrialSlot = "A" | "B";
export type FieldLabTrialMemberStatus =
  | "DIRECT"
  | "MOVING"
  | "ARRIVED"
  | "BLOCKED"
  | "INVALID_TARGET";

export interface FieldLabTrialMemberSample {
  memberId: SquadMemberId;
  position: Vec2;
  target: Vec2 | null;
  targetError: number | null;
  authority: SquadMemberAuthority;
  orderMode: SquadOrderMode;
  requestedVelocity: Vec2;
  actualVelocity: Vec2;
  motionError: number;
  contactCount: number;
  status: FieldLabTrialMemberStatus;
}

export interface FieldLabTrialFrame {
  tick: number;
  playerPosition: Vec2;
  cooperativeOutcome: CooperativeEpisodeOutcome;
  members: readonly FieldLabTrialMemberSample[];
}

export interface FieldLabTrialRecord {
  schema: typeof FIELD_LAB_TRIAL_SCHEMA;
  slot: FieldLabTrialSlot;
  label: string;
  startedAtTick: number;
  endedAtTick: number;
  frames: readonly FieldLabTrialFrame[];
}

export interface FieldLabTrialMemberSummary {
  memberId: SquadMemberId;
  samples: number;
  pathDistance: number;
  meanTargetError: number | null;
  maxTargetError: number | null;
  meanMotionError: number;
  blockedTicks: number;
  longestBlockedRun: number;
  contactTicks: number;
  directTicks: number;
  authorityTransitions: number;
  orderTransitions: number;
}

export interface FieldLabTrialSummary {
  slot: FieldLabTrialSlot;
  label: string;
  startedAtTick: number;
  endedAtTick: number;
  frameCount: number;
  members: readonly FieldLabTrialMemberSummary[];
  cooperativeOutcomes: Readonly<Partial<Record<CooperativeEpisodeOutcome, number>>>;
}

export interface FieldLabTrialMemberComparison {
  memberId: SquadMemberId;
  pathDistanceDelta: number;
  meanTargetErrorDelta: number | null;
  meanMotionErrorDelta: number;
  blockedTicksDelta: number;
  longestBlockedRunDelta: number;
  contactTicksDelta: number;
  directTicksDelta: number;
  authorityTransitionsDelta: number;
  orderTransitionsDelta: number;
}

export interface FieldLabTrialComparison {
  a: FieldLabTrialSummary;
  b: FieldLabTrialSummary;
  members: readonly FieldLabTrialMemberComparison[];
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cloneVec(value: Vec2): Vec2 {
  return { x: value.x, y: value.y };
}

export function classifyFieldLabTrialMember(input: {
  body: ActorSnapshot;
  target: FieldLabMemberTarget;
  targetValid: boolean;
  slotTolerance: number;
}): FieldLabTrialMemberStatus {
  if (input.target.authority === "DIRECT") return "DIRECT";
  if (!input.target.target || !input.targetValid) return "INVALID_TARGET";

  const targetError = distance(input.body.position, input.target.target);
  if (targetError <= input.slotTolerance * 1.35) return "ARRIVED";

  const requestedSpeed = Math.hypot(
    input.body.requestedVelocity.x,
    input.body.requestedVelocity.y
  );
  return input.body.motionError > 0.45 && requestedSpeed > 0.2
    ? "BLOCKED"
    : "MOVING";
}

export function createFieldLabTrialFrame(input: {
  tick: number;
  playerPosition: Vec2;
  cooperativeOutcome: CooperativeEpisodeOutcome;
  members: readonly {
    memberId: SquadMemberId;
    body: ActorSnapshot;
    target: FieldLabMemberTarget;
    targetValid: boolean;
    slotTolerance: number;
  }[];
}): FieldLabTrialFrame {
  return {
    tick: input.tick,
    playerPosition: cloneVec(input.playerPosition),
    cooperativeOutcome: input.cooperativeOutcome,
    members: input.members.map(({ memberId, body, target, targetValid, slotTolerance }) => ({
      memberId,
      position: cloneVec(body.position),
      target: target.target ? cloneVec(target.target) : null,
      targetError: target.target && targetValid
        ? distance(body.position, target.target)
        : null,
      authority: target.authority,
      orderMode: target.orderMode,
      requestedVelocity: cloneVec(body.requestedVelocity),
      actualVelocity: cloneVec(body.actualVelocity),
      motionError: body.motionError,
      contactCount: body.contacts.reduce((total, contact) => total + contact.contactCount, 0),
      status: classifyFieldLabTrialMember({ body, target, targetValid, slotTolerance })
    }))
  };
}

function cloneFrame(frame: FieldLabTrialFrame): FieldLabTrialFrame {
  return {
    tick: frame.tick,
    playerPosition: cloneVec(frame.playerPosition),
    cooperativeOutcome: frame.cooperativeOutcome,
    members: frame.members.map((member) => ({
      ...member,
      position: cloneVec(member.position),
      target: member.target ? cloneVec(member.target) : null,
      requestedVelocity: cloneVec(member.requestedVelocity),
      actualVelocity: cloneVec(member.actualVelocity)
    }))
  };
}

export function createFieldLabTrialRecord(input: {
  slot: FieldLabTrialSlot;
  label: string;
  startedAtTick: number;
  frames: readonly FieldLabTrialFrame[];
}): FieldLabTrialRecord {
  if (input.frames.length === 0) {
    throw new Error("Field Lab trial requires at least one recorded frame.");
  }
  const frames = input.frames.map(cloneFrame);
  return {
    schema: FIELD_LAB_TRIAL_SCHEMA,
    slot: input.slot,
    label: input.label,
    startedAtTick: input.startedAtTick,
    endedAtTick: frames[frames.length - 1]!.tick,
    frames
  };
}

function mean(total: number, count: number): number {
  return count > 0 ? total / count : 0;
}

export function summarizeFieldLabTrial(record: FieldLabTrialRecord): FieldLabTrialSummary {
  const cooperativeOutcomes: Partial<Record<CooperativeEpisodeOutcome, number>> = {};
  for (const frame of record.frames) {
    if (frame.cooperativeOutcome !== "NONE") {
      cooperativeOutcomes[frame.cooperativeOutcome] =
        (cooperativeOutcomes[frame.cooperativeOutcome] ?? 0) + 1;
    }
  }

  const members: FieldLabTrialMemberSummary[] = [];
  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    const samples = record.frames
      .map((frame) => frame.members.find((member) => member.memberId === memberId))
      .filter((sample): sample is FieldLabTrialMemberSample => Boolean(sample));
    if (samples.length === 0) continue;

    let pathDistance = 0;
    let targetErrorTotal = 0;
    let targetErrorCount = 0;
    let maxTargetError: number | null = null;
    let motionErrorTotal = 0;
    let blockedTicks = 0;
    let longestBlockedRun = 0;
    let currentBlockedRun = 0;
    let contactTicks = 0;
    let directTicks = 0;
    let authorityTransitions = 0;
    let orderTransitions = 0;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index]!;
      const previous = index > 0 ? samples[index - 1]! : null;
      if (previous) {
        pathDistance += distance(previous.position, sample.position);
        if (previous.authority !== sample.authority) authorityTransitions += 1;
        if (previous.orderMode !== sample.orderMode) orderTransitions += 1;
      }
      if (sample.targetError !== null) {
        targetErrorTotal += sample.targetError;
        targetErrorCount += 1;
        maxTargetError = maxTargetError === null
          ? sample.targetError
          : Math.max(maxTargetError, sample.targetError);
      }
      motionErrorTotal += sample.motionError;
      if (sample.status === "BLOCKED") {
        blockedTicks += 1;
        currentBlockedRun += 1;
        longestBlockedRun = Math.max(longestBlockedRun, currentBlockedRun);
      } else {
        currentBlockedRun = 0;
      }
      if (sample.contactCount > 0) contactTicks += 1;
      if (sample.authority === "DIRECT") directTicks += 1;
    }

    members.push({
      memberId,
      samples: samples.length,
      pathDistance,
      meanTargetError: targetErrorCount > 0 ? mean(targetErrorTotal, targetErrorCount) : null,
      maxTargetError,
      meanMotionError: mean(motionErrorTotal, samples.length),
      blockedTicks,
      longestBlockedRun,
      contactTicks,
      directTicks,
      authorityTransitions,
      orderTransitions
    });
  }

  return {
    slot: record.slot,
    label: record.label,
    startedAtTick: record.startedAtTick,
    endedAtTick: record.endedAtTick,
    frameCount: record.frames.length,
    members,
    cooperativeOutcomes
  };
}

function nullableDelta(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : b - a;
}

export function compareFieldLabTrials(
  aRecord: FieldLabTrialRecord,
  bRecord: FieldLabTrialRecord
): FieldLabTrialComparison {
  const a = summarizeFieldLabTrial(aRecord);
  const b = summarizeFieldLabTrial(bRecord);
  const members: FieldLabTrialMemberComparison[] = [];

  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    const am = a.members.find((member) => member.memberId === memberId);
    const bm = b.members.find((member) => member.memberId === memberId);
    if (!am || !bm) continue;
    members.push({
      memberId,
      pathDistanceDelta: bm.pathDistance - am.pathDistance,
      meanTargetErrorDelta: nullableDelta(am.meanTargetError, bm.meanTargetError),
      meanMotionErrorDelta: bm.meanMotionError - am.meanMotionError,
      blockedTicksDelta: bm.blockedTicks - am.blockedTicks,
      longestBlockedRunDelta: bm.longestBlockedRun - am.longestBlockedRun,
      contactTicksDelta: bm.contactTicks - am.contactTicks,
      directTicksDelta: bm.directTicks - am.directTicks,
      authorityTransitionsDelta: bm.authorityTransitions - am.authorityTransitions,
      orderTransitionsDelta: bm.orderTransitions - am.orderTransitions
    });
  }

  return { a, b, members };
}
