import type { SquadMemberId, Vec2 } from "../world/types";

export const FIELD_LAB_SQUAD_MEMBERS = [
  "companion",
  "squad-2",
  "squad-3",
  "squad-4"
] as const satisfies readonly SquadMemberId[];

export type SquadOrderMode = "FOLLOW" | "HOLD" | "MOVE";
export type SquadMemberAuthority = "FORMATION" | "DIRECT";
export type FieldLabFormationPreset = "WEDGE" | "LINE" | "COLUMN" | "DIAMOND";

export interface FieldLabFormationSlot {
  memberId: SquadMemberId;
  offset: Vec2;
}

export interface FieldLabMemberAssignment {
  memberId: SquadMemberId;
  mode: SquadOrderMode;
  worldAnchor: Vec2 | null;
}

export interface FieldLabDynamics {
  spacingScale: number;
  slotTolerance: number;
  responsiveness: number;
}

export interface FieldLabSquadControlSnapshot {
  selected: readonly SquadMemberId[];
  focused: SquadMemberId;
  directControl: boolean;
  orientationRadians: number;
  slots: readonly FieldLabFormationSlot[];
  assignments: readonly FieldLabMemberAssignment[];
  dynamics: FieldLabDynamics;
}

export interface FieldLabMemberTarget {
  memberId: SquadMemberId;
  authority: SquadMemberAuthority;
  orderMode: SquadOrderMode;
  target: Vec2 | null;
  localSlot: Vec2;
  worldAnchor: Vec2;
}

const DEFAULT_SLOTS: Readonly<Record<SquadMemberId, Vec2>> = {
  companion: { x: 1.55, y: 0 },
  "squad-2": { x: 1.25, y: -1.15 },
  "squad-3": { x: 1.25, y: 1.15 },
  "squad-4": { x: 2.55, y: 0 }
};

const PRESET_SLOTS: Readonly<Record<FieldLabFormationPreset, Readonly<Record<SquadMemberId, Vec2>>>> = {
  WEDGE: {
    companion: { x: 1.2, y: -0.65 },
    "squad-2": { x: 1.2, y: 0.65 },
    "squad-3": { x: 2.25, y: -1.35 },
    "squad-4": { x: 2.25, y: 1.35 }
  },
  LINE: {
    companion: { x: 1.5, y: -1.8 },
    "squad-2": { x: 1.5, y: -0.6 },
    "squad-3": { x: 1.5, y: 0.6 },
    "squad-4": { x: 1.5, y: 1.8 }
  },
  COLUMN: {
    companion: { x: 1.1, y: 0 },
    "squad-2": { x: 2.15, y: 0 },
    "squad-3": { x: 3.2, y: 0 },
    "squad-4": { x: 4.25, y: 0 }
  },
  DIAMOND: {
    companion: { x: 1.15, y: 0 },
    "squad-2": { x: 2.15, y: -1.05 },
    "squad-3": { x: 2.15, y: 1.05 },
    "squad-4": { x: 3.15, y: 0 }
  }
};

