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

  it("makes dynamics bounded and behaviorally meaningful inputs", () => {
    const control = new FieldLabSquadControl();
    control.setSpacingScale(99);
    control.setSlotTolerance(-10);
    control.setResponsiveness(0);

    expect(control.snapshot().dynamics).toEqual({
      spacingScale: 2.5,
      slotTolerance: 0.05,
      responsiveness: 0.15
    });
  });
});
