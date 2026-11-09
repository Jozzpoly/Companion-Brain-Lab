import { describe, expect, it } from "vitest";
import { FieldLabSquadControl } from "../squad/field-lab-squad-control";
import { squadFieldLabScenario } from "../world/scenarios";
import { LabWorld, COMBAT_MICRO_RULES } from "../world/world";
import type { WorldSnapshot } from "../world/types";
import { CompanionCoverProbe, realizeCoverMotion } from "./companion-cover-probe";

const zero = { x: 0, y: 0 } as const;
const find = (snapshot: WorldSnapshot, id: string) => {
  const actor = snapshot.actors.find(a => a.id === id);
  if (!actor) throw new Error("missing actual World body " + id);
  return actor;
};

async function runPhysicalCase(armed: boolean, ticks = 560) {
  // SAME authored start, physics, engine, World contract; only C1's live
  // permission differs. A test-only fake Hostile is expressly forbidden.
  const world = await LabWorld.createFromSpec(
    squadFieldLabScenario(["companion"], "COMBAT_MICRO", "OPEN")
  );
  const control = new FieldLabSquadControl();
  control.setActiveCount(1);
  const cover = new CompanionCoverProbe();
  cover.setEnabled(armed);
  let sawPressureOnPlayer = false;
  let sawWorldStrike = false;
  let firstTransferTick: number | null = null;
  let last = world.snapshot();
  let previous = world.combatMicro();
  try {
    for (let t = 0; t < ticks; t++) {
      const currentControl = control.snapshot();
      const decision = cover.step({
        world: last, combat: previous, control: currentControl,
        situation: "COMBAT_MICRO", layout: "OPEN",
        strikeRange: COMBAT_MICRO_RULES.strikeRange
      });
      const motor = realizeCoverMotion(
        decision, find(last, "companion").position,
        control.effectiveDynamicsFor("companion")
      ) ?? zero;
      const result = world.stepSituation({
        motionIntents: [
          {actorId: "player", move: zero},
          {actorId: "companion", move: motor}
        ],
        combatMicroAttempts: decision.strike
          ? [{actorId: "companion", kind: "STRIKE", targetId: "hostile"}]
          : []
      });
      sawPressureOnPlayer ||= previous?.phase === "PRESSURING" &&
        previous.targetActorId === "player";
      sawWorldStrike ||= result.combatMicroActionOutcomes.some(outcome =>
        outcome.actorId === "companion" && outcome.status === "SUCCEEDED"
      );
      if (result.combatMicro?.targetActorId === "companion" && firstTransferTick === null) {
        firstTransferTick = result.snapshot.tick;
      }
      last = result.snapshot;
      previous = result.combatMicro;
    }
    return {
      lastTick: last.tick,
      sawPressureOnPlayer,
      sawWorldStrike,
      firstTransferTick,
      playerHits: previous?.actorHitCounts.player ?? -1,
      companionHits: previous?.actorHitCounts.companion ?? -1,
      hostileHP: previous?.hostileHealth ?? -1,
      history: previous?.successfulStrikeHistory ?? [],
      bearer: previous?.targetActorId
    };
  } finally {
    world.dispose();
  }
}

describe("Live C1 cover — an actual but deliberately bounded World authority", () => {
  it("with identical World input, COVER acts while OFF does not; action materially transfers enemy pressure", async () => {
    const baseline = await runPhysicalCase(false);
    const covered = await runPhysicalCase(true);
    expect(baseline.sawPressureOnPlayer).toBe(true);
    expect(baseline.history).toEqual([]);
    expect(baseline.sawWorldStrike).toBe(false);
    expect(baseline.playerHits).toBeGreaterThanOrEqual(1);
    expect(covered.sawPressureOnPlayer).toBe(true);
    expect(covered.sawWorldStrike).toBe(true);
    expect(covered.firstTransferTick).toBeGreaterThan(0);
    expect(covered.history).toContain("companion");
    expect(covered.hostileHP).toBeLessThan(baseline.hostileHP);
    expect(covered.playerHits).toBeLessThan(baseline.playerHits);
    // C1's intervention changes which physical actor takes future risk.
    expect(covered.bearer).toBe("companion");
  });

  it("yields to direct C1 control without an autonomous motion or STRIKE", async () => {
    const world = await LabWorld.createFromSpec(
      squadFieldLabScenario(["companion"], "COMBAT_MICRO", "OPEN")
    );
    try {
      const control = new FieldLabSquadControl();
      control.setActiveCount(1);
      control.setDirectControl(true);
      const cover = new CompanionCoverProbe();
      cover.setEnabled(true);
      const decision = cover.step({
        world: world.snapshot(), combat: world.combatMicro(),
        control: control.snapshot(), situation: "COMBAT_MICRO", layout: "OPEN",
        strikeRange: COMBAT_MICRO_RULES.strikeRange
      });
      expect(decision.reason).toBe("YIELD_DIRECT_CONTROL");
      expect(decision.moveTarget).toBeNull();
      expect(decision.strike).toBe(false);
      expect(decision.readyTicks).toBe(0);
    } finally { world.dispose(); }
  });

  it("yields to an explicit HOLD order even when COVER remains armed", async () => {
    const world = await LabWorld.createFromSpec(
      squadFieldLabScenario(["companion"], "COMBAT_MICRO", "OPEN")
    );
    try {
      const control = new FieldLabSquadControl();
      control.setActiveCount(1);
      control.issueSelected("HOLD", { x: 4.6, y: 5 });
      const cover = new CompanionCoverProbe();
      cover.setEnabled(true);
      const decision = cover.step({
        world: world.snapshot(), combat: world.combatMicro(),
        control: control.snapshot(), situation: "COMBAT_MICRO", layout: "OPEN",
        strikeRange: COMBAT_MICRO_RULES.strikeRange
      });
      expect(decision.reason).toBe("YIELD_PLAYER_ORDER");
      expect(decision.moveTarget).toBeNull();
      expect(decision.strike).toBe(false);
    } finally { world.dispose(); }
  });

  it("does not claim sensing through pillars, a new World, or hidden timing", async () => {
    const world = await LabWorld.createFromSpec(
      squadFieldLabScenario(["companion"], "COMBAT_MICRO", "PILLAR")
    );
    try {
      const control = new FieldLabSquadControl();
      control.setActiveCount(1);
      const cover = new CompanionCoverProbe();
      cover.setEnabled(true);
      const decision = cover.step({
        world: world.snapshot(), combat: world.combatMicro(),
        control: control.snapshot(), situation: "COMBAT_MICRO", layout: "PILLAR",
        strikeRange: COMBAT_MICRO_RULES.strikeRange
      });
      expect(decision.reason).toBe("OUTSIDE_LIVE_PROBE");
      expect(decision.moveTarget).toBeNull();
      expect(decision.strike).toBe(false);
      cover.worldReconstructed();
      expect(cover.snapshot.readyTicks).toBe(0);
    } finally { world.dispose(); }
  });
});
