import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import {
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import { buildA1Situation } from "./a1-situation";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`A1 interaction invalidation audit missing ${id}.`);
  return value;
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function observe(input: {
  world: LabWorld;
  snapshot: WorldSnapshot;
  ownerMove: Vec2;
  memory: A1RelationshipOrientationMemory | null;
}) {
  const situation = buildA1Situation({
    snapshot: input.snapshot,
    playerIntent: motion("player", input.ownerMove),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: input.snapshot.tick === 0
      ? null
      : input.world.latestAuthorityA0StepEvidence()
  });
  const orientation = evaluateA1RelationshipOrientation({ situation, memory: input.memory });
  return { situation, orientation, nextMemory: orientation.nextMemory };
}

function hasContact(snapshot: WorldSnapshot): boolean {
  return actor(snapshot, "player").contacts.some((contact) => contact.with === "companion") &&
    actor(snapshot, "companion").contacts.some((contact) => contact.with === "player");
}

describe("A1 temporal interaction invalidation audit", () => {
  it("distinguishes no-input persistence from a contradictory same-step Owner revision during unresolved contact", async () => {
    const world = await LabWorld.create("head-on");
    let snapshot = world.snapshot();
    let memory: A1RelationshipOrientationMemory | null = null;
    let contactTick: number | null = null;

    try {
      // Establish +X semantic commitment and drive into a real unresolved contact.
      for (let step = 0; step < 90; step += 1) {
        const current = observe({
          world,
          snapshot,
          ownerMove: { x: 1, y: 0 },
          memory
        });
        memory = current.nextMemory;
        expect(current.orientation.source).toBe("SAME_STEP_OWNER");
        expect(current.orientation.direction).toEqual({ x: 1, y: 0 });

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
      expect(hasContact(snapshot)).toBe(true);
      if (contactTick === null) return;

      // Merely releasing the controls does not invent a new relationship frame.
      // The factual physical conflict is still unresolved at the same snapshot.
      const noInput = observe({
        world,
        snapshot,
        ownerMove: { x: 0, y: 0 },
        memory
      });
      expect(noInput.orientation.source).toBe("OWNER_MEMORY");
      expect(noInput.orientation.direction).toEqual({ x: 1, y: 0 });
      expect(noInput.orientation.sourceTick).not.toBeNull();
      expect(noInput.orientation.sourceTick).toBeLessThan(snapshot.tick);
      expect(hasContact(snapshot)).toBe(true);

      // A genuinely contradictory same-step Owner command is different. At the
      // exact same body snapshot/contact state, semantic orientation must revise
      // immediately instead of waiting for the physical body to turn around.
      const reversed = observe({
        world,
        snapshot,
        ownerMove: { x: -1, y: 0 },
        memory: noInput.nextMemory
      });
      expect(reversed.orientation.source).toBe("SAME_STEP_OWNER");
      expect(reversed.orientation.direction).toEqual({ x: -1, y: 0 });
      expect(reversed.orientation.sourceTick).toBe(snapshot.tick);
      expect(reversed.orientation.ageTicks).toBe(0);
      expect(reversed.orientation.strength).toBe(1);
      expect(reversed.nextMemory?.direction).toEqual({ x: -1, y: 0 });
      expect(reversed.nextMemory?.sourceTick).toBe(snapshot.tick);
      expect(hasContact(snapshot)).toBe(true);

      // The body evidence is intentionally unchanged between the two semantic
      // observations: only same-step Owner information differs. This proves the
      // invalidation signal belongs to the semantic/control domain, not physics.
      expect(reversed.situation.situated.playerBody).toEqual(noInput.situation.situated.playerBody);
      expect(reversed.situation.situated.companionBody).toEqual(noInput.situation.situated.companionBody);
      expect(reversed.situation.previousOutcome).toEqual(noInput.situation.previousOutcome);

      console.info("[A1_TEMPORAL_INTERACTION_INVALIDATION]", JSON.stringify({
        contactTick,
        bodyStillInContact: hasContact(snapshot),
        noInput: {
          source: noInput.orientation.source,
          sourceTick: noInput.orientation.sourceTick,
          direction: noInput.orientation.direction,
          ageTicks: noInput.orientation.ageTicks,
          strength: noInput.orientation.strength
        },
        contradictoryOwnerRevision: {
          source: reversed.orientation.source,
          sourceTick: reversed.orientation.sourceTick,
          direction: reversed.orientation.direction,
          ageTicks: reversed.orientation.ageTicks,
          strength: reversed.orientation.strength
        },
        sameBodyEvidence: true,
        interpretation: {
          zeroInputDoesNotCancelBaseMeaning: true,
          contradictorySameStepOwnerInputRevisesMeaningImmediately: true,
          physicalConflictMayOutliveSemanticRevision: true
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
