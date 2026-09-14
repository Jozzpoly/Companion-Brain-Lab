import type { Vec2 } from "../world/types";

export interface CausalObservationPhase {
  worldTick: number;
  companionPosition: Vec2;
  playerPosition: Vec2;
  companionActualVelocity: Vec2;
  companionContacts: readonly string[];
  /** Incident-v5 provenance: state that existed before the current World step. */
  companionRequestedVelocity?: Vec2;
  companionMotionError?: number;
  playerRequestedVelocity?: Vec2;
  playerActualVelocity?: Vec2;
  playerMotionError?: number;
  playerContacts?: readonly string[];
  /** Same-step owner input that will be submitted to World after this observation. */
  playerInputMove?: Vec2;
}

export interface CausalShadowCoordinationEvidence {
  kind: "CCC0_SHADOW_COORDINATION";
  /** Tactical cognition tick that produced this evidence. */
  shadowTick: number;
  /** Observation tick minus shadowTick. Zero means true same-observation comparison. */
  ageTicks: number;
  regionState: string;
  regionAnchor: Vec2 | null;
  regionBestSampleId: string | null;
  regionCoherentSampleCount: number;
  regionRouteEvaluatedCount: number;
  regionStaticTraversalQueryCount: number;
  regionTopologyKeyChanged: boolean | null;
  regionCoherentOverlapRatio: number | null;
  regionAnchorDisplacement: number | null;
  paceLabel: string;
  paceUrgency: number;
  desiredSpeed: number;
  playerCorridorState: string;
  playerCorridorConfidence: number;
  playerCorridorEndpoint: Vec2;
  preferredFlowConflictState: string;
  preferredFlowClosestApproachTime: number | null;
  preferredFlowPhysicalClearance: number | null;
  preferredFlowComfortClearance: number | null;
  preferredFlowCompanionClosest: Vec2 | null;
  preferredFlowPlayerClosest: Vec2 | null;
  authoritativeFlowConflictState: string;
  authoritativeFlowClosestApproachTime: number | null;
  authoritativeFlowPhysicalClearance: number | null;
  authoritativeFlowComfortClearance: number | null;
  authoritativeFlowCompanionClosest: Vec2 | null;
  authoritativeFlowPlayerClosest: Vec2 | null;
  legacyTargetToShadowAnchorDistance: number | null;
  error: string | null;
}

export interface CausalDecisionPhase {
  relationshipRevision: number | null;
  relationshipLabel: string | null;
  relationshipState?: string | null;
  relationshipTarget: Vec2 | null;
  routeStatus: string | null;
  routePath: string;
  routeCost: number | null;
  spatialState: string | null;
  spatialCandidate: string | null;
  preferredVelocity: Vec2 | null;
  refinedVelocity: Vec2 | null;
  /** Incident-v5 aliases that make the movement stack's provenance explicit. */
  localSafetyState?: string | null;
  coarseLocalVelocity?: Vec2 | null;
  refinementSource?: string | null;
  refinementContributorIds?: readonly string[];
  naturalRegime?: string | null;
  naturalPreferredVelocity?: Vec2 | null;
  naturalPreConstraintVelocity?: Vec2 | null;
  routeClearanceConstrained?: boolean | null;
  comfortStartViolated?: boolean | null;
  comfortStartBlockers?: readonly string[];
  rehabilitatedCandidateCount?: number | null;
  comfortExitCandidateCount?: number | null;
  /** Explicitly non-authoritative CCC-0 research evidence; ageTicks exposes cached multi-rate evidence. */
  shadowCoordination?: CausalShadowCoordinationEvidence | null;
}

export interface CausalCommandPhase {
  actuator: "direct" | "natural" | "manual" | "chase" | "relational";
  commandedMove: Vec2;
  commandedVelocity: Vec2;
  /** Velocity immediately before the final static command authority. */
  preConstraintVelocity?: Vec2 | null;
  /** Velocity actually approved by the final command stage / submitted to World. */
  finalConstraintVelocity?: Vec2 | null;
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
  companionMotionError?: number;
  displacement: number;
  /** Incident-v5 player outcome closes the input -> physics -> observation chain. */
  playerPosition?: Vec2;
  playerRequestedVelocity?: Vec2;
  playerActualVelocity?: Vec2;
  playerMotionError?: number;
  playerContacts?: readonly string[];
  playerDisplacement?: number;
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
  retryCount?: number | null;
  appliedLocalRetries?: number | null;
  /** Self-describing alias for the episode-local legacy retryCount field. */
  retryBudgetUsedThisEpisode?: number | null;
  /** Self-describing alias for the cumulative legacy appliedLocalRetries field. */
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

function cloneVec(value: Vec2 | null | undefined): Vec2 | null {
  return value ? { ...value } : null;
}

function cloneOptionalVec(value: Vec2 | null | undefined): Vec2 | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : { ...value };
}

