import type { StaticTraversalQuery } from "../navigation/static-router";
import type { Vec2, WorldSnapshot } from "../world/types";
import { evaluateShadowPace, type ShadowPaceEvidence } from "./shadow-pace";
import {
  CCC0_CORRIDOR_DIRECTION_MEMORY_TICKS,
  evaluateShadowPlayerCorridor,
  type ShadowPlayerCorridor
} from "./shadow-player-corridor";
import {
  evaluateShadowPlayerFlowConflict,
  type ShadowPlayerFlowConflict
} from "./shadow-player-flow-conflict";
import {
  evaluateShadowRelationshipRegion,
  type ShadowRelationshipRegion
} from "./shadow-relationship-region";

export interface ShadowCoordinationHistory {
  previousRepresentative: Vec2 | null;
  previousRegionTopologyKey: string | null;
  previousCoherentSampleIds: readonly string[];
  previousPlayerDirection: Vec2 | null;
  previousPlayerDirectionAgeTicks: number | null;
  previousCorridorDirection: Vec2 | null;
  previousCorridorDirectionAgeTicks: number | null;
  outsideRegionTicks: number;
  previousEvaluationTick: number | null;
}

export interface ShadowRegionContinuityEvidence {
  previousRegionPresent: boolean;
  currentRegionPresent: boolean;
  previousTopologyKey: string | null;
  currentTopologyKey: string | null;
  topologyKeyChanged: boolean | null;
  coherentSampleOverlapRatio: number | null;
  anchorDisplacement: number | null;
}

export interface ShadowLegacyComparison {
  relationshipTarget: Vec2 | null;
  preferredVelocity: Vec2 | null;
  authoritativeVelocity: Vec2 | null;
  targetToShadowAnchorDistance: number | null;
  targetToNearestCoherentSampleDistance: number | null;
}

export interface ShadowCoordinationFrame {
  kind: "CCC0_SHADOW_COORDINATION";
  tick: number;
  region: ShadowRelationshipRegion;
  regionContinuity: ShadowRegionContinuityEvidence;
  pace: ShadowPaceEvidence;
  playerCorridor: ShadowPlayerCorridor;
  preferredPlayerFlowConflict: ShadowPlayerFlowConflict;
  authoritativePlayerFlowConflict: ShadowPlayerFlowConflict;
  legacy: ShadowLegacyComparison;
  nextHistory: ShadowCoordinationHistory;
}

export interface ShadowCoordinationFrameInput {
  snapshot: WorldSnapshot;
  query: StaticTraversalQuery;
  physicalSpeedCapability: number;
  history?: Partial<ShadowCoordinationHistory> | null;
  legacyRelationshipTarget?: Vec2 | null;
  legacyPreferredVelocity?: Vec2 | null;
  legacyAuthoritativeVelocity?: Vec2 | null;
}

const EMPTY_HISTORY: ShadowCoordinationHistory = {
  previousRepresentative: null,
  previousRegionTopologyKey: null,
  previousCoherentSampleIds: [],
  previousPlayerDirection: null,
  previousPlayerDirectionAgeTicks: null,
  previousCorridorDirection: null,
  previousCorridorDirectionAgeTicks: null,
  outsideRegionTicks: 0,
  previousEvaluationTick: null
};

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizedAge(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : null;
}

function normalizedHistory(history: ShadowCoordinationFrameInput["history"]): ShadowCoordinationHistory {
  const previousEvaluationTick = Number.isFinite(history?.previousEvaluationTick)
    ? Math.floor(history!.previousEvaluationTick!)
    : null;
  return {
    previousRepresentative: history?.previousRepresentative
      ? { ...history.previousRepresentative }
      : null,
    previousRegionTopologyKey: history?.previousRegionTopologyKey ?? null,
    previousCoherentSampleIds: [...(history?.previousCoherentSampleIds ?? [])],
    previousPlayerDirection: history?.previousPlayerDirection
      ? { ...history.previousPlayerDirection }
      : null,
    previousPlayerDirectionAgeTicks: normalizedAge(history?.previousPlayerDirectionAgeTicks),
    previousCorridorDirection: history?.previousCorridorDirection
      ? { ...history.previousCorridorDirection }
      : null,
    previousCorridorDirectionAgeTicks: normalizedAge(history?.previousCorridorDirectionAgeTicks),
    outsideRegionTicks: Math.max(0, Math.floor(history?.outsideRegionTicks ?? 0)),
    previousEvaluationTick
  };
}

