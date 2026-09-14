import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { ProgressRecoveryMonitor } from "./progress-recovery";

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("behavior-forensics: recovery causal attribution", () => {
  it("can classify player-pushed zero-command body motion as PROGRESSING", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "external progress attribution",
      width: 20,
      height: 8,
      actors: [
        { id: "player", position: { x: 4, y: 4 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 4.65, y: 4 }, radius: 0.3, speed: 3 }
      ],
      obstacles: []
    };
    const physical = await RapierPhysicalWorld.create(spec);
    const monitor = new ProgressRecoveryMonitor();
    const target = { x: 9, y: 4 };
    let tick = 0;
    let snapshot: WorldSnapshot = {
      tick,
      scenarioId: "open",
      width: spec.width,
      height: spec.height,
      actors: physical.snapshot(),
      obstacles: []
    };
    const initialCompanionX = actor(snapshot, "companion").position.x;
    let sawPlayerContact = false;
    let sawProgressingWithZeroCommand = false;
    let firstProgressing: null | {
      tick: number;
      position: Vec2;
      actualSpeed: number;
      contacts: string[];
      progressDelta: number;
    } = null;

    try {
      for (let step = 0; step < 80; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: 1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = {
          tick,
          scenarioId: "open",
          width: spec.width,
          height: spec.height,
          actors,
          obstacles: []
        };
        const companion = actor(snapshot, "companion");
        const contacts = companion.contacts.map((entry) => entry.with);
        sawPlayerContact ||= contacts.includes("player");
        const decision = monitor.observe({
          tick,
          objectiveKey: "external-push:stable-target",
          position: companion.position,
          target,
          routeStatus: "direct",
          routeRemainingDistance: distance(companion.position, target),
          commandedSpeed: 0,
          actualSpeed: magnitude(companion.actualVelocity),
          contacts,
          intentionalHoldReason: null
        });

        if (decision.state === "PROGRESSING") {
          sawProgressingWithZeroCommand = true;
          firstProgressing ??= {
            tick,
            position: { ...companion.position },
            actualSpeed: magnitude(companion.actualVelocity),
            contacts: [...contacts],
            progressDelta: decision.progressDelta
          };
        }
      }

      const finalCompanion = actor(snapshot, "companion");
      console.info("EXTERNAL_PROGRESS_ATTRIBUTION", JSON.stringify({
        initialCompanionX,
        finalCompanionX: finalCompanion.position.x,
        displacement: finalCompanion.position.x - initialCompanionX,
        sawPlayerContact,
        sawProgressingWithZeroCommand,
        firstProgressing
      }));

      expect(sawPlayerContact).toBe(true);
      expect(finalCompanion.position.x - initialCompanionX).toBeGreaterThan(0.06);
      expect(sawProgressingWithZeroCommand).toBe(true);
      expect(firstProgressing?.progressDelta ?? 0).toBeGreaterThanOrEqual(0.06);
    } finally {
      physical.dispose();
    }
  });
});