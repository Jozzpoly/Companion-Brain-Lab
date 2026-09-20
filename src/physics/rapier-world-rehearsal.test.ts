import { describe, expect, it } from "vitest";
import {
  LabWorld,
  subscribeAuthorityA0StepEvidence
} from "../world/world";
import type { ActorSnapshot, MotionIntent } from "../world/types";

const PLAYER_DIAGONAL: MotionIntent = {
  actorId: "player",
  move: { x: 0.8, y: 0.4 }
};
const PLAYER_RIGHT: MotionIntent = {
  actorId: "player",
  move: { x: 1, y: 0 }
};
const COMPANION_LEFT: MotionIntent = {
  actorId: "companion",
  move: { x: -1, y: 0 }
};
const COMPANION_HOLD: MotionIntent = {
  actorId: "companion",
  move: { x: 0, y: 0 }
};

function diagonalVelocityInputs() {
  return [
    { actorId: "player" as const, velocity: { x: 2.4, y: 1.2 } },
    { actorId: "companion" as const, velocity: { x: 0, y: 0 } }
  ];
}

function headOnVelocityInputs() {
  return [
    { actorId: "player" as const, velocity: { x: 3, y: 0 } },
    { actorId: "companion" as const, velocity: { x: -3, y: 0 } }
  ];
}