function nearestCoherentSampleDistance(region: ShadowRelationshipRegion, point: Vec2): number | null {
  if (region.coherentSampleIds.length === 0) return null;
  const ids = new Set(region.coherentSampleIds);
  let best = Number.POSITIVE_INFINITY;
  for (const sample of region.samples) {
    if (!ids.has(sample.id)) continue;
    best = Math.min(best, distance(point, sample.position));
  }
  return Number.isFinite(best) ? best : null;
}

function coherentSampleOverlapRatio(previous: readonly string[], current: readonly string[]): number | null {
  if (previous.length === 0 || current.length === 0) return null;
  const previousIds = new Set(previous);
  const currentIds = new Set(current);
  let intersection = 0;
  for (const id of previousIds) if (currentIds.has(id)) intersection += 1;
  const union = new Set([...previousIds, ...currentIds]).size;
  return union > 0 ? intersection / union : null;
}

function agedDirection(
  direction: Vec2 | null,
  ageTicks: number | null,
  elapsedWorldTicks: number
): { direction: Vec2 | null; ageTicks: number | null } {
  if (!direction) return { direction: null, ageTicks: null };
  return {
    direction: { ...direction },
    ageTicks: (ageTicks ?? 0) + elapsedWorldTicks
  };
}

function freshDirection(value: { direction: Vec2 | null; ageTicks: number | null }): Vec2 | null {
  return value.direction && (value.ageTicks ?? 0) <= CCC0_CORRIDOR_DIRECTION_MEMORY_TICKS
    ? { ...value.direction }
    : null;
}

export function createEmptyShadowCoordinationHistory(): ShadowCoordinationHistory {
  return {
    previousRepresentative: null,
    previousRegionTopologyKey: null,
    previousCoherentSampleIds: [],
    previousPlayerDirection: null,
    previousPlayerDirectionAgeTicks: null,
    previousCorridorDirection: null,
    previousCorridorDirectionAgeTicks: null,
    outsideRegionTicks: 0,
    previousEvaluationTick: null
  };
}

