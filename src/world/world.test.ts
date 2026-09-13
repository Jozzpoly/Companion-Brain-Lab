import { describe, expect, it } from "vitest";
import { LabWorld } from "./world";

const zero = { x: 0, y: 0 };

type ActorId = "player" | "companion";

function intent(actorId: ActorId, x: number, y: number) {
  return { actorId, move: { x, y } } as const;
}

function actor(snapshot: ReturnType<LabWorld["snapshot"]>, id: ActorId) {
  const found = snapshot.actors.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing actor ${id}`);
  return found;
}

function actorDistance(snapshot: ReturnType<LabWorld["snapshot"]>): number {
  const player = actor(snapshot, "player");
  const companion = actor(snapshot, "companion");
  return Math.hypot(
    companion.position.x - player.position.x,
    companion.position.y - player.position.y
  );
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

  it("rejects duplicate control authority without advancing state", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();
    expect(() =>
      world.step([intent("player", 1, 0), intent("player", -1, 0)])
    ).toThrow(/Duplicate motion intent/);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("prevents the player from crossing the central pillar and exposes the obstruction", async () => {
    const world = await LabWorld.create("pillar");
    let snapshot = world.snapshot();
    for (let step = 0; step < 180; step += 1) {
      snapshot = world.step([intent("player", 1, 0), { actorId: "companion", move: zero }]);
    }
    const player = actor(snapshot, "player");
    expect(player.position.x).toBeLessThan(5.5 - player.radius + 0.08);
    expect(player.motionError).toBeGreaterThan(0.2);
    expect(player.contacts.some((contact) => contact.with === "pillar.center")).toBe(true);
    world.dispose();
  });

  it("keeps actors inside the authored world boundary and reports boundary contact", async () => {
    const world = await LabWorld.create("open");
    let snapshot = world.snapshot();
    for (let step = 0; step < 240; step += 1) {
      snapshot = world.step([intent("player", -1, 0), intent("companion", 0, 0)]);
    }
    const player = actor(snapshot, "player");
    expect(player.position.x).toBeGreaterThanOrEqual(player.radius - 0.03);
    expect(player.contacts.some((contact) => contact.with === "boundary.left")).toBe(true);
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
    expect(actorDistance(snapshot)).toBeGreaterThanOrEqual(player.radius + companion.radius - 0.05);
    expect(player.contacts.some((contact) => contact.with === "companion")).toBe(true);
    expect(companion.contacts.some((contact) => contact.with === "player")).toBe(true);
    world.dispose();
  });

  it("keeps a narrow-doorway conflict bounded and causally visible", async () => {
    const world = await LabWorld.create("doorway");
    let snapshot = world.snapshot();
    for (let step = 0; step < 100; step += 1) {
      snapshot = world.step([intent("player", 1, 0), intent("companion", -1, 0)]);
    }
    const player = actor(snapshot, "player");
    const companion = actor(snapshot, "companion");
    expect(actorDistance(snapshot)).toBeGreaterThanOrEqual(player.radius + companion.radius - 0.05);
    expect(player.contacts.some((contact) => contact.with === "companion")).toBe(true);
    expect(companion.contacts.some((contact) => contact.with === "player")).toBe(true);
    expect(player.motionError).toBeGreaterThan(0.2);
    expect(companion.motionError).toBeGreaterThan(0.2);
    world.dispose();
  });

  it("produces exactly repeatable state for the same scripted fixed-step run in one environment", async () => {
    async function run() {
      const world = await LabWorld.create("pillar");
      for (let step = 0; step < 180; step += 1) {
        const playerMove = step < 75 ? { x: 1, y: 0.25 } : step < 120 ? { x: 0, y: -1 } : { x: -0.5, y: 0.5 };
        const companionMove = step < 60 ? { x: -1, y: 0 } : step < 130 ? { x: 0, y: 1 } : { x: 0.75, y: -0.25 };
        world.step([
          { actorId: "player", move: playerMove },
          { actorId: "companion", move: companionMove }
        ]);
      }
      const result = world.snapshot();
      world.dispose();
      return result;
    }

    expect(await run()).toEqual(await run());
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
