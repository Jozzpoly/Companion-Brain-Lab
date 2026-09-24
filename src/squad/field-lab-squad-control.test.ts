import { describe, expect, it } from "vitest";
import {
  FIELD_LAB_SQUAD_MEMBERS,
  FieldLabSquadControl
} from "./field-lab-squad-control";

describe("FieldLabSquadControl", () => {
  it("starts with one focused companion but retains four editable real-member slots", () => {
    const control = new FieldLabSquadControl();
    const state = control.snapshot();
    expect(state.activeMembers).toEqual(["companion", "squad-2", "squad-3", "squad-4"]);
    expect(state.selected).toEqual(["companion"]);
    expect(state.focused).toBe("companion");
    expect(state.slots.map((slot) => slot.memberId)).toEqual(FIELD_LAB_SQUAD_MEMBERS);
    expect(state.assignments.every((assignment) => assignment.mode === "FOLLOW")).toBe(true);
    expect(state.dynamics).toEqual({
      spacingScale: 1,
      slotTolerance: 0.18,
      responsiveness: 0.82,
      slowdownRadius: 0.72
    });
    expect(state.memberDynamics.every((entry) =>
      entry.slotTolerance === null &&
      entry.responsiveness === null &&
      entry.slowdownRadius === null
    )).toBe(true);
  });

  it("deploys a bounded 1-4 roster and repairs selection/focus when members leave", () => {
    const control = new FieldLabSquadControl();
    control.selectOnly("squad-4");
    control.setDirectControl(true);
    const two = control.setActiveCount(2);

    expect(two.activeMembers).toEqual(["companion", "squad-2"]);
    expect(two.selected).toEqual(["companion"]);
    expect(two.focused).toBe("companion");
    expect(() => control.focus("squad-4")).toThrow(/Inactive Field Lab squad member/);

    const four = control.setActiveCount(4);
    expect(four.activeMembers).toHaveLength(4);
    expect(four.directControl).toBe(true);
  });

  it("supports additive selection and independent focus without losing group selection", () => {
    const control = new FieldLabSquadControl();
    control.toggleSelected("squad-2");
    control.toggleSelected("squad-3");
    control.focus("squad-2");
    expect(control.snapshot().selected).toEqual(["companion", "squad-2", "squad-3"]);
    expect(control.snapshot().focused).toBe("squad-2");

    control.cycleFocus(1);
    expect(control.snapshot().focused).toBe("squad-3");
  });

  it("keeps direct puppeteering scoped to the focused member", () => {
    const control = new FieldLabSquadControl();
    control.selectAll();
    control.focus("squad-3");
    control.setDirectControl(true);

    expect(control.targetFor("squad-3", { x: 3, y: 5 }).authority).toBe("DIRECT");
    expect(control.targetFor("squad-3", { x: 3, y: 5 }).target).toBeNull();
    expect(control.targetFor("squad-2", { x: 3, y: 5 }).authority).toBe("FORMATION");
    expect(control.targetFor("squad-2", { x: 3, y: 5 }).target).not.toBeNull();
  });

  it("applies FOLLOW/HOLD/MOVE only to the current selection", () => {
    const control = new FieldLabSquadControl();
    control.selectOnly("squad-2");
    control.toggleSelected("squad-3");
    control.issueSelected("HOLD", { x: 8, y: 4 });

    expect(control.assignmentFor("companion").mode).toBe("FOLLOW");
    expect(control.assignmentFor("squad-2")).toEqual({
      memberId: "squad-2",
      mode: "HOLD",
      worldAnchor: { x: 8, y: 4 }
    });
    expect(control.assignmentFor("squad-3").mode).toBe("HOLD");
    expect(control.assignmentFor("squad-4").mode).toBe("FOLLOW");
  });

  it("represents formations as editable local geometry rather than preset enums", () => {
    const control = new FieldLabSquadControl();
    control.setSlotOffset("squad-2", { x: -2, y: -0.25 });
    control.setSpacingScale(1.5);
    control.setOrientationRadians(Math.PI / 2);

    const target = control.targetFor("squad-2", { x: 10, y: 10 });
    expect(target.localSlot).toEqual({ x: -2, y: -0.25 });
    expect(target.target?.x).toBeCloseTo(10.375, 6);
    expect(target.target?.y).toBeCloseTo(7, 6);
  });

  it("lets one selected subset hold a world formation while another keeps following the player", () => {
    const control = new FieldLabSquadControl();
    control.selectOnly("squad-2");
    control.issueSelected("HOLD", { x: 8, y: 4 });

    const follower = control.targetFor("companion", { x: 2, y: 3 });
    const held = control.targetFor("squad-2", { x: 100, y: 100 });

    expect(follower.orderMode).toBe("FOLLOW");
    expect(follower.worldAnchor).toEqual({ x: 2, y: 3 });
    expect(held.orderMode).toBe("HOLD");
    expect(held.worldAnchor).toEqual({ x: 8, y: 4 });
  });

  it("treats formation presets as generators whose slots remain freely editable", () => {
    const control = new FieldLabSquadControl();
    control.applyFormationPreset("WEDGE");
    const generated = control.snapshot().slots.find((slot) => slot.memberId === "squad-4");
    expect(generated?.offset).toEqual({ x: 2.25, y: 1.35 });

    control.setSlotOffset("squad-4", { x: -3.4, y: 0.2 });
    const edited = control.snapshot().slots.find((slot) => slot.memberId === "squad-4");
    expect(edited?.offset).toEqual({ x: -3.4, y: 0.2 });
  });

  it("restores a complete validated control snapshot after unrelated perturbations", () => {
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
    const captured = control.snapshot();

    control.setActiveCount(1);
    control.selectOnly("companion");
    control.setDirectControl(false);
    control.issueSelected("FOLLOW");
    control.applyFormationPreset("WEDGE");
    control.setSpacingScale(0.6);
    control.setSlotTolerance(0.1);
    control.setResponsiveness(0.95);
    control.setSlowdownRadius(0.25);
    control.clearSelectedDynamicsOverrides();
    control.setOrientationRadians(-1.1);

    expect(control.restore(captured)).toEqual(captured);
    expect(control.snapshot()).toEqual(captured);
  });

  it("fails closed when a restored snapshot violates roster or focus invariants", () => {
    const control = new FieldLabSquadControl();
    const captured = control.snapshot();

    expect(() => control.restore({
      ...captured,
      activeMembers: ["companion", "squad-3"]
    })).toThrow(/canonical 1-4 roster prefix/);

    expect(() => control.restore({
      ...captured,
      selected: ["squad-2"],
      focused: "companion"
    })).toThrow(/focus must belong/);
  });

  it("rejects out-of-range dynamics instead of silently clamping authored values", () => {
    const control = new FieldLabSquadControl();

    expect(() => control.setSpacingScale(99)).toThrow(/within/);
    expect(() => control.setSlotTolerance(-10)).toThrow(/within/);
    expect(() => control.setResponsiveness(2)).toThrow(/within/);
    expect(() => control.setSlowdownRadius(0)).toThrow(/within/);

    expect(control.snapshot().dynamics).toEqual({
      spacingScale: 1,
      slotTolerance: 0.18,
      responsiveness: 0.82,
      slowdownRadius: 0.72
    });
  });

  it("applies selection-scoped dynamics overrides without changing group defaults", () => {
    const control = new FieldLabSquadControl();
    control.selectOnly("squad-2");
    control.toggleSelected("squad-3");
    control.setSelectedDynamicsOverride("responsiveness", 0.31);
    control.setSelectedDynamicsOverride("slotTolerance", 0.42);
    control.setSelectedDynamicsOverride("slowdownRadius", 2.4);

    expect(control.effectiveDynamicsFor("companion")).toEqual({
      slotTolerance: 0.18,
      responsiveness: 0.82,
      slowdownRadius: 0.72,
      overridden: []
    });
    expect(control.effectiveDynamicsFor("squad-2")).toEqual({
      slotTolerance: 0.42,
      responsiveness: 0.31,
      slowdownRadius: 2.4,
      overridden: ["slotTolerance", "responsiveness", "slowdownRadius"]
    });
    expect(control.effectiveDynamicsFor("squad-3")).toEqual(
      control.effectiveDynamicsFor("squad-2")
    );

    control.setGroupDynamics("responsiveness", 0.6);
    expect(control.effectiveDynamicsFor("companion").responsiveness).toBe(0.6);
    expect(control.effectiveDynamicsFor("squad-2").responsiveness).toBe(0.31);

    control.clearSelectedDynamicsOverrides();
    expect(control.effectiveDynamicsFor("squad-2").overridden).toEqual([]);
    expect(control.effectiveDynamicsFor("squad-2").responsiveness).toBe(0.6);
  });
});
