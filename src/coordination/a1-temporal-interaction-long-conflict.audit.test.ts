import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import {
  A1_ORIENTATION_MEMORY_TICKS,
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import { buildA1Situation } from "./a1-situation";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`A1 long-conflict audit missing ${id}.`);
  return value;
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function hasContact(snapshot: WorldSnapshot): boolean {
  return actor(snapshot, "player").contacts.some((contact) => contact.with === "companion") &&
    actor(snapshot, "companion").contacts.some((contact) => contact.with === "player");
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

describe("A1 temporal interaction long-conflict freshness audit", () => {
  it("allows an unresolved physical conflict to outlive bounded Owner-orientation memory instead of pretending stale semantics are current", async () => {
    const world = await LabWorld.create("head-on");
    let snapshot = world.snapshot();
    let memory: A1RelationshipOrientationMemory | null = null;
    let contactTick: number | null = null;
    let memorySourceTick: number | null = null;
    let lastLiveMemoryTick: number | null = null;
    let expiryTick: number | null = null;
    let expiryProvenance: string | null = null;

    try {
      // Establish +X Owner-derived semantic orientation and reach real contact.
      for (let step = 0; step < 90; step += 1) {
        const current = observe({
          world,
          snapshot,
          ownerMove: { x: 1, y: 0 },
          memory
        });
        memory = current.nextMemory;
        memorySourceTick = current.orientation.sourceTick;
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
      expect(memorySourceTick).not.toBeNull();
      if (contactTick === null || memorySourceTick === null) return;

      // Owner becomes silent while the companion stimulus keeps the physical
      // conflict unresolved. We deliberately run beyond the bounded semantic
      // memory horizon and ask whether the World conflict can still be factual.
      for (let step = 0; step < A1_ORIENTATION_MEMORY_TICKS + 12; step += 1) {
        const current = observe({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = current.nextMemory;

        if (current.orientation.source === "OWNER_MEMORY") {
          lastLiveMemoryTick = snapshot.tick;
          expect(current.orientation.direction).toEqual({ x: 1, y: 0 });
          expect(current.orientation.ageTicks).not.toBeNull();
          expect(current.orientation.ageTicks ?? 0).toBeLessThan(A1_ORIENTATION_MEMORY_TICKS);
        } else if (current.orientation.source === "NONE") {
          expiryTick = snapshot.tick;
          expiryProvenance = current.situation.situated.playerMotionProvenance.state;
          expect(current.orientation.direction).toBeNull();
          expect(current.orientation.strength).toBe(0);
          expect(current.orientation.nextMemory).toBeNull();
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
      }

      expect(lastLiveMemoryTick).not.toBeNull();
      expect(expiryTick).not.toBeNull();
      if (lastLiveMemoryTick === null || expiryTick === null) return;
      expect(expiryTick).toBeGreaterThan(lastLiveMemoryTick);
      expect(expiryTick - memorySourceTick).toBeGreaterThanOrEqual(A1_ORIENTATION_MEMORY_TICKS);

      // The crucial falsifier: semantic freshness can be gone while the bodies
      // are still in the same factual conflict. Therefore a future interaction
      // episode may retain the old commitment's provenance/revision, but it may
      // not silently promote that old direction back to current Owner meaning.
      expect(hasContact(snapshot)).toBe(true);

      console.info("[A1_TEMPORAL_INTERACTION_LONG_CONFLICT]", JSON.stringify({
        contactTick,
        memorySourceTick,
        memoryHorizonTicks: A1_ORIENTATION_MEMORY_TICKS,
        lastLiveMemoryTick,
        expiryTick,
        conflictStillFactualAtExpiry: hasContact(snapshot),
        bodyProvenanceAtExpiry: expiryProvenance,
        interpretation: {
          unresolvedPhysicalConflictCanOutliveSemanticFreshness: true,
          staleBaseCommitmentMustNotBeSilentlyReasserted: true,
          retainedEpisodeProvenanceIsNotEquivalentToCurrentOwnerIntent: true
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
