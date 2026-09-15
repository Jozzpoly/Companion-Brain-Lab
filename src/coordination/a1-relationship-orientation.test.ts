import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { MovementCapability } from "../world/movement-capability";
import type { Vec2 } from "../world/types";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import {
  A1_ORIENTATION_MEMORY_TICKS,
  a1OrientationMemoryStrength,
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";

const PLAYER_CAPABILITY: MovementCapability = {
  actorId: "player",
  maxSpeed: 3,
  radius: 0.3,
  source: "actor-spec"
};

const COMPANION_CAPABILITY: MovementCapability = {
  actorId: "companion",
  maxSpeed: 3,
  radius: 0.3,
  source: "actor-spec"
};

function body(position: Vec2, requestedVelocity: Vec2, actualVelocity: Vec2) {
  return {
    sourceTick: 0,
    position: { ...position },
    requestedVelocity: { ...requestedVelocity },
    actualVelocity: { ...actualVelocity },
    motionError: Math.hypot(
      actualVelocity.x - requestedVelocity.x,
      actualVelocity.y - requestedVelocity.y
    ),
    contacts: [] as string[]
  };
}

function syntheticSituation(options: {
  tick: number;
  control: Vec2;
  playerRequestedVelocity?: Vec2;
  playerActualVelocity?: Vec2;
  playerMotionState?: A1Situation["situated"]["playerMotionProvenance"]["state"];
  contacts?: string[];
}): A1Situation {
  const controlLength = Math.hypot(options.control.x, options.control.y);
  const move = controlLength > 1
    ? { x: options.control.x / controlLength, y: options.control.y / controlLength }
    : { ...options.control };
  const requested = options.playerRequestedVelocity ?? {
    x: move.x * PLAYER_CAPABILITY.maxSpeed,
    y: move.y * PLAYER_CAPABILITY.maxSpeed
  };
  const actual = options.playerActualVelocity ?? { ...requested };
  const playerBody = body({ x: 6, y: 4 }, requested, actual);
  playerBody.sourceTick = options.tick;
  playerBody.contacts = [...(options.contacts ?? [])];
  const requestedSpeed = Math.hypot(requested.x, requested.y);
  const actualSpeed = Math.hypot(actual.x, actual.y);

  return {
    kind: "AUTHORITY_A1_SITUATION",
    tick: options.tick,
    situated: {
      tick: options.tick,
      playerControl: {
        sourceTick: options.tick,
        move: { ...options.control },
        active: controlLength > 0.03
      },
      playerBody,
      playerMotionProvenance: {
        state: options.playerMotionState ?? (requestedSpeed > 0 ? "OWNER_DIRECTED" : actualSpeed > 0 ? "EXTERNAL_MOTION_EVIDENT" : "STATIONARY"),
        reason: "synthetic orientation falsifier",
        requestedSpeed,
        actualSpeed,
        requestedActualAlignment: requestedSpeed > 0 && actualSpeed > 0 ? 1 : null
      },
      playerCapability: { ...PLAYER_CAPABILITY },
      companionBody: {
        ...body({ x: 4.5, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }),
        sourceTick: options.tick
      },
      companionCapability: { ...COMPANION_CAPABILITY }
    },
    playerRequestedVelocity: {
      sourceTick: options.tick,
      move,
      velocity: {
        x: move.x * PLAYER_CAPABILITY.maxSpeed,
        y: move.y * PLAYER_CAPABILITY.maxSpeed
      },
      speed: Math.hypot(move.x, move.y) * PLAYER_CAPABILITY.maxSpeed,
      capabilityMaxSpeed: PLAYER_CAPABILITY.maxSpeed,
      source: "same-step-owner-motion-intent"
    },
    previousOutcome: null
  };
}

function memory(direction: Vec2, sourceTick: number): A1RelationshipOrientationMemory {
  return {
    provenance: "OWNER_CONTROL",
    direction: { ...direction },
    sourceTick
  };
}

describe("Authority-A1.1a relationship orientation", () => {
  it("uses the same-step Owner reversal even while the previous completed World response is still +X", async () => {
    const world = await LabWorld.create("open");
    try {
      const beforeReversal = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        { actorId: "companion", move: { x: 0, y: 0 } }
      ]);
      const situation = buildA1Situation({
        snapshot: beforeReversal,
        playerIntent: { actorId: "player", move: { x: -1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });

      expect(situation.previousOutcome?.playerBody.requestedVelocity.x).toBeGreaterThan(2.9);

      const result = evaluateA1RelationshipOrientation({
        situation,
        memory: memory({ x: 1, y: 0 }, 0)
      });

      expect(result.source).toBe("SAME_STEP_OWNER");
      expect(result.direction).toEqual({ x: -1, y: 0 });
      expect(result.sourceTick).toBe(1);
      expect(result.ageTicks).toBe(0);
      expect(result.strength).toBe(1);
      expect(result.samplingBasis).toEqual({ x: -1, y: 0 });
      expect(result.samplingBasisSource).toBe("SEMANTIC_ORIENTATION");
      expect(result.nextMemory).toEqual(memory({ x: -1, y: 0 }, 1));
    } finally {
      world.dispose();
    }
  });

  it("does not fabricate semantic facing when stationary with no Owner memory", () => {
    const result = evaluateA1RelationshipOrientation({
      situation: syntheticSituation({ tick: 12, control: { x: 0, y: 0 } })
    });

    expect(result.source).toBe("NONE");
    expect(result.direction).toBeNull();
    expect(result.sourceTick).toBeNull();
    expect(result.ageTicks).toBeNull();
    expect(result.strength).toBe(0);
    expect(result.nextMemory).toBeNull();
    expect(result.samplingBasis).toEqual({ x: 1, y: 0 });
    expect(result.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
  });

  it("ignores externally induced body motion as semantic orientation when Owner control and memory are absent", () => {
    const result = evaluateA1RelationshipOrientation({
      situation: syntheticSituation({
        tick: 9,
        control: { x: 0, y: 0 },
        playerRequestedVelocity: { x: 0, y: 0 },
        playerActualVelocity: { x: 0, y: 2.4 },
        playerMotionState: "EXTERNAL_MOTION_EVIDENT",
        contacts: ["companion"]
      })
    });

    expect(result.source).toBe("NONE");
    expect(result.direction).toBeNull();
    expect(result.nextMemory).toBeNull();
    expect(result.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
  });

  it("does not let changing physical body evidence refresh or rotate existing Owner memory", () => {
    const ownerMemory = memory({ x: 0, y: -1 }, 4);
    const quiet = syntheticSituation({
      tick: 10,
      control: { x: 0, y: 0 },
      playerRequestedVelocity: { x: 0, y: 0 },
      playerActualVelocity: { x: 0, y: 0 },
      playerMotionState: "STATIONARY"
    });
    const pushed = syntheticSituation({
      tick: 10,
      control: { x: 0, y: 0 },
      playerRequestedVelocity: { x: 0, y: 0 },
      playerActualVelocity: { x: 2.7, y: 0.4 },
      playerMotionState: "EXTERNAL_MOTION_EVIDENT",
      contacts: ["companion"]
    });

    const quietResult = evaluateA1RelationshipOrientation({ situation: quiet, memory: ownerMemory });
    const pushedResult = evaluateA1RelationshipOrientation({ situation: pushed, memory: ownerMemory });

    expect(pushedResult).toEqual(quietResult);
    expect(pushedResult.source).toBe("OWNER_MEMORY");
    expect(pushedResult.direction).toEqual({ x: 0, y: -1 });
    expect(pushedResult.sourceTick).toBe(4);
    expect(pushedResult.ageTicks).toBe(6);
    expect(pushedResult.nextMemory).toEqual(ownerMemory);
  });

  it("derives memory age from World tick so repeated evaluator calls cannot slow or refresh expiry", () => {
    const ownerMemory = memory({ x: 1, y: 0 }, 0);
    const atSix = syntheticSituation({ tick: 6, control: { x: 0, y: 0 } });
    const first = evaluateA1RelationshipOrientation({ situation: atSix, memory: ownerMemory });
    const repeated = evaluateA1RelationshipOrientation({ situation: atSix, memory: ownerMemory });
    const atTwelve = evaluateA1RelationshipOrientation({
      situation: syntheticSituation({ tick: 12, control: { x: 0, y: 0 } }),
      memory: ownerMemory
    });

    expect(repeated).toEqual(first);
    expect(first.ageTicks).toBe(6);
    expect(atTwelve.ageTicks).toBe(12);
    expect(atTwelve.strength).toBeLessThan(first.strength);
    expect(first.strength).toBeCloseTo(a1OrientationMemoryStrength(6), 12);
    expect(atTwelve.strength).toBeCloseTo(a1OrientationMemoryStrength(12), 12);
  });

  it("fades Owner memory monotonically to NONE without converting the world-axis sampling basis into semantic facing", () => {
    const ownerMemory = memory({ x: 0, y: 1 }, 0);
    let previousStrength = 1;

    for (let tick = 1; tick < A1_ORIENTATION_MEMORY_TICKS; tick += 1) {
      const result = evaluateA1RelationshipOrientation({
        situation: syntheticSituation({ tick, control: { x: 0, y: 0 } }),
        memory: ownerMemory
      });
      expect(result.source).toBe("OWNER_MEMORY");
      expect(result.direction).toEqual({ x: 0, y: 1 });
      expect(result.strength).toBeLessThanOrEqual(previousStrength + 1e-12);
      previousStrength = result.strength;
    }

    const expired = evaluateA1RelationshipOrientation({
      situation: syntheticSituation({ tick: A1_ORIENTATION_MEMORY_TICKS, control: { x: 0, y: 0 } }),
      memory: ownerMemory
    });
    expect(expired.source).toBe("NONE");
    expect(expired.direction).toBeNull();
    expect(expired.strength).toBe(0);
    expect(expired.nextMemory).toBeNull();
    expect(expired.samplingBasis).toEqual({ x: 1, y: 0 });
    expect(expired.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
  });

  it("lets current Owner intent define semantics even when physical body provenance is constrained or mixed", () => {
    const result = evaluateA1RelationshipOrientation({
      situation: syntheticSituation({
        tick: 21,
        control: { x: 0, y: -1 },
        playerRequestedVelocity: { x: 0, y: -3 },
        playerActualVelocity: { x: 2.2, y: 0 },
        playerMotionState: "MIXED_OR_UNCERTAIN",
        contacts: ["companion"]
      }),
      memory: memory({ x: 1, y: 0 }, 20)
    });

    expect(result.source).toBe("SAME_STEP_OWNER");
    expect(result.direction).toEqual({ x: 0, y: -1 });
    expect(result.nextMemory).toEqual(memory({ x: 0, y: -1 }, 21));
  });

  it("rejects future or non-directional Owner memory instead of silently normalizing invalid semantic history", () => {
    const situation = syntheticSituation({ tick: 8, control: { x: 0, y: 0 } });

    expect(() => evaluateA1RelationshipOrientation({
      situation,
      memory: memory({ x: 1, y: 0 }, 9)
    })).toThrow(/source tick/);

    expect(() => evaluateA1RelationshipOrientation({
      situation,
      memory: memory({ x: 0, y: 0 }, 7)
    })).toThrow(/finite nonzero direction/);
  });
});
