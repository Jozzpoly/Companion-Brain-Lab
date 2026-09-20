import { describe, expect, it } from "vitest";
import { LabWorld, S1_SHARED_DANGER_RULES } from "./world";
import type { ActorId, WorldBodyId } from "./types";
import type { WorldActionAttempt } from "./shared-danger-contract";

const zero = { x: 0, y: 0 };

function intent(actorId: ActorId, x = 0, y = 0) {
  return { actorId, move: { x, y } } as const;
}

function intervene(actorId: ActorId): WorldActionAttempt {
  return { actorId, kind: "INTERVENE", targetId: "hostile" };
}

function body(snapshot: ReturnType<LabWorld["snapshot"]>, id: WorldBodyId) {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Missing body ${id}`);
  return value;
}

async function advanceToWindup(world: LabWorld) {
  let result = world.stepSituation({
    motionIntents: [intent("player"), intent("companion")]
  });
  let guard = 0;
  while (result.sharedDanger?.phase !== "WINDUP") {
    result = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")]
    });
    guard += 1;
    if (guard > 600) throw new Error("Shared-danger apparatus never reached WINDUP.");
  }
  return result;
}

describe("S1-B shared-danger physical World apparatus", () => {
  it("embeds hostile as a world body and advances it under World-owned motion", async () => {
    const world = await LabWorld.create("shared-danger");
    const before = world.snapshot();
    const hostileBefore = body(before, "hostile");

    const result = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")]
    });
    const hostileAfter = body(result.snapshot, "hostile");

    expect(before.tick).toBe(0);
    expect(result.snapshot.tick).toBe(1);
    expect(hostileAfter.position.x).toBeLessThan(hostileBefore.position.x);
    expect(hostileAfter.requestedVelocity.x).toBeLessThan(0);
    expect(result.sharedDanger?.phase).toBe("APPROACHING");
    world.dispose();
  });

  it("rejects action input outside the shared-danger scenario before advancing World", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();
    expect(() =>
      world.stepSituation({
        motionIntents: [intent("player"), intent("companion")],
        actionAttempts: [intervene("player")]
      })
    ).toThrow(/active shared-danger apparatus/);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("reaches a visible windup phase and proximity alone does not stop the consequence", async () => {
    const world = await LabWorld.create("shared-danger");
    const windup = await advanceToWindup(world);
    expect(windup.sharedDanger?.phaseTicksRemaining).toBe(S1_SHARED_DANGER_RULES.windupTicks);

    let result = windup;
    while (result.sharedDanger?.phase === "WINDUP") {
      result = world.stepSituation({
        motionIntents: [intent("player"), intent("companion")]
      });
    }

    expect(result.episodeOutcome).toBe("PLAYER_HIT");
    expect(result.sharedDanger?.phase).toBe("RECOVERING");
    expect(result.actionOutcomes).toEqual([]);
    world.dispose();
  });

  it("lets the player explicitly interrupt a windup under World rules", async () => {
    const world = await LabWorld.create("shared-danger");
    await advanceToWindup(world);

    const result = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")],
      actionAttempts: [intervene("player")]
    });

    expect(result.actionOutcomes).toHaveLength(1);
    expect(result.actionOutcomes[0]?.status).toBe("SUCCEEDED");
    expect(result.episodeOutcome).toBe("INTERRUPTED");
    expect(result.sharedDanger?.interruptedBy).toEqual(["player"]);
    world.dispose();
  });

  it("lets manual companion movement create a real intervention opportunity", async () => {
    const world = await LabWorld.create("shared-danger");
    await advanceToWindup(world);

    const tooFar = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")],
      actionAttempts: [intervene("companion")]
    });
    expect(tooFar.actionOutcomes[0]?.status).toBe("OUT_OF_RANGE");

    let snapshot = tooFar.snapshot;
    for (let tick = 0; tick < 15; tick += 1) {
      const danger = world.sharedDanger();
      if (danger?.phase !== "WINDUP") break;
      snapshot = world.stepSituation({
        motionIntents: [intent("player"), intent("companion", -1, 0)]
      }).snapshot;
    }

    const distance = Math.hypot(
      body(snapshot, "companion").position.x - body(snapshot, "hostile").position.x,
      body(snapshot, "companion").position.y - body(snapshot, "hostile").position.y
    );
    expect(distance).toBeLessThanOrEqual(S1_SHARED_DANGER_RULES.interventionRange + 0.05);

    const result = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")],
      actionAttempts: [intervene("companion")]
    });
    expect(result.actionOutcomes[0]?.status).toBe("SUCCEEDED");
    expect(result.episodeOutcome).toBe("INTERRUPTED");
    expect(result.sharedDanger?.interruptedBy).toEqual(["companion"]);
    world.dispose();
  });

  it("lets player movement make the committed hostile consequence factually miss", async () => {
    const world = await LabWorld.create("shared-danger");
    await advanceToWindup(world);

    let result = world.stepSituation({
      motionIntents: [intent("player", -1, 0), intent("companion")]
    });
    while (result.sharedDanger?.phase === "WINDUP") {
      result = world.stepSituation({
        motionIntents: [intent("player", -1, 0), intent("companion")]
      });
    }

    expect(result.episodeOutcome).toBe("ATTACK_MISSED");
    expect(result.sharedDanger?.lastOutcome).toBe("ATTACK_MISSED");
    world.dispose();
  });

  it("keeps the first apparatus one-shot after recovery completes", async () => {
    const world = await LabWorld.create("shared-danger");
    await advanceToWindup(world);
    let result = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")],
      actionAttempts: [intervene("player")]
    });

    for (let tick = 0; tick < S1_SHARED_DANGER_RULES.recoveryTicks; tick += 1) {
      result = world.stepSituation({
        motionIntents: [intent("player"), intent("companion")]
      });
    }

    expect(result.sharedDanger?.phase).toBe("COMPLETE");
    const hostile = body(result.snapshot, "hostile");
    const next = world.stepSituation({
      motionIntents: [intent("player"), intent("companion")]
    });
    expect(next.sharedDanger?.phase).toBe("COMPLETE");
    expect(body(next.snapshot, "hostile").position).toEqual(hostile.position);
    world.dispose();
  });
});