const MIN_SPACING = 0.45;
const MAX_SPACING = 2.5;
const MIN_TOLERANCE = 0.05;
const MAX_TOLERANCE = 0.9;
const MIN_RESPONSIVENESS = 0.15;
const MAX_RESPONSIVENESS = 1;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function finiteVec(value: Vec2, label: string): Vec2 {
  return {
    x: finite(value.x, `${label}.x`),
    y: finite(value.y, `${label}.y`)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function memberOrder(a: SquadMemberId, b: SquadMemberId): number {
  return FIELD_LAB_SQUAD_MEMBERS.indexOf(a) - FIELD_LAB_SQUAD_MEMBERS.indexOf(b);
}

export function rotateFieldLabVector(value: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: value.x * cos - value.y * sin,
    y: value.x * sin + value.y * cos
  };
}

export function inverseRotateFieldLabVector(value: Vec2, radians: number): Vec2 {
  return rotateFieldLabVector(value, -radians);
}

function cloneSnapshot(value: FieldLabSquadControlSnapshot): FieldLabSquadControlSnapshot {
  return {
    selected: [...value.selected],
    focused: value.focused,
    directControl: value.directControl,
    orientationRadians: value.orientationRadians,
    slots: value.slots.map((slot) => ({
      memberId: slot.memberId,
      offset: { ...slot.offset }
    })),
    assignments: value.assignments.map((assignment) => ({
      memberId: assignment.memberId,
      mode: assignment.mode,
      worldAnchor: assignment.worldAnchor ? { ...assignment.worldAnchor } : null
    })),
    dynamics: { ...value.dynamics }
  };
}

export class FieldLabSquadControl {
  private state: FieldLabSquadControlSnapshot = {
    selected: ["companion"],
    focused: "companion",
    directControl: false,
    orientationRadians: 0,
    slots: FIELD_LAB_SQUAD_MEMBERS.map((memberId) => ({
      memberId,
      offset: { ...DEFAULT_SLOTS[memberId] }
    })),
    assignments: FIELD_LAB_SQUAD_MEMBERS.map((memberId) => ({
      memberId,
      mode: "FOLLOW",
      worldAnchor: null
    })),
    dynamics: {
      spacingScale: 1,
      slotTolerance: 0.18,
      responsiveness: 0.82
    }
  };

  snapshot(): FieldLabSquadControlSnapshot {
    return cloneSnapshot(this.state);
  }

  selectOnly(memberId: SquadMemberId): FieldLabSquadControlSnapshot {
    this.assertMember(memberId);
    this.state = {
      ...this.state,
      selected: [memberId],
      focused: memberId
    };
    return this.snapshot();
  }

  toggleSelected(memberId: SquadMemberId): FieldLabSquadControlSnapshot {
    this.assertMember(memberId);
    const selected = new Set(this.state.selected);
    if (selected.has(memberId)) {
      if (selected.size === 1) return this.snapshot();
      selected.delete(memberId);
    } else {
      selected.add(memberId);
    }
    const ordered = [...selected].sort(memberOrder);
    this.state = {
      ...this.state,
      selected: ordered,
      focused: selected.has(this.state.focused) ? this.state.focused : memberId
    };
    return this.snapshot();
  }

  selectAll(): FieldLabSquadControlSnapshot {
    this.state = {
      ...this.state,
      selected: [...FIELD_LAB_SQUAD_MEMBERS]
    };
    return this.snapshot();
  }

  focus(memberId: SquadMemberId): FieldLabSquadControlSnapshot {
    this.assertMember(memberId);
    const selected = this.state.selected.includes(memberId)
      ? [...this.state.selected]
      : [...this.state.selected, memberId].sort(memberOrder);
    this.state = {
      ...this.state,
      selected,
      focused: memberId
    };
    return this.snapshot();
  }

  cycleFocus(direction: 1 | -1): FieldLabSquadControlSnapshot {
    const selected = this.state.selected;
    const current = selected.indexOf(this.state.focused);
    const next = (current + direction + selected.length) % selected.length;
    this.state = {
      ...this.state,
      focused: selected[next]!
    };
    return this.snapshot();
  }

  setDirectControl(enabled: boolean): FieldLabSquadControlSnapshot {
    this.state = { ...this.state, directControl: enabled };
    return this.snapshot();
  }

  issueSelected(mode: SquadOrderMode, anchor?: Vec2 | null): FieldLabSquadControlSnapshot {
    const worldAnchor =
      mode === "FOLLOW"
        ? null
        : anchor
          ? finiteVec(anchor, "selected order anchor")
          : null;
    if (mode !== "FOLLOW" && !worldAnchor) {
      throw new Error(`${mode} requires a world anchor.`);
    }
    const selected = new Set(this.state.selected);
    this.state = {
      ...this.state,
      assignments: this.state.assignments.map((assignment) =>
        selected.has(assignment.memberId)
          ? {
              memberId: assignment.memberId,
              mode,
              worldAnchor: worldAnchor ? { ...worldAnchor } : null
            }
          : {
              memberId: assignment.memberId,
              mode: assignment.mode,
              worldAnchor: assignment.worldAnchor ? { ...assignment.worldAnchor } : null
            }
      )
    };
    return this.snapshot();
  }

  assignmentFor(memberId: SquadMemberId): FieldLabMemberAssignment {
    this.assertMember(memberId);
    const assignment = this.state.assignments.find((value) => value.memberId === memberId);
    if (!assignment) throw new Error(`Missing assignment for ${memberId}.`);
    return {
      memberId,
      mode: assignment.mode,
      worldAnchor: assignment.worldAnchor ? { ...assignment.worldAnchor } : null
    };
  }

  setOrientationRadians(radians: number): FieldLabSquadControlSnapshot {
    this.state = {
      ...this.state,
      orientationRadians: finite(radians, "formation orientation")
    };
    return this.snapshot();
  }

  rotateBy(radians: number): FieldLabSquadControlSnapshot {
    return this.setOrientationRadians(this.state.orientationRadians + radians);
  }

  applyFormationPreset(preset: FieldLabFormationPreset): FieldLabSquadControlSnapshot {
    const generated = PRESET_SLOTS[preset];
    this.state = {
      ...this.state,
      slots: FIELD_LAB_SQUAD_MEMBERS.map((memberId) => ({
        memberId,
        offset: { ...generated[memberId] }
      }))
    };
    return this.snapshot();
  }

  setSlotOffset(memberId: SquadMemberId, offset: Vec2): FieldLabSquadControlSnapshot {
    this.assertMember(memberId);
    const next = finiteVec(offset, `slot ${memberId}`);
    this.state = {
      ...this.state,
      slots: this.state.slots.map((slot) =>
        slot.memberId === memberId
          ? { memberId, offset: next }
          : { memberId: slot.memberId, offset: { ...slot.offset } }
      )
    };
    return this.snapshot();
  }

  setSpacingScale(value: number): FieldLabSquadControlSnapshot {
    this.state = {
      ...this.state,
      dynamics: {
        ...this.state.dynamics,
        spacingScale: clamp(finite(value, "spacing scale"), MIN_SPACING, MAX_SPACING)
      }
    };
    return this.snapshot();
  }

  setSlotTolerance(value: number): FieldLabSquadControlSnapshot {
    this.state = {
      ...this.state,
      dynamics: {
        ...this.state.dynamics,
        slotTolerance: clamp(finite(value, "slot tolerance"), MIN_TOLERANCE, MAX_TOLERANCE)
      }
    };
    return this.snapshot();
  }

  setResponsiveness(value: number): FieldLabSquadControlSnapshot {
    this.state = {
      ...this.state,
      dynamics: {
        ...this.state.dynamics,
        responsiveness: clamp(finite(value, "responsiveness"), MIN_RESPONSIVENESS, MAX_RESPONSIVENESS)
      }
    };
    return this.snapshot();
  }

  targetFor(memberId: SquadMemberId, playerPosition: Vec2): FieldLabMemberTarget {
    this.assertMember(memberId);
    const slot = this.state.slots.find((candidate) => candidate.memberId === memberId);
    if (!slot) throw new Error(`Missing formation slot for ${memberId}.`);
    const assignment = this.assignmentFor(memberId);

    const anchor =
      assignment.mode === "FOLLOW"
        ? finiteVec(playerPosition, "player position")
        : assignment.worldAnchor
          ? { ...assignment.worldAnchor }
          : (() => {
              throw new Error(`${assignment.mode} is missing its world anchor.`);
            })();

    const localScaled = {
      x: slot.offset.x * this.state.dynamics.spacingScale,
      y: slot.offset.y * this.state.dynamics.spacingScale
    };
    const rotated = rotateFieldLabVector(localScaled, this.state.orientationRadians);
    const target = {
      x: anchor.x + rotated.x,
      y: anchor.y + rotated.y
    };

    const direct = this.state.directControl && this.state.focused === memberId;
    return {
      memberId,
      authority: direct ? "DIRECT" : "FORMATION",
      orderMode: assignment.mode,
      target: direct ? null : target,
      localSlot: { ...slot.offset },
      worldAnchor: anchor
    };
  }

  private assertMember(memberId: SquadMemberId): void {
    if (!FIELD_LAB_SQUAD_MEMBERS.includes(memberId)) {
      throw new Error(`Unknown Field Lab squad member: ${String(memberId)}`);
    }
  }
}