export function evaluateShadowCoordinationFrame(
  input: ShadowCoordinationFrameInput
): ShadowCoordinationFrame {
  const history = input.history ? normalizedHistory(input.history) : { ...EMPTY_HISTORY, previousCoherentSampleIds: [] };
  const elapsedWorldTicks = history.previousEvaluationTick === null
    ? 1
    : Math.max(1, input.snapshot.tick - history.previousEvaluationTick);
  const outsideRegionTicksAtObservation = history.outsideRegionTicks + elapsedWorldTicks;
  const agedPlayerDirection = agedDirection(
    history.previousPlayerDirection,
    history.previousPlayerDirectionAgeTicks,
    elapsedWorldTicks
  );
  const agedCorridorDirection = agedDirection(
    history.previousCorridorDirection,
    history.previousCorridorDirectionAgeTicks,
    elapsedWorldTicks
  );
  const freshPlayerDirection = freshDirection(agedPlayerDirection);
  const freshCorridorDirection = freshDirection(agedCorridorDirection);

  const region = evaluateShadowRelationshipRegion({
    snapshot: input.snapshot,
    query: input.query,
    previousRepresentative: history.previousRepresentative,
    previousPlayerDirection: freshPlayerDirection,
    previousPlayerDirectionAgeTicks: agedPlayerDirection.ageTicks
  });
  const playerCorridor = evaluateShadowPlayerCorridor({
    snapshot: input.snapshot,
    previousDirection: freshCorridorDirection,
    previousDirectionAgeTicks: agedCorridorDirection.ageTicks
  });
  const pace = evaluateShadowPace({
    snapshot: input.snapshot,
    region,
    physicalSpeedCapability: input.physicalSpeedCapability,
    outsideRegionTicks: outsideRegionTicksAtObservation
  });
  const preferredPlayerFlowConflict = evaluateShadowPlayerFlowConflict({
    snapshot: input.snapshot,
    corridor: playerCorridor,
    companionVelocity: input.legacyPreferredVelocity,
    velocitySource: "legacy-preferred"
  });
  const authoritativePlayerFlowConflict = evaluateShadowPlayerFlowConflict({
    snapshot: input.snapshot,
    corridor: playerCorridor,
    companionVelocity: input.legacyAuthoritativeVelocity,
    velocitySource: "authoritative-command"
  });

  const relationshipTarget = input.legacyRelationshipTarget
    ? { ...input.legacyRelationshipTarget }
    : null;
  const preferredVelocity = input.legacyPreferredVelocity
    ? { ...input.legacyPreferredVelocity }
    : null;
  const authoritativeVelocity = input.legacyAuthoritativeVelocity
    ? { ...input.legacyAuthoritativeVelocity }
    : null;

  const targetToShadowAnchorDistance = relationshipTarget && region.representativeAnchor
    ? distance(relationshipTarget, region.representativeAnchor)
    : null;
  const targetToNearestCoherentSampleDistance = relationshipTarget
    ? nearestCoherentSampleDistance(region, relationshipTarget)
    : null;

  const hadPreviousObservation = history.previousEvaluationTick !== null;
  const regionContinuity: ShadowRegionContinuityEvidence = {
    previousRegionPresent: hadPreviousObservation && history.previousRegionTopologyKey !== null,
    currentRegionPresent: region.topologyKey !== null,
    previousTopologyKey: history.previousRegionTopologyKey,
    currentTopologyKey: region.topologyKey,
    topologyKeyChanged: hadPreviousObservation
      ? history.previousRegionTopologyKey !== region.topologyKey
      : null,
    coherentSampleOverlapRatio: coherentSampleOverlapRatio(
      history.previousCoherentSampleIds,
      region.coherentSampleIds
    ),
    anchorDisplacement: history.previousRepresentative && region.representativeAnchor
      ? distance(history.previousRepresentative, region.representativeAnchor)
      : null
  };

  const regionHasFreshMotion = region.playerHeadingSource === "actual" || region.playerHeadingSource === "requested";
  const nextPlayerDirection = regionHasFreshMotion
    ? { direction: { ...region.playerDirection }, ageTicks: 0 }
    : region.playerHeadingSource === "previous" && freshPlayerDirection
      ? { direction: { ...freshPlayerDirection }, ageTicks: agedPlayerDirection.ageTicks }
      : { direction: null, ageTicks: null };
  const corridorHasFreshMotion = playerCorridor.velocitySource === "actual" || playerCorridor.velocitySource === "requested";
  const nextCorridorDirection = corridorHasFreshMotion
    ? { direction: { ...playerCorridor.direction }, ageTicks: 0 }
    : playerCorridor.previousDirection
      ? { direction: { ...playerCorridor.previousDirection }, ageTicks: agedCorridorDirection.ageTicks }
      : { direction: null, ageTicks: null };

  const nextHistory: ShadowCoordinationHistory = {
    previousRepresentative: region.representativeAnchor ? { ...region.representativeAnchor } : null,
    previousRegionTopologyKey: region.topologyKey,
    previousCoherentSampleIds: [...region.coherentSampleIds],
    previousPlayerDirection: nextPlayerDirection.direction,
    previousPlayerDirectionAgeTicks: nextPlayerDirection.ageTicks,
    previousCorridorDirection: nextCorridorDirection.direction,
    previousCorridorDirectionAgeTicks: nextCorridorDirection.ageTicks,
    outsideRegionTicks: pace.insideUsefulRegion ? 0 : outsideRegionTicksAtObservation,
    previousEvaluationTick: input.snapshot.tick
  };

  return {
    kind: "CCC0_SHADOW_COORDINATION",
    tick: input.snapshot.tick,
    region,
    regionContinuity,
    pace,
    playerCorridor,
    preferredPlayerFlowConflict,
    authoritativePlayerFlowConflict,
    legacy: {
      relationshipTarget,
      preferredVelocity,
      authoritativeVelocity,
      targetToShadowAnchorDistance,
      targetToNearestCoherentSampleDistance
    },
    nextHistory
  };
}