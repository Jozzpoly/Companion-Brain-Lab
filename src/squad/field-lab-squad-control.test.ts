import { describe, expect, it } from "vitest";
import {
  FIELD_LAB_SQUAD_MEMBERS,
  FieldLabSquadControl
} from "./field-lab-squad-control";

describe("FieldLabSquadControl", () => {
  it("starts with one focused companion but retains four editable real-member slots", () => {
    const control = new FieldLabSquadControl();
    const state = control.snapshot();
    expect(state.selected).toEqual(["companion"]);
    expect(state.focused).toBe("companion");
    expect(state.slots.map((slot) => slot.memberId)).toEqual(FIELD_LAB_SQUAD_MEMBERS);
    expect(state.groupMode).toBe("FOLLOW");
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

  it("can switch the same formation from player-relative follow to a world anchor", () => {
    const control = new FieldLabSquadControl();
    const follow = control.targetFor("companion", { x: 2, y: 3 }).target;
    expect(follow).toEqual({ x: 3.55, y: 3 });

    control.setGroupMode("HOLD", { x: 8, y: 4 });
    const hold = control.targetFor("companion", { x: 100, y: 100 }).target;
    expect(hold).toEqual({ x: 9.55, y: 4 });
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
