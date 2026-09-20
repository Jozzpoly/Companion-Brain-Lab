import { describe, expect, it } from "vitest";
import {
  evaluateS2SituatedResponsibility,
  type S2SituatedResponsibilityDecision
} from "./situated-responsibility";
import { initialSharedDangerSnapshot, type SharedDangerSnapshot } from "../world/shared-danger-contract";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";

const rules = {
  interventionRange: 0.9,
  attackRange: 0.78,
  windupTicks: 45,
  recoveryTicks: 30
} as const;

function actor(id: ActorSnapshot["id"], x: number): ActorSnapshot {
  return {
    id,
    position: { x, y: 0 },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(input: {
  tick?: number;
  playerX: number;
  companionX: number;
  hostileX: number;
}): WorldSnapshot {
  return {
    tick: input.tick ?? 10,
    scenarioId: "shared-danger",
    width: 12,
    height: 8,
    actors: [
      actor("player", input.playerX),
      actor("companion", input.companionX),
      actor("hostile", input.hostileX)
    ],
    obstacles: []
  };
}

function danger(
  phase: SharedDangerSnapshot["phase"],
  phaseTicksRemaining = phase === "WINDUP" ? 20 : phase === "RECOVERING" ? 10 : 0
): SharedDangerSnapshot {
  return {
    ...initialSharedDangerSnapshot(),
    phase,
    phaseTicksRemaining
  };
}

function decide(
  world: WorldSnapshot,
  sharedDanger: SharedDangerSnapshot | null
): S2SituatedResponsibilityDecision {
  return evaluateS2SituatedResponsibility({
    snapshot: world,
    danger: sharedDanger,
    rules,
    companionMaxSpeed: 3,
    worldStepSeconds: 1 / 60
  });
}

describe("S2 situated responsibility", () => {
  it("tracks an approaching external problem without prematurely owning action responsibility", () => {
    const result = decide(
      snapshot({ playerX: 0, companionX: 1.5, hostileX: 4 }),
      danger("APPROACHING")
    );

    expect(result.focusId).toBe("hostile");
    expect(result.attention).toBe("TRACKING");
    expect(result.responsibility).toBe("NONE");
    expect(result.reasonCode).toBe("APPROACHING_MONITOR_ONLY");
  });

  it("owns responsibility during the same factual windup when material intervention is reachable", () => {
    const result = decide(
      snapshot({ playerX: 0, companionX: 1.1, hostileX: 0.7 }),
      danger("WINDUP", 20)
    );

    expect(result.evidence.playerAtMaterialRisk).toBe(true);
    expect(result.evidence.straightLineTicksToInterventionRange).toBe(0);
    expect(result.responsibility).toBe("OWNED");
    expect(result.reasonCode).toBe("INTERVENTION_REACHABLE_BEFORE_CONSEQUENCE");
  });

  it("does not own the same WINDUP when the companion cannot reach intervention range in time", () => {
    const result = decide(
      snapshot({ playerX: 0, companionX: 4, hostileX: 0.7 }),
      danger("WINDUP", 20)
    );

    expect(result.evidence.playerAtMaterialRisk).toBe(true);
    expect(result.evidence.straightLineTicksToInterventionRange).toBeGreaterThan(20);
    expect(result.responsibility).toBe("NONE");
    expect(result.reasonCode).toBe("INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE");
  });

  it("withdraws responsibility in WINDUP when player movement has already made the committed attack miss", () => {
    const result = decide(
      snapshot({ playerX: -1.5, companionX: 0.8, hostileX: 0 }),
      danger("WINDUP", 20)
    );

    expect(result.evidence.playerAtMaterialRisk).toBe(false);
    expect(result.attention).toBe("TRACKING");
    expect(result.responsibility).toBe("NONE");
    expect(result.reasonCode).toBe("PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE");
  });

  it("keeps attention but drops responsibility while the episode resolves", () => {
    const result = decide(
      snapshot({ playerX: 0, companionX: 0.8, hostileX: 0.6 }),
      danger("RECOVERING", 10)
    );

    expect(result.attention).toBe("TRACKING");
    expect(result.responsibility).toBe("NONE");
    expect(result.reasonCode).toBe("EPISODE_RESOLVING");
  });

  it("releases both focus and responsibility after completion", () => {
    const result = decide(
      snapshot({ playerX: 0, companionX: 0.8, hostileX: 0.6 }),
      danger("COMPLETE")
    );

    expect(result.focusId).toBeNull();
    expect(result.attention).toBe("NONE");
    expect(result.responsibility).toBe("NONE");
    expect(result.reasonCode).toBe("NO_ACTIVE_PROBLEM");
  });

  it("has no focus when the World exposes no shared-danger problem", () => {
    const result = decide(
      snapshot({ playerX: 0, companionX: 1, hostileX: 3 }),
      null
    );

    expect(result.focusId).toBeNull();
    expect(result.attention).toBe("NONE");
    expect(result.responsibility).toBe("NONE");
  });
});
