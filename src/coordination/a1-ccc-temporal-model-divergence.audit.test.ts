import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import {
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationEvidence,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { evaluateShadowCoordinationFrame, type ShadowCoordinationFrame } from "./shadow-coordination-frame";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`A1/CCC divergence audit missing ${id}.`);
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

describe("A1/CCC temporal model divergence audit", () => {
  it("keeps Owner semantic memory opposite to CCC solver-motion memory after a real head-on push and release", async () => {
    const world = await LabWorld.create("head-on");
    let snapshot = world.snapshot();
    let memory: A1RelationshipOrientationMemory | null = null;
    let contactTick: number | null = null;
    let externalTick: number | null = null;
    let externalA1: A1RelationshipOrientationEvidence | null = null;
    let externalSituation: A1Situation | null = null;
    let cccExternal: ShadowCoordinationFrame | null = null;

    try {
      // Establish fresh +X Owner semantics while the two bodies close head-on.
      for (let step = 0; step < 90; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 1, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        expect(observed.orientation.source).toBe("SAME_STEP_OWNER");
        expect(observed.orientation.direction).toEqual({ x: 1, y: 0 });

        snapshot = world.step([
          motion("player", { x: 1, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
        if (hasContact(snapshot)) {
          contactTick = snapshot.tick;
          break;
        }
      }

      expect(contactTick).not.toBeNull();

      // The Owner now releases movement while the companion keeps pushing left.
      // Find a real completed World step where the player's body moves materially
      // despite a zero request and reciprocal contact proves an external cause.
      for (let step = 0; step < 28; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const player = actor(snapshot, "player");
        const externallyDriven =
          observed.situation.situated.playerMotionProvenance.state === "EXTERNAL_MOTION_EVIDENT" &&
          magnitude(player.requestedVelocity) < 0.08 &&
          player.actualVelocity.x < -0.15 &&
          hasContact(snapshot);

        if (externallyDriven) {
          externalTick = snapshot.tick;
          externalA1 = observed.orientation;
          externalSituation = observed.situation;
          cccExternal = evaluateShadowCoordinationFrame({
            snapshot,
            query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
            physicalSpeedCapability: world.actorMovementCapability("companion").maxSpeed
          });
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
      }

      expect(externalTick).not.toBeNull();
      expect(externalSituation?.situated.playerMotionProvenance.state).toBe("EXTERNAL_MOTION_EVIDENT");
      expect(externalA1?.source).toBe("OWNER_MEMORY");
      expect(externalA1?.direction).toEqual({ x: 1, y: 0 });
      expect(cccExternal?.region.playerHeadingSource).toBe("actual");
      expect(cccExternal?.region.playerDirection.x).toBeLessThan(-0.9);
      expect(cccExternal?.nextHistory.previousPlayerDirection?.x).toBeLessThan(-0.9);
      expect(cccExternal?.nextHistory.previousPlayerDirectionAgeTicks).toBe(0);

      if (!cccExternal || externalTick === null) return;

      // Separate the bodies while the Owner remains released. A1 must preserve
      // bounded Owner-derived +X semantics; CCC must preserve the solver-derived
      // -X trajectory in its own fading history after the body is stationary.
      snapshot = world.step([
        motion("player", { x: 0, y: 0 }),
        motion("companion", { x: 1, y: 0 })
      ]);

      let releaseTick: number | null = null;
      let releaseA1: A1RelationshipOrientationEvidence | null = null;
      let cccRelease: ShadowCoordinationFrame | null = null;

      for (let step = 0; step < 20; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const player = actor(snapshot, "player");
        const physicallyReleased =
          !hasContact(snapshot) &&
          magnitude(player.requestedVelocity) < 0.08 &&
          magnitude(player.actualVelocity) < 0.08;

        if (physicallyReleased) {
          releaseTick = snapshot.tick;
          releaseA1 = observed.orientation;
          cccRelease = evaluateShadowCoordinationFrame({
            snapshot,
            query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
            physicalSpeedCapability: world.actorMovementCapability("companion").maxSpeed,
            history: cccExternal.nextHistory
          });
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 1, y: 0 })
        ]);
      }

      expect(releaseTick).not.toBeNull();
      expect(releaseA1?.source).toBe("OWNER_MEMORY");
      expect(releaseA1?.direction).toEqual({ x: 1, y: 0 });
      expect(cccRelease?.region.playerHeadingSource).toBe("previous");
      expect(cccRelease?.region.playerDirection.x).toBeLessThan(-0.9);
      expect(cccRelease?.region.playerHeadingStrength).toBeGreaterThan(0);

      const a1Direction = releaseA1?.direction;
      const cccDirection = cccRelease?.region.playerDirection;
      expect(a1Direction).not.toBeNull();
      expect(cccDirection).not.toBeNull();
      if (!a1Direction || !cccDirection || releaseTick === null) return;
      expect(dot(a1Direction, cccDirection)).toBeLessThan(-0.9);

      console.info("[A1_CCC_TEMPORAL_DIVERGENCE_REAL_WORLD]", JSON.stringify({
        contactTick,
        externalTick,
        releaseTick,
        externalProvenance: externalSituation?.situated.playerMotionProvenance.state,
        a1External: {
          source: externalA1?.source,
          direction: externalA1?.direction,
          ageTicks: externalA1?.ageTicks,
          strength: externalA1?.strength
        },
        cccExternal: {
          source: cccExternal.region.playerHeadingSource,
          direction: cccExternal.region.playerDirection
        },
        a1Release: {
          source: releaseA1.source,
          direction: releaseA1.direction,
          ageTicks: releaseA1.ageTicks,
          strength: releaseA1.strength
        },
        cccRelease: {
          source: cccRelease.region.playerHeadingSource,
          direction: cccRelease.region.playerDirection,
          strength: cccRelease.region.playerHeadingStrength
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
