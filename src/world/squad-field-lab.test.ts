import { describe, expect, it } from "vitest";
import { LabWorld } from "./world";
import type { ExperimentalSquadMemberId, SquadMemberId, WorldSnapshot } from "./types";

const zero = { x: 0, y: 0 };

function body(snapshot: WorldSnapshot, id: SquadMemberId | "player") {
  const found = snapshot.actors.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing Field Lab body ${id}`);
  return found;
}

describe("Companion / Squad Field Lab physical substrate", () => {
  it("contains four real solid companion bodies without widening canonical ActorId", async () => {
    const world = await LabWorld.create("squad-field-lab");
    const snapshot = world.snapshot();

    for (const id of ["companion", "squad-2", "squad-3", "squad-4"] as const) {
      expect(body(snapshot, id).radius).toBeGreaterThan(0);
    }

    expect(snapshot.actors.map((entry) => entry.id)).toEqual([
      "companion",
      "player",
      "squad-2",
      "squad-3",
      "squad-4"
    ]);
    world.dispose();
  });

  it("moves additional squad bodies through the explicit experimental authority seam", async () => {
    const world = await LabWorld.create("squad-field-lab");
    const before = world.snapshot();

    const after = world.stepSituation({
      motionIntents: [
        { actorId: "player", move: zero },
        { actorId: "companion", move: zero }
      ],
      experimentalSquadMotionIntents: [
        { bodyId: "squad-2", move: { x: 1, y: 0 } },
        { bodyId: "squad-3", move: zero },
        { bodyId: "squad-4", move: zero }
      ]
    }).snapshot;

    expect(body(after, "squad-2").position.x).toBeGreaterThan(body(before, "squad-2").position.x);
    expect(body(after, "player").position).toEqual(body(before, "player").position);
    world.dispose();
  });

  it("keeps canonical companion motion and extra squad motion as distinct authorities", async () => {
    const world = await LabWorld.create("squad-field-lab");
    const before = world.snapshot();

    const after = world.stepSituation({
      motionIntents: [
        { actorId: "player", move: zero },
        { actorId: "companion", move: { x: -1, y: 0 } }
      ],
      experimentalSquadMotionIntents: [
        { bodyId: "squad-2", move: { x: 0, y: -1 } },
        { bodyId: "squad-3", move: { x: 0, y: 1 } },
        { bodyId: "squad-4", move: { x: 1, y: 0 } }
      ]
    }).snapshot;

    expect(body(after, "companion").position.x).toBeLessThan(body(before, "companion").position.x);
    expect(body(after, "squad-2").position.y).toBeLessThan(body(before, "squad-2").position.y);
    expect(body(after, "squad-3").position.y).toBeGreaterThan(body(before, "squad-3").position.y);
    expect(body(after, "squad-4").position.x).toBeGreaterThan(body(before, "squad-4").position.x);
    world.dispose();
  });

  it("rejects experimental squad authority outside the isolated Field Lab fixture", async () => {
    const world = await LabWorld.create("open");
    const before = world.snapshot();

    expect(() =>
      world.stepSituation({
        motionIntents: [
          { actorId: "player", move: zero },
          { actorId: "companion", move: zero }
        ],
        experimentalSquadMotionIntents: [
          { bodyId: "squad-2" as ExperimentalSquadMemberId, move: { x: 1, y: 0 } }
        ]
      })
    ).toThrow(/confined to the squad-field-lab/);

    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("exposes real companion-companion collision instead of UI-only roster membership", async () => {
    const world = await LabWorld.create("squad-field-lab");
    let snapshot = world.snapshot();

    // Drive squad-2 toward the canonical companion while keeping every other
    // body still. The members must negotiate real Rapier contact.
    for (let step = 0; step < 90; step += 1) {
      snapshot = world.stepSituation({
        motionIntents: [
          { actorId: "player", move: zero },
          { actorId: "companion", move: zero }
        ],
        experimentalSquadMotionIntents: [
          { bodyId: "squad-2", move: { x: 0, y: 1 } },
          { bodyId: "squad-3", move: zero },
          { bodyId: "squad-4", move: zero }
        ]
      }).snapshot;
    }

    const extra = body(snapshot, "squad-2");
    expect(extra.contacts.some((contact) => contact.with === "companion")).toBe(true);
    expect(extra.motionError).toBeGreaterThan(0.1);
    world.dispose();
  });
});