function actor(actors: readonly ActorSnapshot[], id: ActorSnapshot["id"]): ActorSnapshot {
  const found = actors.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

/**
 * Rehearsal intentionally accepts already-formed world-unit velocities, while
 * live World derives requestedVelocity through intent normalization * speed.
 * Those two semantically identical inputs can differ by sub-ulp JS arithmetic
 * (for example 2.4 vs 2.4000000000000004). Physical equivalence therefore
 * remains exact for state/contact outcomes, while command bookkeeping and the
 * diagnostic motionError are compared only within a microscopic tolerance.
 */
function expectPhysicalActorsEquivalent(
  actualActors: readonly ActorSnapshot[],
  expectedActors: readonly ActorSnapshot[]
): void {
  expect(actualActors.map((candidate) => candidate.id)).toEqual(
    expectedActors.map((candidate) => candidate.id)
  );

  for (const expectedActor of expectedActors) {
    const actualActor = actor(actualActors, expectedActor.id);
    expect(actualActor.position).toEqual(expectedActor.position);
    expect(actualActor.actualVelocity).toEqual(expectedActor.actualVelocity);
    expect(actualActor.radius).toBe(expectedActor.radius);
    expect(actualActor.contacts).toEqual(expectedActor.contacts);
    expect(actualActor.requestedVelocity.x).toBeCloseTo(expectedActor.requestedVelocity.x, 12);
    expect(actualActor.requestedVelocity.y).toBeCloseTo(expectedActor.requestedVelocity.y, 12);
    expect(actualActor.motionError).toBeCloseTo(expectedActor.motionError, 12);
  }
}

describe("Authority-A1.2g Rapier snapshot rehearsal substrate", () => {
  it("is query-only at the LabWorld boundary, including tick and A0 observer state", async () => {
    const world = await LabWorld.create("pillar");
    try {
      world.step([PLAYER_DIAGONAL, COMPANION_HOLD]);
      const before = world.snapshot();
      const beforeA0 = world.latestAuthorityA0StepEvidence();
      let observedA0 = 0;
      const unsubscribe = subscribeAuthorityA0StepEvidence(() => {
        observedA0 += 1;
      });
      try {
        const rehearsal = world.rehearseVelocitySequence(
          Array.from({ length: 12 }, () => diagonalVelocityInputs())
        );

        expect(rehearsal.kind).toBe("RAPIER_SNAPSHOT_REHEARSAL");
        expect(rehearsal.physicsProvenance).toBe("LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE");
        expect(rehearsal.inputSemantics).toBe("RAW_WORLD_UNIT_VELOCITY_NO_ADMISSIBILITY");
        expect(rehearsal.liveWorldMutationClaim).toBe("NONE_QUERY_ONLY_CLONE");
        expect(rehearsal.commandAdmissibilityClaim).toBe("NONE_A1_2G_SUBSTRATE_ONLY");
        expect(rehearsal.runtimeAuthorityClaim).toBe("NONE_A1_2G_SUBSTRATE_ONLY");
        expect(rehearsal.frames).toHaveLength(12);
        expect(world.snapshot()).toEqual(before);
        expect(world.latestAuthorityA0StepEvidence()).toEqual(beforeA0);
        expect(observedA0).toBe(0);
      } finally {
        unsubscribe();
      }
    } finally {
      world.dispose();
    }
  });

  it("matches equivalent live pillar steps physically frame-for-frame and reproduces static-contact slide", async () => {
    const rehearsalWorld = await LabWorld.create("pillar");
    const liveWorld = await LabWorld.create("pillar");
    try {
      const count = 120;
      const rehearsal = rehearsalWorld.rehearseVelocitySequence(
        Array.from({ length: count }, () => diagonalVelocityInputs())
      );
      const liveFrames: readonly (readonly ActorSnapshot[])[] = Array.from({ length: count }, () =>
        liveWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD]).actors
      );

      expect(rehearsal.frames).toHaveLength(count);
      for (let index = 0; index < count; index += 1) {
        expect(rehearsal.frames[index]?.stepIndex).toBe(index);
        expectPhysicalActorsEquivalent(rehearsal.frames[index]!.actors, liveFrames[index]!);
      }

      const pillarContactFrames = rehearsal.frames.filter((frame) =>
        actor(frame.actors, "player").contacts.some((contact) => contact.with === "pillar.center")
      );
      expect(pillarContactFrames.length).toBeGreaterThan(0);
      const firstContact = actor(pillarContactFrames[0]!.actors, "player");
      const finalPlayer = actor(rehearsal.frames.at(-1)!.actors, "player");
      expect(finalPlayer.position.y).toBeGreaterThan(firstContact.position.y + 0.25);
    } finally {
      rehearsalWorld.dispose();
      liveWorld.dispose();
    }
  });

  it("matches live dynamic player-companion contact and preserves restored collider identity", async () => {
    const rehearsalWorld = await LabWorld.create("head-on");
    const liveWorld = await LabWorld.create("head-on");
    try {
      const count = 45;
      const rehearsal = rehearsalWorld.rehearseVelocitySequence(
        Array.from({ length: count }, () => headOnVelocityInputs())
      );
      const liveFrames: readonly (readonly ActorSnapshot[])[] = Array.from({ length: count }, () =>
        liveWorld.step([PLAYER_RIGHT, COMPANION_LEFT]).actors
      );

      for (let index = 0; index < count; index += 1) {
        expectPhysicalActorsEquivalent(rehearsal.frames[index]!.actors, liveFrames[index]!);
      }

      const contactFrame = rehearsal.frames.find((frame) =>
        actor(frame.actors, "player").contacts.some((contact) => contact.with === "companion") &&
        actor(frame.actors, "companion").contacts.some((contact) => contact.with === "player")
      );
      expect(contactFrame).toBeDefined();
    } finally {
      rehearsalWorld.dispose();
      liveWorld.dispose();
    }
  });

  it("forks from a nontrivial current physics state instead of only matching fresh worlds", async () => {
    const rehearsalWorld = await LabWorld.create("pillar");
    const liveWorld = await LabWorld.create("pillar");
    try {
      const historySteps = 55;
      for (let index = 0; index < historySteps; index += 1) {
        const rehearsalHistory = rehearsalWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD]);
        const liveHistory = liveWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD]);
        expect(rehearsalHistory).toEqual(liveHistory);
      }

      const forkSnapshot = rehearsalWorld.snapshot();
      const forkA0 = rehearsalWorld.latestAuthorityA0StepEvidence();
      const futureSteps = 50;
      const rehearsal = rehearsalWorld.rehearseVelocitySequence(
        Array.from({ length: futureSteps }, () => diagonalVelocityInputs())
      );
      const liveFrames: readonly (readonly ActorSnapshot[])[] = Array.from({ length: futureSteps }, () =>
        liveWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD]).actors
      );

      for (let index = 0; index < futureSteps; index += 1) {
        expectPhysicalActorsEquivalent(rehearsal.frames[index]!.actors, liveFrames[index]!);
      }
      expect(rehearsalWorld.snapshot()).toEqual(forkSnapshot);
      expect(rehearsalWorld.latestAuthorityA0StepEvidence()).toEqual(forkA0);
    } finally {
      rehearsalWorld.dispose();
      liveWorld.dispose();
    }
  });

  it("leaves no hidden solver mutation that changes the next live step", async () => {
    const rehearsalWorld = await LabWorld.create("pillar");
    const controlWorld = await LabWorld.create("pillar");
    try {
      for (let index = 0; index < 47; index += 1) {
        expect(rehearsalWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD])).toEqual(
          controlWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD])
        );
      }

      rehearsalWorld.rehearseVelocitySequence(
        Array.from({ length: 40 }, () => diagonalVelocityInputs())
      );

      const afterRehearsal = rehearsalWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD]);
      const control = controlWorld.step([PLAYER_DIAGONAL, COMPANION_HOLD]);
      expect(afterRehearsal).toEqual(control);
      expect(rehearsalWorld.latestAuthorityA0StepEvidence()).toEqual(
        controlWorld.latestAuthorityA0StepEvidence()
      );
    } finally {
      rehearsalWorld.dispose();
      controlWorld.dispose();
    }
  });

  it("keeps raw world-unit physical hypotheses separate from command admissibility", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const result = world.rehearseVelocitySequence([[{
        actorId: "player",
        velocity: { x: 4.25, y: 0 }
      }]]);
      const rehearsedPlayer = actor(result.frames[0]!.actors, "player");

      expect(rehearsedPlayer.requestedVelocity).toEqual({ x: 4.25, y: 0 });
      expect(result.commandAdmissibilityClaim).toBe("NONE_A1_2G_SUBSTRATE_ONLY");
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("rejects malformed rehearsal inputs without mutating live World", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      expect(() => world.rehearseVelocitySequence([])).toThrow(/at least one future step/i);
      expect(() => world.rehearseVelocitySequence([[
        { actorId: "player", velocity: { x: 1, y: 0 } },
        { actorId: "player", velocity: { x: 2, y: 0 } }
      ]])).toThrow(/duplicate physical rehearsal velocity/i);
      expect(() => world.rehearseVelocitySequence([[
        { actorId: "player", velocity: { x: Number.NaN, y: 0 } }
      ]])).toThrow(/finite x\/y components/i);
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });
});
