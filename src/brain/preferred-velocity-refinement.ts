import type { StaticTraversalQuery } from "../navigation/static-router";
import type { Vec2 } from "../world/types";
import {
  S3_EXPERIMENT_MAX_SPEED,
  S3_PLAYER_BUFFER,
  S3_PREDICTION_HORIZON_SECONDS,
  S3_STATIC_CLEARANCE,
  type SpatialLocomotionDecision,
  type SpatialVelocityCandidate
} from "./spatial-locomotion";

const EPSILON = 1e-9;
const SCORE_WINDOW = 0.45;
const ANGULAR_NEIGHBOR_DOT = 0.65;
const MAX_CONTRIBUTORS = 6;
const SCORE_TEMPERATURE = 0.22;

export interface PreferredVelocityRefinement {
  source: "coarse-selected" | "weighted-local-refinement" | "refinement-rejected-static" | "refinement-rejected-player";
  coarseMove: Vec2;
  refinedMove: Vec2;
  contributorIds: readonly string[];
  staticClear: boolean;
  minimumPlayerClearance: number;
  angularDeltaDegrees: number;
}

function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function normalized(v: Vec2): Vec2 {
  const length = magnitude(v);
  return length > EPSILON ? { x: v.x / length, y: v.y / length } : { x: 0, y: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addScaled(origin: Vec2, vector: Vec2, scale: number): Vec2 {
  return { x: origin.x + vector.x * scale, y: origin.y + vector.y * scale };
}

function candidateDirection(candidate: SpatialVelocityCandidate): Vec2 {
  return normalized(candidate.move);
}

function minimumDynamicClearance(decision: SpatialLocomotionDecision, candidateVelocity: Vec2): number {
  const o = decision.observation;
  const relativePosition = {
    x: o.playerPosition.x - o.companionPosition.x,
    y: o.playerPosition.y - o.companionPosition.y
  };
  const relativeVelocity = {
    x: o.playerVelocity.x - candidateVelocity.x,
    y: o.playerVelocity.y - candidateVelocity.y
  };
  const speedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = speedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / speedSquared, 0, S3_PREDICTION_HORIZON_SECONDS)
    : 0;
  const closest = addScaled(relativePosition, relativeVelocity, closestTime);
  return magnitude(closest) - (o.companionRadius + o.playerRadius + S3_PLAYER_BUFFER);
}

function angularDeltaDegrees(a: Vec2, b: Vec2): number {
  const na = normalized(a);
  const nb = normalized(b);
  if (magnitude(na) < 0.5 || magnitude(nb) < 0.5) return 0;
  const cosine = clamp(dot(na, nb), -1, 1);
  return Math.acos(cosine) * 180 / Math.PI;
}

export function refinePreferredVelocity(
  decision: SpatialLocomotionDecision,
  query: StaticTraversalQuery
): PreferredVelocityRefinement {
  const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
  if (!selected || selected.hardRejected || selected.speedFraction < 0.05) {
    return {
      source: "coarse-selected",
      coarseMove: { ...decision.selectedMove },
      refinedMove: { ...decision.selectedMove },
      contributorIds: selected ? [selected.id] : [],
      staticClear: true,
      minimumPlayerClearance: selected?.minimumPlayerClearance ?? Number.POSITIVE_INFINITY,
      angularDeltaDegrees: 0
    };
  }

  const selectedDirection = candidateDirection(selected);
  const local = decision.candidates
    .filter((candidate) => {
      if (candidate.hardRejected || candidate.speedFraction < 0.05) return false;
      if (candidate.score > selected.score + SCORE_WINDOW) return false;
      return dot(selectedDirection, candidateDirection(candidate)) >= ANGULAR_NEIGHBOR_DOT;
    })
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, MAX_CONTRIBUTORS);

  if (local.length < 2) {
    return {
      source: "coarse-selected",
      coarseMove: { ...selected.move },
      refinedMove: { ...selected.move },
      contributorIds: [selected.id],
      staticClear: true,
      minimumPlayerClearance: selected.minimumPlayerClearance,
      angularDeltaDegrees: 0
    };
  }

  let totalWeight = 0;
  let x = 0;
  let y = 0;
  for (const candidate of local) {
    const weight = Math.exp(-(candidate.score - selected.score) / SCORE_TEMPERATURE);
    totalWeight += weight;
    x += candidate.move.x * weight;
    y += candidate.move.y * weight;
  }
  const refinedMove = totalWeight > EPSILON ? { x: x / totalWeight, y: y / totalWeight } : { ...selected.move };
  if (magnitude(refinedMove) < 0.04) {
    return {
      source: "coarse-selected",
      coarseMove: { ...selected.move },
      refinedMove: { ...selected.move },
      contributorIds: local.map((candidate) => candidate.id),
      staticClear: true,
      minimumPlayerClearance: selected.minimumPlayerClearance,
      angularDeltaDegrees: 0
    };
  }

  const worldVelocity = {
    x: refinedMove.x * S3_EXPERIMENT_MAX_SPEED,
    y: refinedMove.y * S3_EXPERIMENT_MAX_SPEED
  };
  const predicted = addScaled(decision.observation.companionPosition, worldVelocity, S3_PREDICTION_HORIZON_SECONDS);
  const traversal = query(
    decision.observation.companionPosition,
    predicted,
    decision.observation.companionRadius + S3_STATIC_CLEARANCE
  );
  const playerClearance = minimumDynamicClearance(decision, worldVelocity);
  const currentPlayerDistance = Math.hypot(
    decision.observation.playerPosition.x - decision.observation.companionPosition.x,
    decision.observation.playerPosition.y - decision.observation.companionPosition.y
  );
  const hardPlayerDistance = decision.observation.companionRadius + decision.observation.playerRadius + S3_PLAYER_BUFFER;

  if (!traversal.clear) {
    return {
      source: "refinement-rejected-static",
      coarseMove: { ...selected.move },
      refinedMove: { ...selected.move },
      contributorIds: local.map((candidate) => candidate.id),
      staticClear: false,
      minimumPlayerClearance: playerClearance,
      angularDeltaDegrees: 0
    };
  }
  if (currentPlayerDistance > hardPlayerDistance && playerClearance < 0) {
    return {
      source: "refinement-rejected-player",
      coarseMove: { ...selected.move },
      refinedMove: { ...selected.move },
      contributorIds: local.map((candidate) => candidate.id),
      staticClear: true,
      minimumPlayerClearance: playerClearance,
      angularDeltaDegrees: 0
    };
  }

  return {
    source: "weighted-local-refinement",
    coarseMove: { ...selected.move },
    refinedMove,
    contributorIds: local.map((candidate) => candidate.id),
    staticClear: true,
    minimumPlayerClearance: playerClearance,
    angularDeltaDegrees: angularDeltaDegrees(selected.move, refinedMove)
  };
}
