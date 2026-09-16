import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { evaluateShadowPlayerCorridor } from "./shadow-player-corridor";
import { evaluateShadowPlayerFlowConflict } from "./shadow-player-flow-conflict";

type Phase = "APPROACH" | "CONTACT_PUSH" | "WITHDRAW" | "QUIET_CLEAR";
type ConflictState = ReturnType<typeof evaluateShadowPlayerFlowConflict>["state"];

interface TraceRow {
  tick: number;
  phase: Phase;
  contact: boolean;
  corridorState: ReturnType<typeof evaluateShadowPlayerCorridor>["state"];
  corridorVelocitySource: ReturnType<typeof evaluateShadowPlayerCorridor>["velocitySource"];
  conflictState: ConflictState;
  physicalClearance: number | null;
  comfortClearance: number | null;
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`Conflict persistence audit missing ${id}.`);
  return value;
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function commandVelocity(move: Vec2, maxSpeed: number): Vec2 {
  const length = magnitude(move);
  const scale = length > 1 ? 1 / length : 1;
  return { x: move.x * scale * maxSpeed, y: move.y * scale * maxSpeed };
}

function hasContact(snapshot: WorldSnapshot): boolean {
  return actor(snapshot, "player").contacts.some((contact) => contact.with === "companion") &&
    actor(snapshot, "companion").contacts.some((contact) => contact.with === "player");
}

function activeConflict(state: ConflictState): boolean {
  return state === "PHYSICAL_CONFLICT" || state === "COMFORT_CONFLICT";
}

describe("A1 conflict-evidence persistence necessity audit", () => {
  it("measures whether current physical/trajectory evidence itself chatters across one real conflict lifecycle", async () => {
    const world = await LabWorld.create("head-on");
    let snapshot = world.snapshot();
    const playerCapability = world.actorMovementCapability("player");
    const companionCapability = world.actorMovementCapability("companion");
    let previousDirection: Vec2 | null = null;
    let previousDirectionTick: number | null = null;
    const trace: TraceRow[] = [];

    const sample = (phase: Phase, companionMove: Vec2): void => {
      const corridor = evaluateShadowPlayerCorridor({
        snapshot,
        previousDirection,
        previousDirectionAgeTicks: previousDirectionTick === null ? null : snapshot.tick - previousDirectionTick
      });
      if (corridor.velocitySource !== "stationary" && magnitude(corridor.direction) > 0.5) {
        previousDirection = { ...corridor.direction };
        previousDirectionTick = snapshot.tick;
      }
      const conflict = evaluateShadowPlayerFlowConflict({
        snapshot,
        corridor,
        companionVelocity: commandVelocity(companionMove, companionCapability.maxSpeed),
        velocitySource: "authoritative-command"
      });
      trace.push({
        tick: snapshot.tick,
        phase,
        contact: hasContact(snapshot),
        corridorState: corridor.state,
        corridorVelocitySource: corridor.velocitySource,
        conflictState: conflict.state,
        physicalClearance: conflict.physicalClearance,
        comfortClearance: conflict.comfortClearance
      });
    };

    try {
      const approachPlayer = { x: 1, y: 0 };
      const approachCompanion = { x: -1, y: 0 };
      let reachedContact = false;

      for (let step = 0; step < 90; step += 1) {
        sample("APPROACH", approachCompanion);
        snapshot = world.step([
          motion("player", approachPlayer),
          motion("companion", approachCompanion)
        ]);
        if (hasContact(snapshot)) {
          reachedContact = true;
          sample("CONTACT_PUSH", approachCompanion);
          break;
        }
      }
      expect(reachedContact).toBe(true);

      for (let step = 0; step < 12; step += 1) {
        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
        sample("CONTACT_PUSH", { x: -1, y: 0 });
      }

      let cleared = false;
      for (let step = 0; step < 24; step += 1) {
        sample("WITHDRAW", { x: 1, y: 0 });
        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 1, y: 0 })
        ]);
        if (!hasContact(snapshot)) {
          sample("WITHDRAW", { x: 1, y: 0 });
          cleared = true;
          break;
        }
      }
      expect(cleared).toBe(true);

      for (let step = 0; step < 8; step += 1) {
        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 0, y: 0 })
        ]);
        sample("QUIET_CLEAR", { x: 0, y: 0 });
      }

      let activeTransitions = 0;
      let activeEpisodes = 0;
      let previousActive = activeConflict(trace[0]?.conflictState ?? "UNAVAILABLE");
      if (previousActive) activeEpisodes = 1;
      for (const row of trace.slice(1)) {
        const currentActive = activeConflict(row.conflictState);
        if (currentActive !== previousActive) {
          activeTransitions += 1;
          if (currentActive) activeEpisodes += 1;
        }
        previousActive = currentActive;
      }

      const stateTransitions = trace.slice(1).reduce((count, row, index) =>
        count + (row.conflictState === trace[index]!.conflictState ? 0 : 1), 0);
      const firstActive = trace.find((row) => activeConflict(row.conflictState)) ?? null;
      const lastActive = [...trace].reverse().find((row) => activeConflict(row.conflictState)) ?? null;
      const firstContact = trace.find((row) => row.contact) ?? null;
      const firstClearAfterContact = firstContact
        ? trace.find((row) => row.tick >= firstContact.tick && !row.contact) ?? null
        : null;

      console.info("[A1_CONFLICT_EVIDENCE_PERSISTENCE_NECESSITY]", JSON.stringify({
        trace,
        summary: {
          sampleCount: trace.length,
          activeTransitions,
          activeEpisodes,
          stateTransitions,
          firstActiveTick: firstActive?.tick ?? null,
          lastActiveTick: lastActive?.tick ?? null,
          firstContactTick: firstContact?.tick ?? null,
          firstPhysicalClearTick: firstClearAfterContact?.tick ?? null,
          finalConflictState: trace.at(-1)?.conflictState ?? null,
          finalPhysicalClearance: trace.at(-1)?.physicalClearance ?? null,
          finalComfortClearance: trace.at(-1)?.comfortClearance ?? null,
          statelessConflictEvidenceChatterObserved: activeEpisodes > 1 || activeTransitions > 2
        },
        interpretationBoundary: {
          thisAuditDoesNotCreateYieldPolicy: true,
          thisAuditDoesNotAssumePersistentCommitmentIsNecessary: true,
          persistenceIsJustifiedOnlyIfEvidenceOrBehaviorNeedsIt: true
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));

      expect(trace.some((row) => row.conflictState === "PHYSICAL_CONFLICT")).toBe(true);
      expect(trace.some((row) => row.phase === "APPROACH" && row.conflictState === "CLEAR")).toBe(true);
      expect(trace.some((row) => row.phase === "QUIET_CLEAR" && row.conflictState === "CLEAR")).toBe(true);
    } finally {
      world.dispose();
    }
  });
});
