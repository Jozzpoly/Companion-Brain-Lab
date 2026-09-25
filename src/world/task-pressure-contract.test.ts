import { describe, expect, it } from "vitest";
import {
  initialTaskPressureSnapshot,
  resolveTaskPressureAfterPhysics,
  type TaskPressureRules
} from "./task-pressure-contract";

const rules: TaskPressureRules = {
  taskCenter: { x: 9, y: 5 },
  taskRadius: 0.8,
  contestRadius: 1.0,
  requiredProgressTicks: 3,
  hostileHome: { x: 13, y: 5 },
  hostileHomeArrivalRange: 0.2
};

function step(
  before: ReturnType<typeof initialTaskPressureSnapshot>,
  tick: number,
  playerX: number,
  hostileX: number,
  contact = false
) {
  return resolveTaskPressureAfterPhysics({
    observationTick: tick,
    before,
    playerPosition: { x: playerX, y: 5 },
    hostilePosition: { x: hostileX, y: 5 },
    playerContacts: contact ? [{ with: "hostile", contactCount: 1 }] : [],
    rules
  });
}

describe("task pressure contract", () => {
  it("starts only when player commits and progresses only while uncontested", () => {
    let state = initialTaskPressureSnapshot(rules);
    state = step(state, 0, 7, 13);
    expect(state.phase).toBe("IDLE");
    expect(state.progressTicks).toBe(0);

    state = step(state, 1, 9, 13);
    expect(state.phase).toBe("ACTIVE");
    expect(state.progressTicks).toBe(1);
    expect(state.playerCommitted).toBe(true);

    state = step(state, 2, 9, 9.9);
    expect(state.progressTicks).toBe(1);
    expect(state.contested).toBe(true);

    state = step(state, 3, 9, 11);
    expect(state.progressTicks).toBe(2);

    state = step(state, 4, 9, 11);
    expect(state.phase).toBe("COMPLETED");
    expect(state.progressTicks).toBe(3);
    expect(state.completionTick).toBe(5);
  });

  it("treats material hostile-player contact as contest even outside center radius", () => {
    let state = initialTaskPressureSnapshot(rules);
    state = step(state, 0, 9, 11, true);
    expect(state.phase).toBe("ACTIVE");
    expect(state.progressTicks).toBe(0);
    expect(state.playerHostileContact).toBe(true);
    expect(state.contested).toBe(true);
  });

  it("settles only after completed hostile reaches home", () => {
    let state = initialTaskPressureSnapshot(rules);
    state = step(state, 0, 9, 13);
    state = step(state, 1, 9, 13);
    state = step(state, 2, 9, 13);
    expect(state.phase).toBe("COMPLETED");

    state = step(state, 3, 9, 11.5);
    expect(state.phase).toBe("COMPLETED");

    state = step(state, 4, 9, 13);
    expect(state.phase).toBe("SETTLED");
  });
});
