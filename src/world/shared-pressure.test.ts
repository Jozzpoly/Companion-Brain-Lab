import { describe, expect, it } from "vitest";
import { SharedPressureLoop } from "./shared-pressure";
import type { ActorId, ActorSnapshot, Vec2, WorldSnapshot } from "./types";

function actor(id: ActorId, position: Vec2): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(tick: number, player: Vec2, companion: Vec2): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [actor("player", player), actor("companion", companion)],
    obstacles: []
  };
}

describe("Stage B shared pressure world loop", () => {
  it("activates deterministically and can be materially contained by the companion", () => {
    const loop = new SharedPressureLoop("open");
    loop.observe(snapshot(89, { x: 3, y: 4 }, { x: 8, y: 4 }));
    expect(loop.snapshot().phase).toBe("QUIET");

    loop.observe(snapshot(90, { x: 3, y: 4 }, { x: 8, y: 4 }));
    const active = loop.snapshot();
    expect(active.phase).toBe("ACTIVE");
    expect(active.target).not.toBeNull();

    const target = active.target!;
    for (let tick = 91; tick <= 132; tick += 1) {
      loop.observe(snapshot(tick, { x: 3, y: 4 }, target));
    }

    const contained = loop.snapshot();
    expect(contained.phase).toBe("RECOVERING");
    expect(contained.lastOutcome).toBe("CONTAINED");
    expect(contained.lastResolvedBy).toBe("companion");
    expect(contained.breaches).toBe(0);
  });

  it("records a factual breach when nobody answers before the deadline", () => {
    const loop = new SharedPressureLoop("open");
    loop.observe(snapshot(90, { x: 3, y: 4 }, { x: 8, y: 4 }));
    const deadline = loop.snapshot().deadlineTick;
    expect(deadline).not.toBeNull();

    loop.observe(snapshot(deadline!, { x: 3, y: 4 }, { x: 8, y: 4 }));
    const breached = loop.snapshot();
    expect(breached.phase).toBe("RECOVERING");
    expect(breached.lastOutcome).toBe("BREACHED");
    expect(breached.lastResolvedBy).toBe("none");
    expect(breached.breaches).toBe(1);
  });

  it("does not leak the Stage B apparatus into constrained movement fixtures", () => {
    const loop = new SharedPressureLoop("pillar");
    const state = loop.snapshot();
    expect(state.enabled).toBe(false);
    expect(state.target).toBeNull();
    expect(state.lastOutcome).toBe("NONE");
  });
});
