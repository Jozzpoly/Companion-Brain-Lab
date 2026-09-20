import { describe, expect, it } from "vitest";
import { LabWorld, WORLD_STEP_SECONDS } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import {
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationEvidence,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import {
  evaluateA1RelationshipUtility,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";
import { buildA1Situation, type A1Situation } from "./a1-situation";

const PREDICTION_HORIZONS = {
  nextStep: WORLD_STEP_SECONDS,
  short: 0.12,
  interaction: 0.35
} as const;

type PredictionName = keyof typeof PREDICTION_HORIZONS;

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`A1 lifecycle audit missing ${id}.`);
  return value;
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hasContact(snapshot: WorldSnapshot): boolean {
  return actor(snapshot, "player").contacts.some((contact) => contact.with === "companion") &&
    actor(snapshot, "companion").contacts.some((contact) => contact.with === "player");
}

function observeA1(input: {
  world: LabWorld;
  snapshot: WorldSnapshot;
  ownerMove: Vec2;
  memory: A1RelationshipOrientationMemory | null;
}): {
  situation: A1Situation;
  orientation: A1RelationshipOrientationEvidence;
  nextMemory: A1RelationshipOrientationMemory | null;
} {
  const situation = buildA1Situation({
    snapshot: input.snapshot,
    playerIntent: motion("player", input.ownerMove),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: input.snapshot.tick === 0
      ? null
      : input.world.latestAuthorityA0StepEvidence()
  });
  const orientation = evaluateA1RelationshipOrientation({
    situation,
    memory: input.memory
  });
  return { situation, orientation, nextMemory: orientation.nextMemory };
}

function commandedVelocity(move: Vec2, maxSpeed: number): Vec2 {
  const length = magnitude(move);
  const bounded = length > 1
    ? { x: move.x / length, y: move.y / length }
    : move;
  return { x: bounded.x * maxSpeed, y: bounded.y * maxSpeed };
}

function predictedPhysicalClearance(input: {
  snapshot: WorldSnapshot;
  playerMove: Vec2;
  companionMove: Vec2;
  playerMaxSpeed: number;
  companionMaxSpeed: number;
  horizon: number;
}): number {
  const player = actor(input.snapshot, "player");
  const companion = actor(input.snapshot, "companion");
  const playerVelocity = commandedVelocity(input.playerMove, input.playerMaxSpeed);
  const companionVelocity = commandedVelocity(input.companionMove, input.companionMaxSpeed);
  const relativePosition = {
    x: companion.position.x - player.position.x,
    y: companion.position.y - player.position.y
  };
  const relativeVelocity = {
    x: companionVelocity.x - playerVelocity.x,
    y: companionVelocity.y - playerVelocity.y
  };
  const relativeSpeedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = relativeSpeedSquared > 1e-12
    ? clamp(-dot(relativePosition, relativeVelocity) / relativeSpeedSquared, 0, input.horizon)
    : 0;
  const closestRelative = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime
  };
  return magnitude(closestRelative) - (player.radius + companion.radius);
}

