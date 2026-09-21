import type { SquadMemberId, Vec2 } from "../world/types";

export const FIELD_LAB_SQUAD_MEMBERS = [
  "companion",
  "squad-2",
  "squad-3",
  "squad-4"
] as const satisfies readonly SquadMemberId[];

export type SquadGroupMode = "FOLLOW" | "HOLD" | "MOVE";
export type SquadMemberAuthority = "FORMATION" | "DIRECT";

export interface FieldLabFormationSlot {
  memberId: SquadMemberId;
  offset: Vec2;
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
  groupMode: SquadGroupMode;
  worldAnchor: Vec2 | null;
  orientationRadians: number;
  slots: readonly FieldLabFormationSlot[];
  dynamics: FieldLabDynamics;
}

export interface FieldLabMemberTarget {
  memberId: SquadMemberId;
  authority: SquadMemberAuthority;
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

function rotate(value: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: value.x * cos - value.y * sin,
    y: value.x * sin + value.y * cos
  };
}

function cloneSnapshot(value: FieldLabSquadControlSnapshot): FieldLabSquadControlSnapshot {
  return {
    selected: [...value.selected],
    focused: value.focused,
    directControl: value.directControl,
    groupMode: value.groupMode,
    worldAnchor: value.worldAnchor ? { ...value.worldAnchor } : null,
    orientationRadians: value.orientationRadians,
    slots: value.slots.map((slot) => ({
      memberId: slot.memberId,
      offset: { ...slot.offset }
    })),
    dynamics: { ...value.dynamics }
  };
}

export class FieldLabSquadControl {
  private state: FieldLabSquadControlSnapshot = {
    selected: ["companion"],
    focused: "companion",
    directControl: false,
    groupMode: "FOLLOW",
    worldAnchor: null,
    orientationRadians: 0,
    slots: FIELD_LAB_SQUAD_MEMBERS.map((memberId) => ({
      memberId,
      offset: { ...DEFAULT_SLOTS[memberId] }
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

  setGroupMode(mode: SquadGroupMode, anchor?: Vec2 | null): FieldLabSquadControlSnapshot {
    const worldAnchor =
      mode === "FOLLOW"
        ? null
        : anchor
          ? finiteVec(anchor, "group anchor")
          : this.state.worldAnchor;
    if (mode !== "FOLLOW" && !worldAnchor) {
      throw new Error(`${mode} requires a world anchor.`);
    }
    this.state = {
      ...this.state,
      groupMode: mode,
      worldAnchor
    };
    return this.snapshot();
  }

  setWorldAnchor(anchor: Vec2): FieldLabSquadControlSnapshot {
    this.state = {
      ...this.state,
      worldAnchor: finiteVec(anchor, "world anchor")
    };
    return this.snapshot();
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

    const anchor =
      this.state.groupMode === "FOLLOW"
        ? finiteVec(playerPosition, "player position")
        : this.state.worldAnchor
          ? { ...this.state.worldAnchor }
          : (() => {
              throw new Error(`${this.state.groupMode} is missing its world anchor.`);
            })();

    const localScaled = {
      x: slot.offset.x * this.state.dynamics.spacingScale,
      y: slot.offset.y * this.state.dynamics.spacingScale
    };
    const rotated = rotate(localScaled, this.state.orientationRadians);
    const target = {
      x: anchor.x + rotated.x,
      y: anchor.y + rotated.y
    };

    const direct = this.state.directControl && this.state.focused === memberId;
    return {
      memberId,
      authority: direct ? "DIRECT" : "FORMATION",
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
