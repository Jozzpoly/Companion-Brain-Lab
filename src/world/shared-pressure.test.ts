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
  it("creates an advancing external problem instead of a stationary objective marker", () => {
    const loop = new SharedPressureLoop("open");
    const player = { x: 3, y: 4 };
    const companion = { x: 1, y: 7 };

    loop.observe(snapshot(90, player, companion));
    const initial = loop.snapshot();
    expect(initial.phase).toBe("ACTIVE");
    expect(initial.target).not.toBeNull();
    expect(initial.threatDistanceToPlayer).not.toBeNull();

    for (let tick = 91; tick <= 120; tick += 1) {
      loop.observe(snapshot(tick, player, companion));
    }

    const advanced = loop.snapshot();
    expect(advanced.phase).toBe("ACTIVE");
    expect(advanced.target).not.toEqual(initial.target);
    expect(advanced.threatDistanceToPlayer!).toBeLessThan(initial.threatDistanceToPlayer!);
    expect(advanced.lastResponder).toBe("none");
  });

  it("can be materially intercepted and contained by the companion", () => {
    const loop = new SharedPressureLoop("open");
    const player = { x: 3, y: 4 };
    loop.observe(snapshot(90, player, { x: 8, y: 4 }));

    for (let tick = 91; tick <= 140 && loop.snapshot().phase === "ACTIVE"; tick += 1) {
      const target = loop.snapshot().target;
      if (!target) throw new Error("active threat lost its target");
      loop.observe(snapshot(tick, player, target));
    }

    const contained = loop.snapshot();
    expect(contained.phase).toBe("RECOVERING");
    expect(contained.lastOutcome).toBe("CONTAINED");
    expect(contained.lastResolvedBy).toBe("companion");
    expect(contained.breaches).toBe(0);
  });

  it("produces a factual breach when the moving threat reaches an undefended player", () => {
    const loop = new SharedPressureLoop("open");
    const player = { x: 3, y: 4 };
    const absentCompanion = { x: 1, y: 7 };
    loop.observe(snapshot(90, player, absentCompanion));

    for (let tick = 91; tick <= 700 && loop.snapshot().phase === "ACTIVE"; tick += 1) {
      loop.observe(snapshot(tick, player, absentCompanion));
    }

    const breached = loop.snapshot();
    expect(breached.phase).toBe("RECOVERING");
    expect(breached.lastOutcome).toBe("BREACHED");
    expect(breached.lastResolvedBy).toBe("none");
    expect(breached.breaches).toBe(1);
    expect(breached.threatDistanceToPlayer!).toBeLessThanOrEqual(breached.breachDistance);
  });

  it("does not leak the Stage B apparatus into constrained movement fixtures", () => {
    const loop = new SharedPressureLoop("pillar");
    const state = loop.snapshot();
    expect(state.enabled).toBe(false);
    expect(state.target).toBeNull();
    expect(state.lastOutcome).toBe("NONE");
  });
});
