import { describe, expect, it } from "vitest";
import { FieldLabSquadControl } from "../squad/field-lab-squad-control";
import {
  captureCompanionLivedMoment,
  installCompanionJaskiniaLivedMoment,
  trustedJaskiniaOrigin
} from "./companion-jaskinia-lived-moment";
import type { WorldSnapshot } from "../world/types";

function sample(tick: number) {
  const world: WorldSnapshot = {
    tick, scenarioId: "squad-field-lab-combat-micro", width: 16, height: 10,
    obstacles: [],
    actors: [
      { id: "player", radius: 0.3, position: { x: 3, y: 5 },
        requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0.1, y: 0 },
        motionError: 0, contacts: [] },
      { id: "companion", radius: 0.3, position: { x: 4.6, y: 5 },
        requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 },
        motionError: 0, contacts: [{ with: "player", contactCount: 2 }] }
    ]
  };
  return captureCompanionLivedMoment({
    sourceSha: "test-sha", world, control: new FieldLabSquadControl().snapshot(),
    situation: "COMBAT_MICRO", layout: "MIXED", paused: false, combat: null, trial: null
  });
}

describe("Companion lived moment: bounded witness, not World authority", () => {
  it("captured state describes actual bodies, authority and a non-replayable source claim", () => {
    const moment = sample(19);
    expect(moment.world.tick).toBe(19);
    expect(moment.bodies.map(b => [b.id, b.x, b.y])).toEqual([
      ["player", 3, 5], ["companion", 4.6, 5]
    ]);
    expect(moment.bodies[1]?.contacts).toBe(2);
    expect(moment.restorable).toBe(false);
    expect(moment.sourceReported).toBe(true);
    expect(moment.authority.focused).toBe("companion");
  });

  it("accepts known Jaskinia only, not a merely same-origin different project", () => {
    expect(trustedJaskiniaOrigin("https://jozzpoly.github.io/Jozz-Cave-Workbench/#foo"))
      .toBe("https://jozzpoly.github.io");
    expect(trustedJaskiniaOrigin("https://jozzpoly.github.io/Companion-Brain-Lab/")).toBeNull();
    expect(trustedJaskiniaOrigin("https://evil.test/Jozz-Cave-Workbench/")).toBeNull();
    expect(trustedJaskiniaOrigin("javascript:alert(1)")).toBeNull();
    expect(trustedJaskiniaOrigin("http://127.0.0.1:8765/jaskinia.html")).toBe("http://127.0.0.1:8765");
  });

  it("pins a requested real tick to Owner feedback while rejecting unrelated frames and origins", () => {
    const sent: { data: any; origin: string }[] = [];
    const parent = { postMessage(data: unknown, origin: string) { sent.push({ data, origin }); } };
    let incoming: ((event: {source: unknown;origin: string;data: unknown}) => void) | null = null;
    let period: (() => void) | null = null;
    let stopped = false;
    let tick = 5;
    const remarks: { text: string; tick: number | null }[] = [];
    const stop = installCompanionJaskiniaLivedMoment({
      host: {
        parent, self: {},
        referrer: "https://jozzpoly.github.io/Jozz-Cave-Workbench/#agenci",
        listen(handler) { incoming = handler; return () => { incoming = null; }; },
        every(handler) { period = handler; return () => { stopped = true; }; }
      },
      read: () => sample(tick),
      onRemark: remark => remarks.push({
        text: remark.text,
        tick: remark.anchoredMoment?.world.tick ?? null
      })
    });
    expect(sent.map(x => x.data.type)).toEqual(["hello"]);
    const receive = (source: unknown, origin: string, data: unknown) => {
      if (!incoming) throw Error("no listener");
      incoming({ source, origin, data });
    };
    receive({}, "https://jozzpoly.github.io", {jaskinia: 1, type: "hi"});
    receive(parent, "https://attacker.example", {jaskinia: 1, type: "hi"});
    expect(sent).toHaveLength(1);
    receive(parent, "https://jozzpoly.github.io", {jaskinia: 1, type: "hi"});
    expect(sent.map(x => x.data.type)).toEqual(["hello", "hello", "state", "signals"]);
    expect(sent[2]?.data.data.world.tick).toBe(5);
    expect(sent[2]?.origin).toBe("https://jozzpoly.github.io");
    tick = 21;
    receive(parent, "https://jozzpoly.github.io", {jaskinia: 1, type: "state?"});
    expect(sent.at(-2)?.data.data.world.tick).toBe(21);
    tick = 28;
    receive(parent, "https://jozzpoly.github.io",
      {jaskinia: 1, type: "remark", text: "He should have covered me", at: "now"});
    expect(remarks).toEqual([{text:"He should have covered me", tick:21}]);
    if (period) period();
    expect(sent.at(-2)?.data.data.world.tick).toBe(28);
    stop();
    expect(stopped).toBe(true);
    expect(incoming).toBeNull();
  });

  it("keeps the lab standalone and ignores other embedding sites", () => {
    let sendCount = 0;
    const parent = { postMessage() { sendCount++; } };
    const stop = installCompanionJaskiniaLivedMoment({
      host: {
        parent, self: {},
        referrer: "https://other.site/jaskinia.html",
        listen() { throw Error("should not listen"); },
        every() { throw Error("should not poll"); }
      },
      read: () => sample(0)
    });
    stop();
    expect(sendCount).toBe(0);
  });
});
