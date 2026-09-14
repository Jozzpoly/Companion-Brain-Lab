import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { RelationalPositioningBrain, S1_TACTICAL_INTERVAL_TICKS } from "./relational-positioning";

function actor(id: ActorSnapshot["id"], position: Vec2, velocity: Vec2): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { ...velocity },
    actualVelocity: { ...velocity },
    motionError: 0,
    contacts: []
  };
}

function snapshot(tick: number, playerVelocity: Vec2): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 20,
    height: 10,
    actors: [
      actor("player", { x: 10, y: 5 }, playerVelocity),
      actor("companion", { x: 8.55, y: 5 }, { x: 0, y: 0 })
    ],
    obstacles: []
  };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("behavior-forensics: relationship clock phase", () => {
  it("characterizes identical reversal stimulus across all 6 tactical clock offsets", () => {
    const results: Array<{
      phaseOffset: number;
      reversalTick: number;
      observedAtTick: number;
      brainDelayTicks: number;
      oldSlot: string;
      newSlot: string;
      sameLabel: boolean;
      targetJump: number;
    }> = [];

    for (let phaseOffset = 0; phaseOffset < S1_TACTICAL_INTERVAL_TICKS; phaseOffset += 1) {
      const brain = new RelationalPositioningBrain();
      let beforeReversal = brain.decision(snapshot(0, { x: 3, y: 0 }));
      const reversalTick = S1_TACTICAL_INTERVAL_TICKS + phaseOffset;

      for (let tick = 1; tick < reversalTick; tick += 1) {
        beforeReversal = brain.decision(snapshot(tick, { x: 3, y: 0 }));
      }

      const oldTarget = { ...beforeReversal.target };
      const oldSlot = beforeReversal.selectedSlot;
      let observedAtTick = -1;
      let afterReversal = beforeReversal;

      for (let tick = reversalTick; tick <= reversalTick + S1_TACTICAL_INTERVAL_TICKS; tick += 1) {
        const decision = brain.decision(snapshot(tick, { x: -3, y: 0 }));
        if (decision.playerDirection.x < -0.99) {
          observedAtTick = tick;
          afterReversal = decision;
          break;
        }
      }

      if (observedAtTick < 0) throw new Error(`reversal not observed for phase ${phaseOffset}`);
      results.push({
        phaseOffset,
        reversalTick,
        observedAtTick,
        brainDelayTicks: observedAtTick - reversalTick,
        oldSlot,
        newSlot: afterReversal.selectedSlot,
        sameLabel: afterReversal.selectedSlot === oldSlot,
        targetJump: distance(oldTarget, afterReversal.target)
      });
    }

    console.info("RELATIONSHIP_CLOCK_PHASE", JSON.stringify(results));
    expect(results.map((entry) => entry.brainDelayTicks)).toEqual([0, 5, 4, 3, 2, 1]);
    expect(Math.max(...results.map((entry) => entry.brainDelayTicks))).toBe(5);
    expect(results.every((entry) => entry.targetJump > 0)).toBe(true);
  });
});