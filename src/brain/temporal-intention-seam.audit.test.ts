import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { buildA1Situation } from "../coordination/a1-situation";
import { evaluateA1RelationshipOrientation } from "../coordination/a1-relationship-orientation";
import { evaluateShadowPlayerCorridor } from "../coordination/shadow-player-corridor";
import { ProgressRecoveryMonitor } from "./progress-recovery";
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
        position: { x: 4, y: 4 },
        radius: 0.3,
        requestedVelocity: { ...options.playerRequestedVelocity },
        actualVelocity: { ...(options.playerActualVelocity ?? options.playerRequestedVelocity) },
        motionError: 0,
        contacts: []
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

  it("shows a retained relational slot label changing world-space meaning by meters when its moving reference frame reverses", () => {
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

  it("shows recovery carrying no-progress debt across that same-label semantic target reversal", () => {
    const relationship = new RelationalPositioningBrain();
    const initial = relationship.decision(syntheticSnapshot({
      tick: 0,
      playerRequestedVelocity: { x: 3, y: 0 }
    }));
    const reversed = relationship.decision(syntheticSnapshot({
      tick: 6,
      playerRequestedVelocity: { x: -3, y: 0 }
    }));

    expect(reversed.selectedSlot).toBe(initial.selectedSlot);
    expect(distance(initial.target, reversed.target)).toBeGreaterThan(2.8);

    const sameIdentity = new ProgressRecoveryMonitor();
    const revisedIdentity = new ProgressRecoveryMonitor();
    const position = { x: 1, y: 4 };
    const objectiveKey = `spatial-slot:${initial.selectedSlot}`;

    const observe = (
      monitor: ProgressRecoveryMonitor,
      tick: number,
      key: string,
      target: Vec2
    ) => monitor.observe({
      tick,
      objectiveKey: key,
      position,
      target,
      routeStatus: "direct",
      routeRemainingDistance: distance(position, target),
      commandedSpeed: 1,
      actualSpeed: 0,
      contacts: []
    });

    for (let tick = 0; tick < 35; tick += 1) {
      observe(sameIdentity, tick, objectiveKey, initial.target);
      observe(revisedIdentity, tick, objectiveKey, initial.target);
    }

    const aliased = observe(sameIdentity, 35, objectiveKey, reversed.target);
    const explicitlyRevised = observe(
      revisedIdentity,
      35,
      `${objectiveKey}:semantic-revision-2`,
      reversed.target
    );

    expect(aliased.state).toBe("RECOVERING");
    expect(aliased.action).toBe("RETRY_LOCAL");
    expect(aliased.retryCount).toBe(1);
    expect(aliased.noProgressTicks).toBe(36);

    expect(explicitlyRevised.action).toBe("NONE");
    expect(explicitlyRevised.retryCount).toBe(0);
    expect(explicitlyRevised.noProgressTicks).toBe(1);
  });
});
