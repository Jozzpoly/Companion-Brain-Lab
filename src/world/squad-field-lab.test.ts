import { describe, expect, it } from "vitest";
import { LabWorld } from "./world";
import { squadFieldLabScenario } from "./scenarios";
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

  it("rebuilds a genuinely smaller physical roster instead of hiding unused companions", async () => {
    const world = await LabWorld.createFromSpec(
      squadFieldLabScenario(["companion", "squad-2"])
    );
    const ids = world.snapshot().actors.map((entry) => entry.id);
    expect(ids).toEqual(["companion", "player", "squad-2"]);
    expect(ids).not.toContain("squad-3");
    expect(ids).not.toContain("squad-4");
    world.dispose();
  });

  it("can rebuild a different layout from the same authored body positions", async () => {
    const spawns = {
      player: { x: 2.4, y: 7.1 },
      squad: {
        companion: { x: 3.6, y: 7.1 },
        "squad-2": { x: 4.2, y: 7.6 }
      }
    } as const;

    const open = await LabWorld.createFromSpec(
      squadFieldLabScenario(["companion", "squad-2"], "TRAINING", "OPEN", spawns)
    );
    const doorway = await LabWorld.createFromSpec(
      squadFieldLabScenario(["companion", "squad-2"], "TRAINING", "DOORWAY", spawns)
    );

    for (const snapshot of [open.snapshot(), doorway.snapshot()]) {
      expect(body(snapshot, "player").position.x).toBeCloseTo(spawns.player.x, 5);
      expect(body(snapshot, "player").position.y).toBeCloseTo(spawns.player.y, 5);
      expect(body(snapshot, "squad-2").position.x).toBeCloseTo(spawns.squad["squad-2"].x, 5);
      expect(body(snapshot, "squad-2").position.y).toBeCloseTo(spawns.squad["squad-2"].y, 5);
    }
    expect(open.snapshot().obstacles).toHaveLength(0);
    expect(doorway.snapshot().obstacles).toHaveLength(2);

    open.dispose();
    doorway.dispose();
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
    ).toThrow(/confined to Squad Field Lab scenarios/);

    expect(world.snapshot()).toEqual(before);
    world.dispose();
  });

  it("exposes real companion-companion collision instead of UI-only roster membership", async () => {
    const world = await LabWorld.create("squad-field-lab");
    let sawContact = false;
    let maxMotionError = 0;

    // Drive squad-2 through the canonical companion's occupied space while
    // keeping every other body still. Contact is a temporal event: the test
    // records whether Rapier materially constrained the traversal at any point,
    // rather than incorrectly requiring both bodies to still touch at the final tick.
    for (let step = 0; step < 90; step += 1) {
      const snapshot = world.stepSituation({
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
      const extra = body(snapshot, "squad-2");
      sawContact ||= extra.contacts.some((contact) => contact.with === "companion");
      maxMotionError = Math.max(maxMotionError, extra.motionError);
    }

    expect(sawContact).toBe(true);
    expect(maxMotionError).toBeGreaterThan(0.1);
    world.dispose();
  });
});
