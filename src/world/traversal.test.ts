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

describe("S2-C0 arbitrary static graph-edge traversal", () => {
  it("classifies an arbitrary graph edge through the pillar as blocked", async () => {
    const world = await LabWorld.create("pillar");
    const before = world.snapshot();
    const result = world.staticCircleTraversal({ x: 9, y: 4 }, { x: 3, y: 4 }, 0.3);

    expect(result.clear).toBe(false);
    expect(result.blocker?.label).toBe("pillar.center");
    expect(result.from).toEqual({ x: 9, y: 4 });
    expect(result.to).toEqual({ x: 3, y: 4 });
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("classifies an arbitrary edge above the pillar as clear", async () => {
    const world = await LabWorld.create("pillar");
    const result = world.staticCircleTraversal({ x: 9, y: 1 }, { x: 3, y: 1 }, 0.3);

    expect(result.clear).toBe(true);
    expect(result.blocker).toBeNull();
    world.dispose();
  });

  it("classifies the doorway center as a clear arbitrary graph edge", async () => {
    const world = await LabWorld.create("doorway");
    const result = world.staticCircleTraversal({ x: 8, y: 4 }, { x: 4, y: 4 }, 0.3);

    expect(result.clear).toBe(true);
    expect(result.blocker).toBeNull();
    world.dispose();
  });

  it("rejects invalid graph-edge radius without mutating World state", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();

    expect(() => world.staticCircleTraversal({ x: 8, y: 4 }, { x: 4, y: 4 }, 0)).toThrow(/positive radius/);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });
});

describe("R1-2 explicit hard / comfort / egress spatial query contract", () => {
  it("distinguishes a hard-legal position from desired-clearance occupancy", async () => {
    const world = await LabWorld.create("pillar");
    const before = world.snapshot();
    const center = { x: 5.16, y: 4 };

    const hard = world.staticCircleOccupancy(center, 0.3);
    const comfort = world.staticCircleOccupancy(center, 0.38);

    expect(hard.clear).toBe(true);
    expect(hard.blockers).toEqual([]);
    expect(comfort.clear).toBe(false);
    expect(comfort.blockers).toEqual(["pillar.center"]);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("keeps dynamic actors out of static occupancy classification", async () => {
    const world = await LabWorld.create("head-on");
    const player = world.snapshot().actors.find((actor) => actor.id === "player");
    if (!player) throw new Error("Missing player fixture.");

    const occupancy = world.staticCircleOccupancy(player.position, player.radius);
    expect(occupancy.clear).toBe(true);
    expect(occupancy.blockers).toEqual([]);
    world.dispose();
  });

  it("preserves blocking semantics by default but permits a desired-clearance egress cast", async () => {
    const world = await LabWorld.create("pillar");
    const start = { x: 5.16, y: 4 };
    const outward = { x: 4.5, y: 4 };

    const blocked = world.staticCircleTraversal(start, outward, 0.38);
    const egress = world.staticCircleTraversal(start, outward, 0.38, { initialOverlap: "allow-egress" });

    expect(blocked.clear).toBe(false);
    expect(blocked.blocker?.label).toBe("pillar.center");
    expect(blocked.blocker?.distance).toBeCloseTo(0, 6);
    expect(egress.clear).toBe(true);
    expect(egress.blocker).toBeNull();
    world.dispose();
  });

  it("allow-egress ignores only the initial penetration and still reports a later static hit", async () => {
    const world = await LabWorld.create("pillar");
    const start = { x: 5.16, y: 4 };
    const beyondLeftBoundary = { x: -1, y: 4 };

    const result = world.staticCircleTraversal(start, beyondLeftBoundary, 0.38, { initialOverlap: "allow-egress" });

    expect(result.clear).toBe(false);
    expect(result.blocker?.label).toBe("boundary.left");
    expect(result.blocker?.distance).toBeGreaterThan(0);
    expect(result.blocker?.distance).toBeLessThan(result.distance);
    world.dispose();
  });

  it("rejects invalid occupancy inputs without advancing World state", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();

    expect(() => world.staticCircleOccupancy({ x: Number.NaN, y: 4 }, 0.3)).toThrow(/finite/);
    expect(() => world.staticCircleOccupancy({ x: 4, y: 4 }, 0)).toThrow(/positive radius/);
    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });
});
