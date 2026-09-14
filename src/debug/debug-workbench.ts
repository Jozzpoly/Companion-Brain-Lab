export type DebugPreset = "play" | "brain" | "nav" | "spatial" | "motion" | "all";

export const DEBUG_PRESETS: readonly DebugPreset[] = ["play", "brain", "nav", "spatial", "motion", "all"];

export interface DebugVisibility {
  brain: boolean;
  nav: boolean;
  spatial: boolean;
  motion: boolean;
  events: boolean;
}

const VISIBILITY: Readonly<Record<DebugPreset, DebugVisibility>> = {
  play: { brain: false, nav: false, spatial: false, motion: false, events: false },
  brain: { brain: true, nav: false, spatial: false, motion: false, events: true },
  nav: { brain: false, nav: true, spatial: false, motion: false, events: true },
  spatial: { brain: false, nav: true, spatial: true, motion: false, events: true },
  motion: { brain: false, nav: false, spatial: false, motion: true, events: true },
  all: { brain: true, nav: true, spatial: true, motion: true, events: true }
};

export class DebugWorkbenchState {
  private presetValue: DebugPreset;

  constructor(initial: DebugPreset = "brain") {
    this.presetValue = initial;
  }

  preset(): DebugPreset {
    return this.presetValue;
  }

  visibility(): DebugVisibility {
    return VISIBILITY[this.presetValue];
  }

  cycle(): DebugPreset {
    const index = DEBUG_PRESETS.indexOf(this.presetValue);
    const next = DEBUG_PRESETS[(index + 1) % DEBUG_PRESETS.length];
    if (!next) throw new Error("Debug preset cycle produced no next preset.");
    this.presetValue = next;
    return next;
  }

  set(preset: DebugPreset): void {
    this.presetValue = preset;
  }
}
