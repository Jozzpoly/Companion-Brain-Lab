import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import type { ShadowRelationshipRegion, ShadowRegionSample } from "./shadow-relationship-region";

const REGION_SETTLE_TOLERANCE = 0.35;
const EPSILON = 1e-9;

export type ShadowPaceLabel = "SETTLED" | "FOLLOWING" | "CATCH_UP" | "RECOVERING";
export type ShadowSeparationTrend = "closing" | "stable" | "opening";

export interface ShadowPaceTerms {
  distancePressure: number;
  openingPressure: number;
  closingRelief: number;
  durationPressure: number;
}

export interface ShadowPaceEvidence {
  tick: number;
  label: ShadowPaceLabel;
  regionState: ShadowRelationshipRegion["state"];
  physicalSpeedCapability: number;
  playerSpeed: number;
  companionSpeed: number;
  distanceToRegion: number | null;
  routeDistanceToRegion: number | null;
  insideUsefulRegion: boolean;
  relativeOpeningSpeed: number | null;
  separationTrend: ShadowSeparationTrend | "unknown";
  outsideRegionTicks: number;
  urgency: number;
  desiredSpeed: number;
  terms: ShadowPaceTerms;
  reason: string;
}

export interface ShadowPaceInput {
  snapshot: WorldSnapshot;
  region: ShadowRelationshipRegion;
  physicalSpeedCapability: number;
  outsideRegionTicks?: number;
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing ${id} actor for shadow pace evidence.`);
  return result;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2): Vec2 {
  const length = magnitude(value);
  return length > EPSILON ? { x: value.x / length, y: value.y / length } : { x: 0, y: 0 };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function observedPlayerVelocity(player: ActorSnapshot): Vec2 {
  if (magnitude(player.actualVelocity) > 0.15) return player.actualVelocity;
  if (magnitude(player.requestedVelocity) > 0.15) return player.requestedVelocity;
  return { x: 0, y: 0 };
}

function coherentSamples(region: ShadowRelationshipRegion): ShadowRegionSample[] {
  if (region.coherentSampleIds.length === 0) return [];
  const ids = new Set(region.coherentSampleIds);
  return region.samples.filter((sample) => ids.has(sample.id));
}

function closestDistanceToRegion(companion: ActorSnapshot, region: ShadowRelationshipRegion): number | null {
  const samples = coherentSamples(region);
  if (samples.length === 0) return null;
  let best = Number.POSITIVE_INFINITY;
  for (const sample of samples) best = Math.min(best, distance(companion.position, sample.position));
  return Number.isFinite(best) ? best : null;
}

function bestRouteDistance(region: ShadowRelationshipRegion): number | null {
  if (!region.bestSampleId) return null;
  return region.samples.find((sample) => sample.id === region.bestSampleId)?.routeCost ?? null;
}

function separationTrend(value: number): ShadowSeparationTrend {
  if (value > 0.08) return "opening";
  if (value < -0.08) return "closing";
  return "stable";
}

export function evaluateShadowPace(input: ShadowPaceInput): ShadowPaceEvidence {
  if (!Number.isFinite(input.physicalSpeedCapability) || input.physicalSpeedCapability <= 0) {
    throw new Error("Shadow pace requires a finite positive physical speed capability.");
  }

  const player = actor(input.snapshot, "player");
  const companion = actor(input.snapshot, "companion");
  const playerVelocity = observedPlayerVelocity(player);
  const playerSpeed = magnitude(playerVelocity);
  const companionSpeed = magnitude(companion.actualVelocity);
  const outsideRegionTicks = Math.max(0, Math.floor(input.outsideRegionTicks ?? 0));
  const zeroTerms: ShadowPaceTerms = {
    distancePressure: 0,
    openingPressure: 0,
    closingRelief: 0,
    durationPressure: 0
  };

  if (input.region.state !== "REGION" || !input.region.representativeAnchor) {
    return {
      tick: input.snapshot.tick,
      label: "RECOVERING",
      regionState: input.region.state,
      physicalSpeedCapability: input.physicalSpeedCapability,
      playerSpeed,
      companionSpeed,
      distanceToRegion: null,
      routeDistanceToRegion: null,
      insideUsefulRegion: false,
      relativeOpeningSpeed: null,
      separationTrend: "unknown",
      outsideRegionTicks,
      urgency: 1,
      desiredSpeed: input.physicalSpeedCapability,
      terms: { ...zeroTerms, distancePressure: 1 },
      reason: "no reachable shadow relationship region; expose maximum recovery pressure without inventing a target"
    };
  }

  const distanceToRegion = closestDistanceToRegion(companion, input.region);
  const routeDistanceToRegion = bestRouteDistance(input.region);
  if (distanceToRegion === null) {
    throw new Error("REGION shadow evidence must contain at least one coherent sample.");
  }

  const toAnchor = {
    x: input.region.representativeAnchor.x - companion.position.x,
    y: input.region.representativeAnchor.y - companion.position.y
  };
  const anchorDirection = normalized(toAnchor);
  const relativeVelocity = {
    x: playerVelocity.x - companion.actualVelocity.x,
    y: playerVelocity.y - companion.actualVelocity.y
  };
  const relativeOpeningSpeed = magnitude(anchorDirection) > 0.5 ? dot(relativeVelocity, anchorDirection) : 0;
  const motionRatio = clamp(relativeOpeningSpeed / input.physicalSpeedCapability, -1, 1);

  const insideUsefulRegion = distanceToRegion <= REGION_SETTLE_TOLERANCE;
  const distancePressure = clamp((distanceToRegion - 0.2) / 2.4, 0, 1);
  const openingPressure = Math.max(0, motionRatio);
  const closingRelief = Math.max(0, -motionRatio);
  const durationPressure = clamp(outsideRegionTicks / 120, 0, 1);
  const urgency = insideUsefulRegion
    ? clamp(openingPressure * 0.25, 0, 0.25)
    : clamp(
        distancePressure * 0.65 +
        openingPressure * 0.25 +
        durationPressure * 0.1 -
        closingRelief * 0.2,
        0,
        1
      );

  const ordinaryPace = Math.min(
    input.physicalSpeedCapability,
    Math.max(input.physicalSpeedCapability * 0.55, playerSpeed)
  );
  const desiredSpeed = insideUsefulRegion && playerSpeed < 0.15
    ? 0
    : clamp(
        ordinaryPace + urgency * (input.physicalSpeedCapability - ordinaryPace),
        0,
        input.physicalSpeedCapability
      );

  const label: ShadowPaceLabel = insideUsefulRegion && urgency < 0.15
    ? "SETTLED"
    : urgency >= 0.6
      ? "CATCH_UP"
      : "FOLLOWING";

  return {
    tick: input.snapshot.tick,
    label,
    regionState: input.region.state,
    physicalSpeedCapability: input.physicalSpeedCapability,
    playerSpeed,
    companionSpeed,
    distanceToRegion,
    routeDistanceToRegion,
    insideUsefulRegion,
    relativeOpeningSpeed,
    separationTrend: separationTrend(relativeOpeningSpeed),
    outsideRegionTicks,
    urgency,
    desiredSpeed,
    terms: {
      distancePressure,
      openingPressure,
      closingRelief,
      durationPressure
    },
    reason: `${label}: distance=${distanceToRegion.toFixed(2)}, opening=${relativeOpeningSpeed.toFixed(2)}, urgency=${urgency.toFixed(2)}`
  };
}

export const CCC0_PACE_REGION_SETTLE_TOLERANCE = REGION_SETTLE_TOLERANCE;