function cloneShadow(
  value: CausalShadowCoordinationEvidence | null | undefined
): CausalShadowCoordinationEvidence | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return {
    ...value,
    regionAnchor: cloneVec(value.regionAnchor),
    playerCorridorEndpoint: { ...value.playerCorridorEndpoint },
    preferredFlowCompanionClosest: cloneVec(value.preferredFlowCompanionClosest),
    preferredFlowPlayerClosest: cloneVec(value.preferredFlowPlayerClosest),
    authoritativeFlowCompanionClosest: cloneVec(value.authoritativeFlowCompanionClosest),
    authoritativeFlowPlayerClosest: cloneVec(value.authoritativeFlowPlayerClosest)
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
      companionContacts: [...frame.observation.companionContacts],
      companionRequestedVelocity: cloneOptionalVec(frame.observation.companionRequestedVelocity) ?? undefined,
      playerRequestedVelocity: cloneOptionalVec(frame.observation.playerRequestedVelocity) ?? undefined,
      playerActualVelocity: cloneOptionalVec(frame.observation.playerActualVelocity) ?? undefined,
      playerContacts: frame.observation.playerContacts
        ? [...frame.observation.playerContacts]
        : undefined,
      playerInputMove: cloneOptionalVec(frame.observation.playerInputMove) ?? undefined
    },
    decision: {
      ...frame.decision,
      relationshipTarget: cloneVec(frame.decision.relationshipTarget),
      preferredVelocity: cloneVec(frame.decision.preferredVelocity),
      refinedVelocity: cloneVec(frame.decision.refinedVelocity),
      coarseLocalVelocity: cloneOptionalVec(frame.decision.coarseLocalVelocity),
      refinementContributorIds: frame.decision.refinementContributorIds
        ? [...frame.decision.refinementContributorIds]
        : undefined,
      naturalPreferredVelocity: cloneOptionalVec(frame.decision.naturalPreferredVelocity),
      naturalPreConstraintVelocity: cloneOptionalVec(frame.decision.naturalPreConstraintVelocity),
      comfortStartBlockers: frame.decision.comfortStartBlockers
        ? [...frame.decision.comfortStartBlockers]
        : undefined,
      shadowCoordination: cloneShadow(frame.decision.shadowCoordination)
    },
    command: {
      ...frame.command,
      commandedMove: { ...frame.command.commandedMove },
      commandedVelocity: { ...frame.command.commandedVelocity },
      preConstraintVelocity: cloneOptionalVec(frame.command.preConstraintVelocity),
      finalConstraintVelocity: cloneOptionalVec(frame.command.finalConstraintVelocity)
    },
    outcome: {
      ...frame.outcome,
      companionPosition: { ...frame.outcome.companionPosition },
      companionRequestedVelocity: { ...frame.outcome.companionRequestedVelocity },
      companionActualVelocity: { ...frame.outcome.companionActualVelocity },
      companionContacts: [...frame.outcome.companionContacts],
      playerPosition: cloneOptionalVec(frame.outcome.playerPosition) ?? undefined,
      playerRequestedVelocity: cloneOptionalVec(frame.outcome.playerRequestedVelocity) ?? undefined,
      playerActualVelocity: cloneOptionalVec(frame.outcome.playerActualVelocity) ?? undefined,
      playerContacts: frame.outcome.playerContacts
        ? [...frame.outcome.playerContacts]
        : undefined
    },
    post: {
      ...frame.post,
      retryBudgetUsedThisEpisode:
        frame.post.retryBudgetUsedThisEpisode ?? frame.post.retryCount ?? null,
      cumulativeLocalRetriesSinceReset:
        frame.post.cumulativeLocalRetriesSinceReset ?? frame.post.appliedLocalRetries ?? null
    }
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
