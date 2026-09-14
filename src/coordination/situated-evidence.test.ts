import { describe, expect, it } from "vitest";
import type { MovementCapability } from "../world/movement-capability";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import {
  buildSituatedEvidenceFrame,
  classifyObservedPlayerMotion,
  type PlayerBodyEvidence
} from "./situated-evidence";

function capability(actorId: "player" | "companion", maxSpeed = 3): MovementCapability {
  return { actorId, maxSpeed, radius: 0.3, source: "actor-spec" };
}

function body(overrides: Partial<PlayerBodyEvidence> = {}): PlayerBodyEvidence {
  return {
    sourceTick: 10,
    position: { x: 4, y: 4 },
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: [],
    ...overrides
  };
}

function actor(
  id: "player" | "companion",
  position: Vec2,
  requestedVelocity: Vec2,
  actualVelocity: Vec2,
  contacts: readonly string[] = []
): ActorSnapshot {
  return {
    id,
    position,
    radius: 0.3,
    requestedVelocity,
    actualVelocity,
    motionError: Math.hypot(
      requestedVelocity.x - actualVelocity.x,
      requestedVelocity.y - actualVelocity.y
    ),
    contacts: contacts.map((withId) => ({ with: withId, contactCount: 1 }))
  };
}

function snapshot(player: ActorSnapshot): WorldSnapshot {
  return {
    tick: 10,
    scenarioId: "head-on",
    width: 12,
    height: 8,
    actors: [
      player,
      actor("companion", { x: 5, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })
    ],
    obstacles: []
  };
}

describe("Authority-A0 situated evidence", () => {
  it("keeps a truly stationary body distinct from semantic control evidence", () => {
    const result = classifyObservedPlayerMotion(body());
    expect(result.state).toBe("STATIONARY");
    expect(result.requestedSpeed).toBe(0);
    expect(result.actualSpeed).toBe(0);
  });

  it("marks zero-request contact-driven body motion as external motion evidence", () => {
    const result = classifyObservedPlayerMotion(body({
      actualVelocity: { x: -1.499, y: 0 },
      motionError: 1.499,
      contacts: ["companion"]
    }));

    expect(result.state).toBe("EXTERNAL_MOTION_EVIDENT");
    expect(result.requestedSpeed).toBe(0);
    expect(result.actualSpeed).toBeCloseTo(1.499, 6);
  });

  it("recognizes aligned unconstrained requested/actual motion", () => {
    const result = classifyObservedPlayerMotion(body({
      requestedVelocity: { x: 3, y: 0 },
      actualVelocity: { x: 2.99, y: 0 },
      motionError: 0.01
    }));

    expect(result.state).toBe("OWNER_DIRECTED");
    expect(result.requestedActualAlignment).toBeCloseTo(1, 8);
  });

  it("recognizes strongly suppressed requested motion as constrained", () => {
    const result = classifyObservedPlayerMotion(body({
      requestedVelocity: { x: 3, y: 0 },
      actualVelocity: { x: 0.2, y: 0 },
      motionError: 2.8,
      contacts: ["wall"]
    }));

    expect(result.state).toBe("OWNER_CONSTRAINED");
  });

  it("keeps same-step owner control separate from externally moving body evidence", () => {
    const input = snapshot(actor(
      "player",
      { x: 4.475, y: 4 },
      { x: 0, y: 0 },
      { x: -1.499, y: 0 },
      ["companion"]
    ));

    const frame = buildSituatedEvidenceFrame({
      snapshot: input,
      playerControlMove: { x: 0, y: 0 },
      playerCapability: capability("player"),
      companionCapability: capability("companion")
    });

    expect(frame.tick).toBe(10);
    expect(frame.playerControl.sourceTick).toBe(10);
    expect(frame.playerControl.active).toBe(false);
    expect(frame.playerControl.move).toEqual({ x: 0, y: 0 });
    expect(frame.playerBody.requestedVelocity).toEqual({ x: 0, y: 0 });
    expect(frame.playerBody.actualVelocity.x).toBeCloseTo(-1.499, 6);
    expect(frame.playerBody.contacts).toEqual(["companion"]);
    expect(frame.playerMotionProvenance.state).toBe("EXTERNAL_MOTION_EVIDENT");
  });
});
