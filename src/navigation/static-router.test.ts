import { describe, expect, it } from "vitest";
import { planStaticShadowRoute, S2C_ROUTE_CLEARANCE } from "./static-router";
import { LabWorld } from "../world/world";
import type { Vec2 } from "../world/types";

function companionState(world: LabWorld): { position: Vec2; radius: number } {
  const companion = world.snapshot().actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("Missing companion fixture.");
  return { position: companion.position, radius: companion.radius };
}

function plan(world: LabWorld, target: Vec2, radiusOverride?: number) {
  const snapshot = world.snapshot();
  const companion = companionState(world);
  const radius = radiusOverride ?? companion.radius;
  return planStaticShadowRoute({
    snapshot,
    start: companion.position,
    target,
    radius,
    query: (from, to, queryRadius, options) => world.staticCircleTraversal(from, to, queryRadius, options)
  });
}

describe("S2-C0 / R1-2A deterministic static router", () => {
  it("returns a direct unconstrained plan in open space", async () => {
    const world = await LabWorld.create("open");
    const result = plan(world, { x: 3, y: 4 });

    expect(result.status).toBe("direct");
    expect(result.routeNodeIds).toEqual(["start", "target"]);
    expect(result.waypoints).toEqual([{ x: 3, y: 4 }]);
    expect(result.cost).toBeCloseTo(5, 6);
    expect(result.queryRadius).toBeCloseTo(0.3, 6);
    expect(result.desiredQueryRadius).toBeCloseTo(0.3 + S2C_ROUTE_CLEARANCE, 6);
    expect(result.clearanceConstrained).toBe(false);
    expect(result.constrainedEdgeIds).toEqual([]);
    world.dispose();
  });

  it("finds and exposes a deterministic route around the central pillar", async () => {
    const world = await LabWorld.create("pillar");
    const first = plan(world, { x: 3, y: 4 });
    const second = plan(world, { x: 3, y: 4 });

    expect(first.status).toBe("routed");
    expect(first.routeNodeIds).toEqual(second.routeNodeIds);
    expect(first.cost).toBeCloseTo(second.cost ?? Number.NaN, 9);
    expect(first.routeNodeIds[0]).toBe("start");
    expect(first.routeNodeIds.at(-1)).toBe("target");
    expect(first.routeNodeIds).toContain("pillar.center.ne");
    expect(first.routeNodeIds).toContain("pillar.center.nw");

    const direct = first.edges.find((edge) => edge.id === "start<->target");
    expect(direct?.clear).toBe(false);
    expect(direct?.blocker?.label).toBe("pillar.center");

    for (let index = 0; index < first.routeNodeIds.length - 1; index += 1) {
      const a = first.routeNodeIds[index];
      const b = first.routeNodeIds[index + 1];
      if (!a || !b) throw new Error("Malformed route fixture.");
      const id = a < b ? `${a}<->${b}` : `${b}<->${a}`;
      expect(first.edges.find((edge) => edge.id === id)?.clear).toBe(true);
    }
    world.dispose();
  });

  it("finds a static route through the doorway gap to an offset target", async () => {
    const world = await LabWorld.create("doorway");
    const result = plan(world, { x: 4, y: 2.5 });

    expect(result.status).toBe("routed");
    expect(result.routeNodeIds[0]).toBe("start");
    expect(result.routeNodeIds.at(-1)).toBe("target");
    expect(result.waypoints.length).toBeGreaterThan(1);
    expect(result.reason).toContain("hard-body direct route blocked");
    expect(result.edges.some((edge) => !edge.clear && edge.blocker?.label === "door.wall.top")).toBe(true);
    world.dispose();
  });

  it("rejects a target that cannot contain the actor body", async () => {
    const world = await LabWorld.create("pillar");
    const result = plan(world, { x: 6, y: 4 });

    expect(result.status).toBe("invalid-target");
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.cost).toBeNull();
    world.dispose();
  });

  it("does not call a physically clear rounded obstacle corner an invalid target", async () => {
    const world = await LabWorld.create("pillar");
    // The center lies inside the pillar's square AABB expanded by 0.3 m, but the
    // actual circle is ~0.354 m from the corner and therefore physically clear.
    const result = plan(world, { x: 5.25, y: 1.75 });

    expect(result.status).not.toBe("invalid-target");
    world.dispose();
  });

  it("keeps a physically fitting doorway reachable while marking comfort clearance constrained", async () => {
    const world = await LabWorld.create("doorway");
    const result = plan(world, { x: 4, y: 4 }, 0.65);

    expect(result.status).toBe("direct");
    expect(result.clearanceConstrained).toBe(true);
    expect(result.constrainedEdgeIds).toEqual(["start<->target"]);
    const direct = result.edges.find((edge) => edge.id === "start<->target");
    expect(direct?.clear).toBe(true);
    expect(direct?.comfortClear).toBe(false);
    expect(direct?.comfortBlocker?.label).toMatch(/door\.wall\.(top|bottom)/);
    world.dispose();
  });

  it("reports a physically impossible doorway as unreachable even after comfort is demoted from hard law", async () => {
    const world = await LabWorld.create("doorway");
    const result = plan(world, { x: 4, y: 4 }, 0.8);

    expect(result.status).toBe("unreachable");
    expect(result.cost).toBeNull();
    expect(result.routeNodeIds).toHaveLength(0);
    expect(result.edges.some((edge) => !edge.clear)).toBe(true);
    world.dispose();
  });

  it("permits hard-feasible egress when the route start is already inside desired clearance", async () => {
    const world = await LabWorld.create("pillar");
    const snapshot = world.snapshot();
    const result = planStaticShadowRoute({
      snapshot,
      start: { x: 5.16, y: 4 },
      target: { x: 3.5, y: 4 },
      radius: 0.3,
      query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
    });

    expect(result.status).toBe("direct");
    expect(result.routeNodeIds).toEqual(["start", "target"]);
    expect(result.edges.find((edge) => edge.id === "start<->target")?.clear).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    world.dispose();
  });

  it("keeps the planner read-only with respect to World state", async () => {
    const world = await LabWorld.create("pillar");
    const before = world.snapshot();
    plan(world, { x: 3, y: 4 });

    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("rejects invalid routing clearance explicitly", async () => {
    const world = await LabWorld.create("open");
    const snapshot = world.snapshot();
    const companion = companionState(world);

    expect(() => planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target: { x: 3, y: 4 },
      radius: companion.radius,
      clearance: -0.01,
      query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
    })).toThrow(/clearance/);
    world.dispose();
  });
});