describe("A1 temporal interaction lifecycle audit", () => {
  it("separates anticipatory risk, factual conflict, release and semantic resume pressure without creating behavior authority", async () => {
    const world = await LabWorld.create("head-on");
    const playerCapability = world.actorMovementCapability("player");
    const companionCapability = world.actorMovementCapability("companion");
    let snapshot = world.snapshot();
    let memory: A1RelationshipOrientationMemory | null = null;

    const firstPredictedConflictTick: Record<PredictionName, number | null> = {
      nextStep: null,
      short: null,
      interaction: null
    };
    let contactTick: number | null = null;
    let ownerReleaseTick: number | null = null;
    let externalDisplacementTick: number | null = null;
    let physicalClearTick: number | null = null;
    let stableClearTick: number | null = null;
    let releaseOrientation: A1RelationshipOrientationEvidence | null = null;
    let externalOrientation: A1RelationshipOrientationEvidence | null = null;
    let stableOrientation: A1RelationshipOrientationEvidence | null = null;
    let stableCurrentUtility: number | null = null;
    let stableBestUtility: number | null = null;
    let stableUtilityGap: number | null = null;

    try {
      const approachPlayer = { x: 1, y: 0 };
      const approachCompanion = { x: -1, y: 0 };

      // COMMAND / APPROACH: the semantic relationship comes from same-step Owner
      // control while several physical prediction horizons become risky at
      // different times. No one horizon is promoted to episode authority here.
      for (let step = 0; step < 90; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: approachPlayer,
          memory
        });
        memory = observed.nextMemory;
        expect(observed.orientation.source).toBe("SAME_STEP_OWNER");
        expect(observed.orientation.direction).toEqual({ x: 1, y: 0 });

        for (const name of Object.keys(PREDICTION_HORIZONS) as PredictionName[]) {
          if (firstPredictedConflictTick[name] !== null) continue;
          const clearance = predictedPhysicalClearance({
            snapshot,
            playerMove: approachPlayer,
            companionMove: approachCompanion,
            playerMaxSpeed: playerCapability.maxSpeed,
            companionMaxSpeed: companionCapability.maxSpeed,
            horizon: PREDICTION_HORIZONS[name]
          });
          if (clearance <= 0) firstPredictedConflictTick[name] = snapshot.tick;
        }

        snapshot = world.step([
          motion("player", approachPlayer),
          motion("companion", approachCompanion)
        ]);
        if (hasContact(snapshot)) {
          contactTick = snapshot.tick;
          break;
        }
      }

      expect(contactTick).not.toBeNull();
      expect(firstPredictedConflictTick.interaction).not.toBeNull();
      expect(firstPredictedConflictTick.short).not.toBeNull();
      expect(firstPredictedConflictTick.nextStep).not.toBeNull();
      if (
        contactTick === null ||
        firstPredictedConflictTick.interaction === null ||
        firstPredictedConflictTick.short === null ||
        firstPredictedConflictTick.nextStep === null
      ) return;

      expect(firstPredictedConflictTick.interaction).toBeLessThan(firstPredictedConflictTick.short);
      expect(firstPredictedConflictTick.short).toBeLessThan(firstPredictedConflictTick.nextStep);
      expect(firstPredictedConflictTick.nextStep).toBeLessThan(contactTick);

      // OWNER RELEASE is deliberately distinct from conflict release: the Owner
      // stops asking to move while the bodies are still in reciprocal contact.
      ownerReleaseTick = snapshot.tick;
      const releasedByOwner = observeA1({
        world,
        snapshot,
        ownerMove: { x: 0, y: 0 },
        memory
      });
      memory = releasedByOwner.nextMemory;
      releaseOrientation = releasedByOwner.orientation;
      expect(hasContact(snapshot)).toBe(true);
      expect(releaseOrientation.source).toBe("OWNER_MEMORY");
      expect(releaseOrientation.direction).toEqual({ x: 1, y: 0 });

      // Keep the companion stimulus pushing for long enough to obtain factual
      // external-displacement provenance under zero Owner request.
      for (let step = 0; step < 16; step += 1) {
        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        if (
          observed.situation.situated.playerMotionProvenance.state === "EXTERNAL_MOTION_EVIDENT" &&
          hasContact(snapshot)
        ) {
          externalDisplacementTick = snapshot.tick;
          externalOrientation = observed.orientation;
          break;
        }
      }

      expect(externalDisplacementTick).not.toBeNull();
      expect(externalOrientation?.source).toBe("OWNER_MEMORY");
      expect(externalOrientation?.direction).toEqual({ x: 1, y: 0 });
      if (externalDisplacementTick === null) return;
      expect(externalDisplacementTick).toBeGreaterThanOrEqual(ownerReleaseTick);

      // PHYSICAL CLEAR: withdraw the companion until reciprocal contact ends.
      // Once clear, stop both bodies so the later resume evidence is not a
      // leftover withdrawal command.
      for (let step = 0; step < 20; step += 1) {
        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 1, y: 0 })
        ]);
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        if (!hasContact(snapshot)) {
          physicalClearTick = snapshot.tick;
          break;
        }
      }

      expect(physicalClearTick).not.toBeNull();
      if (physicalClearTick === null) return;
      expect(physicalClearTick).toBeGreaterThan(externalDisplacementTick);

      // RESUME SIGNAL: after a fully quiet clear step, the temporary physical
      // conflict is gone but the base Owner-derived relationship meaning remains
      // live and the current relative state is still materially below the best
      // utility available under that same semantic objective.
      for (let step = 0; step < 8; step += 1) {
        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 0, y: 0 })
        ]);
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const player = actor(snapshot, "player");
        const companion = actor(snapshot, "companion");
        const quiet =
          !hasContact(snapshot) &&
          magnitude(player.actualVelocity) < 0.08 &&
          magnitude(companion.actualVelocity) < 0.08;
        if (!quiet) continue;

        stableClearTick = snapshot.tick;
        stableOrientation = observed.orientation;
        const current = evaluateA1RelationshipUtility({
          state: {
            relativeOffset: {
              x: companion.position.x - player.position.x,
              y: companion.position.y - player.position.y
            }
          },
          orientation: observed.orientation
        });
        const field = sampleA1RelationshipSemanticField({
          orientation: observed.orientation
        });
        stableCurrentUtility = current.totalUtility;
        stableBestUtility = field.bestUtility;
        stableUtilityGap = field.bestUtility - current.totalUtility;
        break;
      }

      expect(stableClearTick).not.toBeNull();
      expect(stableOrientation?.source).toBe("OWNER_MEMORY");
      expect(stableOrientation?.direction).toEqual({ x: 1, y: 0 });
      expect(stableUtilityGap).not.toBeNull();
      expect(stableUtilityGap ?? 0).toBeGreaterThan(0.5);
      if (
        stableClearTick === null ||
        !stableOrientation ||
        stableCurrentUtility === null ||
        stableBestUtility === null ||
        stableUtilityGap === null
      ) return;

      expect(stableClearTick).toBeGreaterThanOrEqual(physicalClearTick);
      expect(stableOrientation.ageTicks).not.toBeNull();
      expect(stableOrientation.strength).toBeGreaterThan(0);

      console.info("[A1_TEMPORAL_INTERACTION_LIFECYCLE]", JSON.stringify({
        predictionOnsets: firstPredictedConflictTick,
        contactTick,
        ownerReleaseTick,
        externalDisplacementTick,
        physicalClearTick,
        stableClearTick,
        semanticAtOwnerRelease: {
          source: releaseOrientation?.source,
          direction: releaseOrientation?.direction,
          ageTicks: releaseOrientation?.ageTicks
        },
        semanticDuringExternalDisplacement: {
          source: externalOrientation?.source,
          direction: externalOrientation?.direction,
          ageTicks: externalOrientation?.ageTicks
        },
        resumeSignal: {
          orientationSource: stableOrientation.source,
          orientationAgeTicks: stableOrientation.ageTicks,
          orientationStrength: stableOrientation.strength,
          currentUtility: stableCurrentUtility,
          bestSampledUtility: stableBestUtility,
          utilityGap: stableUtilityGap
        },
        interpretation: {
          anticipatoryRiskIsHorizonDependent: true,
          ownerReleaseIsNotPhysicalRelease: ownerReleaseTick < physicalClearTick,
          baseRelationshipMeaningSurvivesConflict: true,
          conflictClearDoesNotEraseRelationshipPressure: stableUtilityGap > 0.5
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
