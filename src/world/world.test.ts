import { describe, expect, it } from "vitest";
import { LabWorld } from "./world";

const zero = { x: 0, y: 0 };

function intent(actorId: "player" | "companion", x: number, y: number) {
  return { actorId, move: { x, y } } as const;
}

function actor(snapshot: ReturnType<LabWorld["snapshot"]>, id: "player" | "companion") {
  const found = snapshot.actors.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing actor ${id}`);
  return found;
}

describe("S0 physical apparatus", () => {
  it("advances exactly one domain tick per step and resets by reconstruction", async () => {
    const world = await LabWorld.create("open");
    const initial = world.snapshot();
    const stepped = world.step([intent("player", 1, 0), intent("companion", 0, 0)]);
    expect(initial.tick).toBe(0);
    expect(stepped.tick).toBe(1);
    expect(actor(stepped, "player").position.x).toBeGreaterThan(actor(initial, "player").position.x);
    world.dispose();

    const reset = await LabWorld.create("open");
    expect(reset.snapshot()).toEqual(initial);
    reset.dispose();
  });

  it("rejects non-finite controller input before the physics step", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();
    expect(() => world.step([{ actorId: "player", move: { x: Number.NaN, y: 0 } }])).toThrow();
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("prevents the player from crossing the central pillar", async () => {
    const world = await LabWorld.create("pillar");
    for (let step = 0; step < 180; step += 1) {
      world.step([intent("player", 1, 0), { actorId: "companion", move: zero }]);
    }
    const player = actor(world.snapshot(), "player");
    expect(player.position.x).toBeLessThan(5.5 - player.radius + 0.08);
    world.dispose();
  });

  it("keeps two actors from deeply interpenetrating in the head-on fixture", async () => {
    const world = await LabWorld.create("head-on");
    let snapshot = world.snapshot();
    for (let step = 0; step < 120; step += 1) {
      snapshot = world.step([intent("player", 1, 0), intent("companion", -1, 0)]);
    }
    const player = actor(snapshot, "player");
    const companion = actor(snapshot, "companion");
    const distance = Math.hypot(
      companion.position.x - player.position.x,
      companion.position.y - player.position.y
    );
    expect(distance).toBeGreaterThanOrEqual(player.radius + companion.radius - 0.05);
    expect(player.contacts.some((contact) => contact.with === "companion")).toBe(true);
    expect(companion.contacts.some((contact) => contact.with === "player")).toBe(true);
    world.dispose();
  });

  it("reports requested-vs-actual motion when an actor is blocked", async () => {
    const world = await LabWorld.create("pillar");
    let snapshot = world.snapshot();
    for (let step = 0; step < 90; step += 1) {
      snapshot = world.step([intent("player", 1, 0), intent("companion", 0, 0)]);
    }
    expect(actor(snapshot, "player").motionError).toBeGreaterThan(0.2);
    world.dispose();
  });
});
