import { describe, expect, it } from "vitest";
import { LabWorld } from "./world";

describe("S2-B direct traversal feasibility", () => {
  it("reports an unobstructed whole-body segment as clear without advancing World state", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();
    const result = world.directTraversal("companion", { x: 3, y: 4 });

    expect(result.clear).toBe(true);
    expect(result.blocker).toBeNull();
    expect(result.radius).toBeCloseTo(0.3, 6);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("reports the first static blocker for a companion-radius sweep through the pillar", async () => {
    const world = await LabWorld.create("pillar");
    const result = world.directTraversal("companion", { x: 3, y: 4 });

    expect(result.clear).toBe(false);
    expect(result.blocker?.label).toBe("pillar.center");
    expect(result.blocker?.distance).toBeGreaterThan(0);
    expect(result.blocker?.distance).toBeLessThan(result.distance);
    expect(result.blocker?.fraction).toBeGreaterThan(0);
    expect(result.blocker?.fraction).toBeLessThan(1);
    expect(result.blocker?.contactPoint.x).toBeGreaterThan(5.4);
    expect(result.blocker?.contactPoint.x).toBeLessThan(6.6);
    world.dispose();
  });

  it("recognizes the authored doorway center corridor as statically traversable", async () => {
    const world = await LabWorld.create("doorway");
    const result = world.directTraversal("companion", { x: 3.8, y: 4 });

    expect(result.clear).toBe(true);
    expect(result.blocker).toBeNull();
    world.dispose();
  });

  it("detects a doorway wall when the requested whole-body segment clips the choke geometry", async () => {
    const world = await LabWorld.create("doorway");
    const result = world.directTraversal("companion", { x: 3.8, y: 2.5 });

    expect(result.clear).toBe(false);
    expect(result.blocker?.label).toBe("door.wall.top");
    expect(result.blocker?.normal.x).toBeGreaterThan(0.5);
    world.dispose();
  });

  it("keeps dynamic actors out of the static traversal classification", async () => {
    const world = await LabWorld.create("head-on");
    const player = world.snapshot().actors.find((actor) => actor.id === "player");
    if (!player) throw new Error("Missing player fixture.");

    const result = world.directTraversal("companion", player.position);
    expect(result.clear).toBe(true);
    expect(result.blocker).toBeNull();
    world.dispose();
  });

  it("rejects non-finite traversal targets without mutating state", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();

    expect(() => world.directTraversal("companion", { x: Number.NaN, y: 4 })).toThrow(/finite/);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });
});
