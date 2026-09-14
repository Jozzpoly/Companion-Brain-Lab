import type { Vec2 } from "../world/types";

export interface CausalObservationPhase {
  worldTick: number;
  companionPosition: Vec2;
  playerPosition: Vec2;
  companionActualVelocity: Vec2;
  companionContacts: readonly string[];
}

export interface CausalDecisionPhase {
  relationshipRevision: number | null;
  relationshipLabel: string | null;
  relationshipTarget: Vec2 | null;
  routeStatus: string | null;
  routePath: string;
  routeCost: number | null;
  spatialState: string | null;
  spatialCandidate: string | null;
  preferredVelocity: Vec2 | null;
  refinedVelocity: Vec2 | null;
  routeClearanceConstrained?: boolean | null;
  comfortStartViolated?: boolean | null;
  comfortStartBlockers?: readonly string[];
  rehabilitatedCandidateCount?: number | null;
  comfortExitCandidateCount?: number | null;
}

export interface CausalCommandPhase {
  actuator: "direct" | "natural" | "manual" | "chase" | "relational";
  commandedMove: Vec2;
  commandedVelocity: Vec2;
  finalConstraintSource?: string | null;
  finalConstrained?: boolean | null;
  finalConstraintReason?: string | null;
}

export interface CausalOutcomePhase {
  worldTick: number;
  companionPosition: Vec2;
  companionRequestedVelocity: Vec2;
  companionActualVelocity: Vec2;
  companionContacts: readonly string[];
  displacement: number;
  postRouteStatus: string | null;
  postRoutePath: string;
  postRouteClearanceConstrained?: boolean | null;
}

export interface CausalPostClassification {
  state: string;
  reason: string;
  desiredClearanceProbe: "clear" | "blocked-zero" | "blocked" | "unknown";
  hardProbe: "clear" | "blocked" | "unknown";
  action?: string | null;
  noProgressTicks?: number | null;
  unreachableTicks?: number | null;
  /** Legacy incident-v2 name: retry budget consumed in the current episode. */
  retryCount?: number | null;
  /** Legacy incident-v2 name: cumulative RETRY_LOCAL applications since stack reset. */
  appliedLocalRetries?: number | null;
  /** Explicit alias for retryCount; self-describing for new evidence consumers. */
  retryBudgetUsedThisEpisode?: number | null;
  /** Explicit alias for appliedLocalRetries; self-describing for new evidence consumers. */
  cumulativeLocalRetriesSinceReset?: number | null;
}

export interface CausalFrame {
  sequence: number;
  observation: CausalObservationPhase;
  decision: CausalDecisionPhase;
  command: CausalCommandPhase;
  outcome: CausalOutcomePhase;
  post: CausalPostClassification;
}

function cloneVec(value: Vec2 | null): Vec2 | null {
  return value ? { ...value } : null;
}

function clonePost(post: CausalPostClassification): CausalPostClassification {
  const retryBudgetUsedThisEpisode = post.retryBudgetUsedThisEpisode ?? post.retryCount ?? null;
  const cumulativeLocalRetriesSinceReset =
    post.cumulativeLocalRetriesSinceReset ?? post.appliedLocalRetries ?? null;
  return {
    ...post,
    retryBudgetUsedThisEpisode,
    cumulativeLocalRetriesSinceReset
  };
}

function cloneFrame(frame: CausalFrame): CausalFrame {
  return {
    sequence: frame.sequence,
    observation: {
      ...frame.observation,
      companionPosition: { ...frame.observation.companionPosition },
      playerPosition: { ...frame.observation.playerPosition },
      companionActualVelocity: { ...frame.observation.companionActualVelocity },
      companionContacts: [...frame.observation.companionContacts]
    },
    decision: {
      ...frame.decision,
      relationshipTarget: cloneVec(frame.decision.relationshipTarget),
      preferredVelocity: cloneVec(frame.decision.preferredVelocity),
      refinedVelocity: cloneVec(frame.decision.refinedVelocity),
      comfortStartBlockers: frame.decision.comfortStartBlockers
        ? [...frame.decision.comfortStartBlockers]
        : undefined
    },
    command: {
      ...frame.command,
      commandedMove: { ...frame.command.commandedMove },
      commandedVelocity: { ...frame.command.commandedVelocity }
    },
    outcome: {
      ...frame.outcome,
      companionPosition: { ...frame.outcome.companionPosition },
      companionRequestedVelocity: { ...frame.outcome.companionRequestedVelocity },
      companionActualVelocity: { ...frame.outcome.companionActualVelocity },
      companionContacts: [...frame.outcome.companionContacts]
    },
    post: clonePost(frame.post)
  };
}

export class CausalFrameTrace {
  private readonly frames: CausalFrame[] = [];
  private sequenceValue = 0;

  constructor(private readonly capacity = 360) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error("CausalFrameTrace capacity must be a positive integer.");
  }

  reset(): void {
    this.frames.length = 0;
    this.sequenceValue = 0;
  }

  nextSequence(): number {
    const next = this.sequenceValue;
    this.sequenceValue += 1;
    return next;
  }

  record(frame: CausalFrame): void {
    this.frames.push(cloneFrame(frame));
    if (this.frames.length > this.capacity) this.frames.splice(0, this.frames.length - this.capacity);
  }

  latest(): CausalFrame | null {
    const value = this.frames.at(-1);
    return value ? cloneFrame(value) : null;
  }

  recent(limit = 30): CausalFrame[] {
    return this.frames.slice(Math.max(0, this.frames.length - limit)).map(cloneFrame);
  }

  size(): number {
    return this.frames.length;
  }
}
