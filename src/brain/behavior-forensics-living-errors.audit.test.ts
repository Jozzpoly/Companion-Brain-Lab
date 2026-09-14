import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { RelationalPositioningBrain } from "./relational-positioning";
import { evaluateSpatialLocomotion } from "./spatial-locomotion";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function withActors(snapshot: WorldSnapshot, player: Partial<ActorSnapshot>, companion: Partial<ActorSnapshot>): WorldSnapshot {
  return {
    ...snapshot,
    actors: snapshot.actors.map((entry) => entry.id === "player"
      ? { ...entry, ...player }
      : { ...entry, ...companion })
  };
}

function spatialInput(world: LabWorld, snapshot: WorldSnapshot, target: Vec2) {
  const companion = actor(snapshot, "companion");
  const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<LabWorld["staticCircleTraversal"]>[3]) =>
    world.staticCircleTraversal(from, to, radius, options);
  return {
    snapshot,
    relationshipTarget: target,
    routePlan: planStaticShadowRoute({ snapshot, start: companion.position, target, radius: companion.radius, query }),
    query
  };
}

describe("behavior-forensics: current living-error mechanisms", () => {
  it("open far-target local policy currently cruises at the 0.70 speed level", async () => {
    const world = await LabWorld.create("open");
    try {
      const base = world.snapshot();
      const snapshot = withActors(
        base,
        { position: { x: 1, y: 1 }, requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 } },
        { position: { x: 8, y: 4 }, requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 } }
      );
      const decision = evaluateSpatialLocomotion(spatialInput(world, snapshot, { x: 3, y: 4 }));
      const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
      expect(selected).toBeDefined();
      expect(selected?.speedFraction).toBeCloseTo(0.7, 9);
      expect(selected?.worldVelocity.x).toBeLessThan(-2.0);
      expect(Math.hypot(selected?.worldVelocity.x ?? 0, selected?.worldVelocity.y ?? 0)).toBeCloseTo(2.1, 9);
    } finally {
      world.dispose();
    }
  });

  it("inside the player buffer the local policy can select a trajectory with negative predicted player clearance", async () => {
    const world = await LabWorld.create("open");
    try {
      const base = world.snapshot();
      const snapshot = withActors(
        base,
        { position: { x: 4.69, y: 4 }, requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 } },
        { position: { x: 4, y: 4 }, requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 } }
      );
      const decision = evaluateSpatialLocomotion(spatialInput(world, snapshot, { x: 5.5, y: 4 }));
      const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
      expect(selected).toBeDefined();
      expect(selected?.hardRejected).toBe(false);
      expect(selected?.move.x).toBeGreaterThan(0.5);
      expect(selected?.minimumPlayerClearance).toBeLessThan(0);
    } finally {
      world.dispose();
    }
  });

  it("solver-induced motion of a zero-input player can become relationship heading evidence", async () => {
    const world = await LabWorld.create("head-on");
    try {
      let snapshot = world.snapshot();
      let pushed: WorldSnapshot | null = null;
      for (let step = 0; step < 120; step += 1) {
        snapshot = world.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          { actorId: "companion", move: { x: -1, y: 0 } }
        ]);
        const player = actor(snapshot, "player");
        if (Math.hypot(player.actualVelocity.x, player.actualVelocity.y) > 0.1) {
          pushed = snapshot;
          break;
        }
      }

      expect(pushed).not.toBeNull();
      if (!pushed) return;
      const player = actor(pushed, "player");
      expect(player.requestedVelocity).toEqual({ x: 0, y: 0 });
      expect(Math.hypot(player.actualVelocity.x, player.actualVelocity.y)).toBeGreaterThan(0.1);

      const brain = new RelationalPositioningBrain();
      const decision = brain.decision(pushed);
      const actualLength = Math.hypot(player.actualVelocity.x, player.actualVelocity.y);
      const actualDirection = {
        x: player.actualVelocity.x / actualLength,
        y: player.actualVelocity.y / actualLength
      };
      expect(decision.playerDirection.x * actualDirection.x + decision.playerDirection.y * actualDirection.y).toBeGreaterThan(0.99);
    } finally {
      world.dispose();
    }
  });

  it("solver-induced zero-input player motion can materially change the relational objective at identical geometry", async () => {
    const world = await LabWorld.create("head-on");
    try {
      let snapshot = world.snapshot();
      let pushed: WorldSnapshot | null = null;
      for (let step = 0; step < 120; step += 1) {
        snapshot = world.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          { actorId: "companion", move: { x: -1, y: 0 } }
        ]);
        const player = actor(snapshot, "player");
        if (player.actualVelocity.x < -0.1) {
          pushed = snapshot;
          break;
        }
      }

      expect(pushed).not.toBeNull();
      if (!pushed) return;
      const pushedPlayer = actor(pushed, "player");
      expect(pushedPlayer.requestedVelocity).toEqual({ x: 0, y: 0 });
      expect(pushedPlayer.actualVelocity.x).toBeLessThan(-0.1);

      const stationaryControl = withActors(
        pushed,
        { requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 } },
        {}
      );
      const controlDecision = new RelationalPositioningBrain().decision(stationaryControl);
      const pushedDecision = new RelationalPositioningBrain().decision(pushed);
      const targetShift = Math.hypot(
        pushedDecision.target.x - controlDecision.target.x,
        pushedDecision.target.y - controlDecision.target.y
      );
      const headingDot = pushedDecision.playerDirection.x * controlDecision.playerDirection.x +
        pushedDecision.playerDirection.y * controlDecision.playerDirection.y;

      console.log("SOLVER_MOTION_OBJECTIVE_LEAK", JSON.stringify({
        playerPosition: pushedPlayer.position,
        playerRequestedVelocity: pushedPlayer.requestedVelocity,
        playerActualVelocity: pushedPlayer.actualVelocity,
        control: {
          heading: controlDecision.playerDirection,
          slot: controlDecision.selectedSlot,
          target: controlDecision.target
        },
        pushed: {
          heading: pushedDecision.playerDirection,
          slot: pushedDecision.selectedSlot,
          target: pushedDecision.target
        },
        headingDot,
        targetShift
      }));

      expect(headingDot).toBeLessThan(-0.9);
      expect(targetShift).toBeGreaterThan(1.0);
    } finally {
      world.dispose();
    }
  });
});
