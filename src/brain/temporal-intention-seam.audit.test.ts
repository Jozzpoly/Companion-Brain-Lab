import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { buildA1Situation } from "../coordination/a1-situation";
import { evaluateA1RelationshipOrientation } from "../coordination/a1-relationship-orientation";
import { evaluateShadowPlayerCorridor } from "../coordination/shadow-player-corridor";
import { classifyObservedPlayerMotion } from "../coordination/situated-evidence";
import { RelationalPositioningBrain } from "./relational-positioning";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2): Vec2 {
  const length = magnitude(value);
  if (length <= 1e-9) return { x: 0, y: 0 };
  return { x: value.x / length, y: value.y / length };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function syntheticSnapshot(options: {
  tick: number;
  playerRequestedVelocity: Vec2;
  playerActualVelocity?: Vec2;
  playerPosition?: Vec2;
  playerContacts?: string[];
}): WorldSnapshot {
  return {
    tick: options.tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [
      {
        id: "companion",
        position: { x: 1, y: 4 },
        radius: 0.3,
        requestedVelocity: { x: 0, y: 0 },
        actualVelocity: { x: 0, y: 0 },
        motionError: 0,
        contacts: []
      },
      {
        id: "player",
        position: { ...(options.playerPosition ?? { x: 4, y: 4 }) },
        radius: 0.3,
        requestedVelocity: { ...options.playerRequestedVelocity },
        actualVelocity: { ...(options.playerActualVelocity ?? options.playerRequestedVelocity) },
        motionError: 0,
        contacts: (options.playerContacts ?? []).map((withId) => ({ with: withId }))
      }
    ],
    obstacles: []
  };
}

describe("temporal intention seam audit", () => {
  it("shows one externally-caused live player motion being treated as heading by legacy/shadow while A1 keeps Owner provenance separate", async () => {
    const world = await LabWorld.create("head-on");
    try {
      let pushed: WorldSnapshot | null = null;
      for (let step = 0; step < 180; step += 1) {
        const snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
        const player = actor(snapshot, "player");
        const companionContact = player.contacts.some((contact) => contact.with === "companion");
        if (magnitude(player.actualVelocity) > 0.2 && companionContact) {
          pushed = snapshot;
          break;
        }
      }

      expect(pushed).not.toBeNull();
      if (!pushed) return;

      const player = actor(pushed, "player");
      expect(magnitude(player.requestedVelocity)).toBeLessThan(1e-9);
      expect(magnitude(player.actualVelocity)).toBeGreaterThan(0.2);
      expect(player.contacts.some((contact) => contact.with === "companion")).toBe(true);

      const situation = buildA1Situation({
        snapshot: pushed,
        playerIntent: motion("player", { x: 0, y: 0 }),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      expect(situation.situated.playerMotionProvenance.state).toBe("EXTERNAL_MOTION_EVIDENT");

      const actualDirection = normalized(player.actualVelocity);
      const legacyRelationship = new RelationalPositioningBrain().decision(pushed);
      expect(dot(legacyRelationship.playerDirection, actualDirection)).toBeGreaterThan(0.99);

      const shadowCorridor = evaluateShadowPlayerCorridor({ snapshot: pushed });
      expect(shadowCorridor.velocitySource).toBe("actual");
      expect(dot(shadowCorridor.direction, actualDirection)).toBeGreaterThan(0.99);

      const a1Orientation = evaluateA1RelationshipOrientation({ situation });
      expect(a1Orientation.source).toBe("NONE");
      expect(a1Orientation.direction).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("isolates a false relationship-frame rotation caused by external body motion with no Owner request", () => {
    const brain = new RelationalPositioningBrain();
    const ownerDirected = brain.decision(syntheticSnapshot({
      tick: 0,
      playerRequestedVelocity: { x: 3, y: 0 }
    }));
    const externallyMovedSnapshot = syntheticSnapshot({
      tick: 6,
      playerRequestedVelocity: { x: 0, y: 0 },
      playerActualVelocity: { x: -3, y: 0 },
      playerContacts: ["companion"]
    });
    const player = actor(externallyMovedSnapshot, "player");
    const provenance = classifyObservedPlayerMotion({
      sourceTick: externallyMovedSnapshot.tick,
      position: { ...player.position },
      requestedVelocity: { ...player.requestedVelocity },
      actualVelocity: { ...player.actualVelocity },
      motionError: player.motionError,
      contacts: player.contacts.map((contact) => contact.with)
    });
    const externallyDriven = brain.decision(externallyMovedSnapshot);

    expect(provenance.state).toBe("EXTERNAL_MOTION_EVIDENT");
    expect(ownerDirected.selectedSlot).toBe("back");
    expect(externallyDriven.selectedSlot).toBe(ownerDirected.selectedSlot);
    expect(externallyDriven.reason).toContain("retain");
    expect(externallyDriven.playerDirection).toEqual({ x: -1, y: 0 });
    expect(distance(ownerDirected.target, externallyDriven.target)).toBeGreaterThan(2.8);
  });

  it("keeps genuine Owner reversal as a control: large world-space target rotation can still be the same relative relationship meaning", () => {
    const brain = new RelationalPositioningBrain();
    const initial = brain.decision(syntheticSnapshot({
      tick: 0,
      playerRequestedVelocity: { x: 3, y: 0 }
    }));
    const reversed = brain.decision(syntheticSnapshot({
      tick: 6,
      playerRequestedVelocity: { x: -3, y: 0 }
    }));

    expect(initial.selectedSlot).toBe("back");
    expect(reversed.selectedSlot).toBe(initial.selectedSlot);
    expect(reversed.reason).toContain("retain");
    expect(distance(initial.target, reversed.target)).toBeGreaterThan(2.8);
  });

  it("shows why neither tactical reconsideration count nor moving target coordinates are semantic objective identity", () => {
    const stationaryFrame = new RelationalPositioningBrain();
    const first = stationaryFrame.decision(syntheticSnapshot({
      tick: 0,
      playerRequestedVelocity: { x: 3, y: 0 }
    }));
    const refreshed = stationaryFrame.decision(syntheticSnapshot({
      tick: 6,
      playerRequestedVelocity: { x: 3, y: 0 }
    }));

    expect(refreshed.selectedSlot).toBe(first.selectedSlot);
    expect(refreshed.target).toEqual(first.target);
    expect(refreshed.reconsiderationCount).toBe(first.reconsiderationCount + 1);

    const movingFrame = new RelationalPositioningBrain();
    const movingFirst = movingFrame.decision(syntheticSnapshot({
      tick: 0,
      playerRequestedVelocity: { x: 3, y: 0 },
      playerPosition: { x: 4, y: 4 }
    }));
    const movingRefreshed = movingFrame.decision(syntheticSnapshot({
      tick: 6,
      playerRequestedVelocity: { x: 3, y: 0 },
      playerPosition: { x: 4.5, y: 4 }
    }));

    expect(movingRefreshed.selectedSlot).toBe(movingFirst.selectedSlot);
    expect(movingRefreshed.reason).toContain("best slot remains");
    expect(distance(movingFirst.target, movingRefreshed.target)).toBeCloseTo(0.5, 9);
  });
});
