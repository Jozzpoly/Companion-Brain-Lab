import type { StaticTraversalQuery } from "../navigation/static-router";
import type { Vec2, WorldSnapshot } from "../world/types";
import { evaluateShadowPace, type ShadowPaceEvidence } from "./shadow-pace";
import {
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
  previousPlayerDirection: Vec2 | null;
  previousCorridorDirection: Vec2 | null;
  outsideRegionTicks: number;
}

export interface ShadowLegacyComparison {
  relationshipTarget: Vec2 | null;
  preferredVelocity: Vec2 | null;
  targetToShadowAnchorDistance: number | null;
  targetToNearestCoherentSampleDistance: number | null;
}

export interface ShadowCoordinationFrame {
  kind: "CCC0_SHADOW_COORDINATION";
  tick: number;
  region: ShadowRelationshipRegion;
  pace: ShadowPaceEvidence;
  playerCorridor: ShadowPlayerCorridor;
  playerFlowConflict: ShadowPlayerFlowConflict;
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
}

const EMPTY_HISTORY: ShadowCoordinationHistory = {
  previousRepresentative: null,
  previousPlayerDirection: null,
  previousCorridorDirection: null,
  outsideRegionTicks: 0
};

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizedHistory(history: ShadowCoordinationFrameInput["history"]): ShadowCoordinationHistory {
  return {
    previousRepresentative: history?.previousRepresentative
      ? { ...history.previousRepresentative }
      : null,
    previousPlayerDirection: history?.previousPlayerDirection
      ? { ...history.previousPlayerDirection }
      : null,
    previousCorridorDirection: history?.previousCorridorDirection
      ? { ...history.previousCorridorDirection }
      : null,
    outsideRegionTicks: Math.max(0, Math.floor(history?.outsideRegionTicks ?? 0))
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

export function createEmptyShadowCoordinationHistory(): ShadowCoordinationHistory {
  return {
    previousRepresentative: null,
    previousPlayerDirection: null,
    previousCorridorDirection: null,
    outsideRegionTicks: 0
  };
}

export function evaluateShadowCoordinationFrame(
  input: ShadowCoordinationFrameInput
): ShadowCoordinationFrame {
  const history = input.history ? normalizedHistory(input.history) : { ...EMPTY_HISTORY };
  const region = evaluateShadowRelationshipRegion({
    snapshot: input.snapshot,
    query: input.query,
    previousRepresentative: history.previousRepresentative,
    previousPlayerDirection: history.previousPlayerDirection
  });
  const playerCorridor = evaluateShadowPlayerCorridor({
    snapshot: input.snapshot,
    previousDirection: history.previousCorridorDirection
  });
  const pace = evaluateShadowPace({
    snapshot: input.snapshot,
    region,
    physicalSpeedCapability: input.physicalSpeedCapability,
    outsideRegionTicks: history.outsideRegionTicks
  });
  const playerFlowConflict = evaluateShadowPlayerFlowConflict({
    snapshot: input.snapshot,
    corridor: playerCorridor,
    legacyPreferredVelocity: input.legacyPreferredVelocity
  });

  const relationshipTarget = input.legacyRelationshipTarget
    ? { ...input.legacyRelationshipTarget }
    : null;
  const preferredVelocity = input.legacyPreferredVelocity
    ? { ...input.legacyPreferredVelocity }
    : null;

  const targetToShadowAnchorDistance = relationshipTarget && region.representativeAnchor
    ? distance(relationshipTarget, region.representativeAnchor)
    : null;
  const targetToNearestCoherentSampleDistance = relationshipTarget
    ? nearestCoherentSampleDistance(region, relationshipTarget)
    : null;

  const nextHistory: ShadowCoordinationHistory = {
    previousRepresentative: region.representativeAnchor ? { ...region.representativeAnchor } : null,
    previousPlayerDirection: { ...region.playerDirection },
    previousCorridorDirection: playerCorridor.state === "STATIONARY"
      ? history.previousCorridorDirection
        ? { ...history.previousCorridorDirection }
        : null
      : { ...playerCorridor.direction },
    outsideRegionTicks: pace.insideUsefulRegion ? 0 : history.outsideRegionTicks + 1
  };

  return {
    kind: "CCC0_SHADOW_COORDINATION",
    tick: input.snapshot.tick,
    region,
    pace,
    playerCorridor,
    playerFlowConflict,
    legacy: {
      relationshipTarget,
      preferredVelocity,
      targetToShadowAnchorDistance,
      targetToNearestCoherentSampleDistance
    },
    nextHistory
  };
}
