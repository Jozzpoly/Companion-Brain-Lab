import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";
import { evaluateShadowPlayerCorridor } from "./shadow-player-corridor";
import { evaluateShadowPlayerFlowConflict } from "./shadow-player-flow-conflict";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

describe("behavior-forensics: occluded player flow", () => {
  it("can predict player flow through a solid pillar and report conflict on the opposite side", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const base = world.snapshot();
      const snapshot: WorldSnapshot = {
        ...base,
        actors: base.actors.map((entry) => entry.id === "player"
          ? {
              ...entry,
              position: { x: 5.15, y: 4 },
              requestedVelocity: { x: 3, y: 0 },
              actualVelocity: { x: 3, y: 0 }
            }
          : {
              ...entry,
              position: { x: 6.85, y: 4 },
              requestedVelocity: { x: 0, y: 0 },
              actualVelocity: { x: 0, y: 0 }
            })
      };
      const player = actor(snapshot, "player");
      const corridor = evaluateShadowPlayerCorridor({ snapshot });
      const physicalTraversal = world.staticCircleTraversal(
        player.position,
        corridor.endpoint,
        player.radius
      );
      const conflict = evaluateShadowPlayerFlowConflict({
        snapshot,
        corridor,
        companionVelocity: { x: 0, y: 0 },
        velocitySource: "authoritative-command"
      });

      expect(corridor.state).toBe("MOVING");
      expect(physicalTraversal.clear).toBe(false);
      expect(physicalTraversal.blocker?.label).toBe("pillar.center");
      expect(corridor.endpoint.x).toBeGreaterThan(6.5);
      expect(conflict.state).toBe("PHYSICAL_CONFLICT");
    } finally {
      world.dispose();
    }
  });
});
