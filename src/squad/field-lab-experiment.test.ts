import { describe, expect, it } from "vitest";
import { FieldLabSquadControl } from "./field-lab-squad-control";
import {
  createFieldLabExperiment,
  decodeFieldLabExperiment,
  diffFieldLabExperiments,
  encodeFieldLabExperiment,
  fieldLabExperimentStorageKey,
  renameFieldLabExperiment
} from "./field-lab-experiment";

function sample(label = "baseline") {
  const control = new FieldLabSquadControl();
  control.setActiveCount(3);
  control.selectOnly("squad-2");
  control.toggleSelected("squad-3");
  control.focus("squad-3");
  control.setDirectControl(true);
  control.issueSelected("MOVE", { x: 8.25, y: 6.5 });
  control.applyFormationPreset("COLUMN");
  control.setSlotOffset("squad-2", { x: -1.2, y: 0.75 });
  control.setSpacingScale(1.7);
  control.setSlotTolerance(0.35);
  control.setResponsiveness(0.55);
  control.setSlowdownRadius(1.4);
  control.setSelectedDynamicsOverride("responsiveness", 0.35);
  control.setSelectedDynamicsOverride("slowdownRadius", 2.2);
  control.setOrientationRadians(0.7);

  return createFieldLabExperiment({
    label,
    capturedAtTick: 321,
    situation: "PRESSURE",
    layout: "DOORWAY",
    control: control.snapshot(),
    positions: {
      player: { x: 2.4, y: 4.5 },
      squad: {
        companion: { x: 3.8, y: 4.4 },
        "squad-2": { x: 4.1, y: 3.2 },
        "squad-3": { x: 4.25, y: 5.7 }
      }
    }
  });
}

describe("Field Lab experiment state", () => {
  it("round-trips a complete authored setup through versioned JSON", () => {
    const before = sample();
    const after = decodeFieldLabExperiment(encodeFieldLabExperiment(before));
    expect(after).toEqual(before);
  });

  it("rejects stale or structurally invalid experiment records", () => {
    const record = sample();
    expect(() => decodeFieldLabExperiment(JSON.stringify({ ...record, schema: "old" })))
      .toThrow(/Unsupported Field Lab experiment schema/);

    const invalid = {
      ...record,
      setup: {
        ...record.setup,
        control: {
          ...record.setup.control,
          selected: ["squad-4"]
        }
      }
    };
    expect(() => decodeFieldLabExperiment(JSON.stringify(invalid)))
      .toThrow(/selection must contain unique active members/);
  });

  it("keeps labels as metadata without changing experiment equivalence", () => {
    const a = sample("doorway baseline");
    const b = renameFieldLabExperiment(a, "doorway variant");
    expect(b.label).toBe("doorway variant");
    expect(diffFieldLabExperiments(a, b).equal).toBe(true);
  });

  it("produces causal A/B differences across formation, dynamics, orders and positions", () => {
    const a = sample("A");
    const control = new FieldLabSquadControl();
    control.restore(a.setup.control);
    control.setSpacingScale(0.8);
    control.setResponsiveness(0.9);
    control.setSlowdownRadius(0.45);
    control.setSelectedDynamicsOverride("slotTolerance", 0.48);
    control.selectOnly("squad-3");
    control.setSelectedDynamicsOverride("responsiveness", 0.48);
    control.setSlotOffset("squad-2", { x: 2.2, y: -0.4 });
    control.selectOnly("squad-2");
    control.issueSelected("FOLLOW");

    const b = createFieldLabExperiment({
      label: "B",
      capturedAtTick: 999,
      situation: "TRAINING",
      layout: "PILLAR",
      control: control.snapshot(),
      positions: {
        player: { x: 2.4, y: 4.5 },
        squad: {
          companion: { x: 4.6, y: 5.1 },
          "squad-2": { x: 5.0, y: 3.9 },
          "squad-3": { x: 4.25, y: 5.7 }
        }
      }
    });

    const diff = diffFieldLabExperiments(a, b);
    expect(diff.equal).toBe(false);
    expect(diff.categories).toEqual(expect.arrayContaining([
      "SITUATION",
      "FORMATION",
      "ORDERS",
      "DYNAMICS",
      "POSITIONS"
    ]));
    expect(diff.differences.some((entry) => entry.path === "spacingScale")).toBe(true);
    expect(diff.differences.some((entry) =>
      entry.path === "memberDynamics.squad-2.slotTolerance"
    )).toBe(true);
    expect(diff.differences.some((entry) =>
      entry.path === "memberDynamics.squad-3.responsiveness"
    )).toBe(true);
    expect(diff.differences.some((entry) => entry.path === "slots.squad-2")).toBe(true);
    expect(diff.differences.some((entry) => entry.path === "positions.squad-2")).toBe(true);
  });

  it("uses stable versioned browser persistence keys", () => {
    expect(fieldLabExperimentStorageKey("A")).toBe("companion-brain-lab.field-lab.experiment.A.v1");
    expect(fieldLabExperimentStorageKey("B")).toBe("companion-brain-lab.field-lab.experiment.B.v1");
  });
});
