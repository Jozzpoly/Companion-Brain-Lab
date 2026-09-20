import { describe, expect, it } from "vitest";
import {
  proposeS3MaterialContribution
} from "./s3-material-contribution";
import type { S2SituatedResponsibilityDecision } from "./situated-responsibility";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";

const rules = {
  interventionRange: 0.9,
  attackRange: 0.78,
  windupTicks: 45,
  recoveryTicks: 30
} as const;

function actor(id: ActorSnapshot["id"], x: number, y = 0): ActorSnapshot {
  return {
    id,
    position: { x, y },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(companionX: number, hostileX: number): WorldSnapshot {
  return {
    tick: 20,
    scenarioId: "shared-danger",
    width: 12,
    height: 8,
    actors: [
      actor("player", 0),
      actor("companion", companionX),
      actor("hostile", hostileX)
    ],
    obstacles: []
  };
}

function responsibility(state: "NONE" | "OWNED"): S2SituatedResponsibilityDecision {
  return {
    kind: "S2_SITUATED_RESPONSIBILITY",
    tick: 20,
    focusId: state === "OWNED" ? "hostile" : "hostile",
    attention: "TRACKING",
    responsibility: state,
    reasonCode:
      state === "OWNED"
        ? "INTERVENTION_REACHABLE_BEFORE_CONSEQUENCE"
        : "INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE",
    reason: "fixture",
    evidence: {
      phase: "WINDUP",
      playerToHostileDistance: 0.7,
      companionToHostileDistance: state === "OWNED" ? 1.3 : 4,
      playerAtMaterialRisk: true,
      straightLineTicksToInterventionRange: state === "OWNED" ? 8 : 62,
      consequenceTicksRemaining: 20,
      interventionRange: rules.interventionRange,
      attackRange: rules.attackRange
    }
  };
}

describe("S3 material contribution", () => {
  it("has zero autonomous output when S2 does not own responsibility", () => {
    const result = proposeS3MaterialContribution({
      snapshot: snapshot(1.2, 0.7),
      responsibility: responsibility("NONE"),
      rules
    });

    expect(result.kind).toBe("NONE");
    expect(result.motionIntent.move).toEqual({ x: 0, y: 0 });
    expect(result.actionAttempt).toBeNull();
  });

  it("approaches the responsible focus without emitting an action while still out of range", () => {
    const result = proposeS3MaterialContribution({
      snapshot: snapshot(2, 0.7),
      responsibility: responsibility("OWNED"),
      rules
    });

    expect(result.kind).toBe("APPROACH_INTERVENTION");
    expect(result.motionIntent.actorId).toBe("companion");
    expect(result.motionIntent.move.x).toBeCloseTo(-1, 8);
    expect(result.motionIntent.move.y).toBeCloseTo(0, 8);
    expect(result.actionAttempt).toBeNull();
  });

  it("submits exactly one companion World action once responsibility and range both permit it", () => {
    const result = proposeS3MaterialContribution({
      snapshot: snapshot(1.5, 0.7),
      responsibility: responsibility("OWNED"),
      rules
    });

    expect(result.kind).toBe("INTERVENE");
    expect(result.motionIntent.move).toEqual({ x: 0, y: 0 });
    expect(result.actionAttempt).toEqual({
      actorId: "companion",
      kind: "INTERVENE",
      targetId: "hostile"
    });
  });

  it("never bypasses S2 when responsibility evidence is absent", () => {
    const result = proposeS3MaterialContribution({
      snapshot: snapshot(1.5, 0.7),
      responsibility: null,
      rules
    });

    expect(result.kind).toBe("NONE");
    expect(result.actionAttempt).toBeNull();
  });
});
