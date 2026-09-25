import { describe, expect, it } from "vitest";
import {
  initialTaskPressureSnapshot,
  resolveTaskPressureAfterPhysics,
  type TaskPressureRules
} from "./task-pressure-contract";

const rules: TaskPressureRules = {
  taskCenters: [
    { x: 9, y: 3 },
    { x: 9, y: 7 }
  ],
  taskRadius: 0.8,
  contestRadius: 1.0,
  requiredProgressTicks: 2,
  hostileHome: { x: 13, y: 5 },
  hostileHomeArrivalRange: 0.2
};

function step(
  before: ReturnType<typeof initialTaskPressureSnapshot>,
  tick: number,
  player: { x: number; y: number },
  hostile: { x: number; y: number },
  contact = false
) {
  return resolveTaskPressureAfterPhysics({
    observationTick: tick,
    before,
    playerPosition: player,
    hostilePosition: hostile,
    playerContacts: contact ? [{ with: "hostile", contactCount: 1 }] : [],
    rules
  });
}

describe("task pressure contract", () => {
  it("advances visibly from station A to B before final completion", () => {
    let state = initialTaskPressureSnapshot(rules);
    state = step(state, 0, { x: 8, y: 5 }, { x: 13, y: 5 });
    expect(state.phase).toBe("IDLE");
    expect(state.stageIndex).toBe(0);

    state = step(state, 1, { x: 9, y: 3 }, { x: 13, y: 5 });
    expect(state.phase).toBe("ACTIVE");
    expect(state.progressTicks).toBe(1);

    state = step(state, 2, { x: 9, y: 3 }, { x: 13, y: 5 });
    expect(state.phase).toBe("ACTIVE");
    expect(state.stageIndex).toBe(1);
    expect(state.progressTicks).toBe(0);
    expect(state.playerCommitted).toBe(false);
    expect(state.stageCompletionTicks).toEqual([3]);

    state = step(state, 3, { x: 9, y: 7 }, { x: 13, y: 5 });
    expect(state.progressTicks).toBe(1);

    state = step(state, 4, { x: 9, y: 7 }, { x: 13, y: 5 });
    expect(state.phase).toBe("COMPLETED");
    expect(state.progressTicks).toBe(2);
    expect(state.stageCompletionTicks).toEqual([3, 5]);
    expect(state.completionTick).toBe(5);
  });

  it("pauses active-station progress while hostile contests or contacts player", () => {
    let state = initialTaskPressureSnapshot(rules);
    state = step(state, 0, { x: 9, y: 3 }, { x: 13, y: 5 });
    expect(state.progressTicks).toBe(1);

    state = step(state, 1, { x: 9, y: 3 }, { x: 9.9, y: 3 });
    expect(state.progressTicks).toBe(1);
    expect(state.contested).toBe(true);

    state = step(state, 2, { x: 9, y: 3 }, { x: 11, y: 3 }, true);
    expect(state.progressTicks).toBe(1);
    expect(state.playerHostileContact).toBe(true);
    expect(state.contested).toBe(true);
  });

  it("settles only after both stations complete and hostile reaches home", () => {
    let state = initialTaskPressureSnapshot(rules);
    state = step(state, 0, { x: 9, y: 3 }, { x: 13, y: 5 });
    state = step(state, 1, { x: 9, y: 3 }, { x: 13, y: 5 });
    state = step(state, 2, { x: 9, y: 7 }, { x: 13, y: 5 });
    state = step(state, 3, { x: 9, y: 7 }, { x: 12, y: 5 });
    expect(state.phase).toBe("COMPLETED");

    state = step(state, 4, { x: 9, y: 7 }, { x: 12, y: 5 });
    expect(state.phase).toBe("COMPLETED");

    state = step(state, 5, { x: 9, y: 7 }, { x: 13, y: 5 });
    expect(state.phase).toBe("SETTLED");
  });
});
