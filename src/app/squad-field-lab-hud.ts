import {
  FIELD_LAB_PARAMETER_RANGES,
  FIELD_LAB_SQUAD_MEMBERS,
  type FieldLabFormationPreset,
  type FieldLabMemberDynamicsKey,
  type FieldLabSquadControlSnapshot,
  type SquadOrderMode
} from "../squad/field-lab-squad-control";
import type {
  CooperativeEpisodeOutcome,
  CooperativeEpisodePhase,
  CooperativeEpisodeSnapshot
} from "../world/cooperative-episode-contract";
import type { FieldLabLayout, FieldLabSituation, SquadMemberId } from "../world/types";
import type {
  FieldLabExperimentDiff,
  FieldLabExperimentSlot
} from "../squad/field-lab-experiment";

type DynamicsScope = "GROUP" | "SELECTED";

export interface SquadFieldLabHudCallbacks {
  onSituation(situation: FieldLabSituation): void;
  onLayout(layout: FieldLabLayout): void;
  onSquadSize(count: number): void;
  onSelect(memberId: SquadMemberId, additive: boolean): void;
  onSelectAll(): void;
  onCycleFocus(direction: 1 | -1): void;
  onToggleDirect(): void;
  onOrder(mode: SquadOrderMode): void;
  onPreset(preset: FieldLabFormationPreset): void;
  onRotate(deltaRadians: number): void;
  onSpacing(value: number): void;
  onGroupDynamics(key: FieldLabMemberDynamicsKey, value: number): void;
  onSelectedDynamicsOverride(key: FieldLabMemberDynamicsKey, value: number): void;
  onClearSelectedDynamicsOverrides(): void;
  onCaptureExperiment(slot: FieldLabExperimentSlot): void;
  onRestoreExperiment(slot: FieldLabExperimentSlot): void;
  onRenameExperiment(slot: FieldLabExperimentSlot, label: string): void;
  onClearExperiment(slot: FieldLabExperimentSlot): void;
  onPlayerRepel(): void;
  onFocusedRepel(): void;
  onSelectedRepel(): void;
}

export interface SquadFieldLabHudState {
  control: FieldLabSquadControlSnapshot;
  situation: FieldLabSituation;
  layout: FieldLabLayout;
  episode: CooperativeEpisodeSnapshot | null;
  latestEpisodeOutcome: CooperativeEpisodeOutcome;
  experiments: Readonly<Partial<Record<FieldLabExperimentSlot, {
    label: string;
    capturedAtTick: number;
  }>>>;
  experimentDiff: FieldLabExperimentDiff | null;
}

const LABELS: Readonly<Record<SquadMemberId, string>> = {
  companion: "C1",
  "squad-2": "C2",
  "squad-3": "C3",
  "squad-4": "C4"
};

function button(label: string, className = "squad-lab-button"): HTMLButtonElement {
  const value = document.createElement("button");
  value.type = "button";
  value.className = className;
  value.textContent = label;
  return value;
}

interface ParameterEditor {
  root: HTMLElement;
  input: HTMLInputElement;
  numeric: HTMLInputElement;
  note: HTMLElement;
  setValue(value: number): void;
  setNote(value: string, state?: string): void;
}

function parameterEditor(
  label: string,
  min: number,
  max: number,
  step: number,
  onInput: (value: number) => void
): ParameterEditor {
  const root = document.createElement("label");
  root.className = "squad-lab-slider";

  const heading = document.createElement("span");
  heading.className = "squad-lab-slider-heading";
  heading.textContent = label;
  heading.title = `Supported range ${min}–${max}`;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);

  const numeric = document.createElement("input");
  numeric.type = "number";
  numeric.min = String(min);
  numeric.max = String(max);
  numeric.step = String(step);
  numeric.className = "squad-lab-number-input";
  numeric.title = `Exact value · supported ${min}–${max}`;

  const note = document.createElement("span");
  note.className = "squad-lab-param-note";

  const commit = (source: HTMLInputElement): void => {
    if (!source.checkValidity()) {
      source.reportValidity();
      return;
    }
    const value = Number(source.value);
    if (!Number.isFinite(value)) return;
    input.value = String(value);
    numeric.value = String(value);
    onInput(value);
  };

  input.addEventListener("input", () => commit(input));
  numeric.addEventListener("change", () => commit(numeric));

  root.append(heading, input, numeric, note);
  return {
    root,
    input,
    numeric,
    note,
    setValue(value: number) {
      if (document.activeElement !== input) input.value = String(value);
      if (document.activeElement !== numeric) numeric.value = String(value);
    },
    setNote(value: string, state = "normal") {
      note.textContent = value;
      note.dataset.state = state;
    }
  };
}

function phaseTone(phase: CooperativeEpisodePhase | null): string {
  if (phase === "PRESSURING") return "danger";
  if (phase === "APPROACHING") return "warning";
  if (phase === "DRIVEN_BACK") return "success";
  return "normal";
}

function memberOverride(
  control: FieldLabSquadControlSnapshot,
  memberId: SquadMemberId,
  key: FieldLabMemberDynamicsKey
): number | null {
  return control.memberDynamics.find((entry) => entry.memberId === memberId)?.[key] ?? null;
}

export class SquadFieldLabHud {
  private readonly root: HTMLElement;
  private readonly rosterButtons = new Map<SquadMemberId, HTMLButtonElement>();
  private readonly directButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly orderStatus: HTMLElement;
  private readonly pressureBlock: HTMLElement;
  private readonly pressureStatus: HTMLElement;
  private readonly situationButtons = new Map<FieldLabSituation, HTMLButtonElement>();
  private readonly layoutButtons = new Map<FieldLabLayout, HTMLButtonElement>();
  private readonly spacing: ParameterEditor;
  private readonly responsiveness: ParameterEditor;
  private readonly tolerance: ParameterEditor;
  private readonly slowdownRadius: ParameterEditor;
  private readonly dynamicsScopeButtons = new Map<DynamicsScope, HTMLButtonElement>();
  private readonly dynamicsScopeStatus: HTMLElement;
  private readonly clearSelectedOverrides: HTMLButtonElement;
  private dynamicsScope: DynamicsScope = "GROUP";
  private readonly experimentLabelInputs = new Map<FieldLabExperimentSlot, HTMLInputElement>();
  private readonly experimentRestoreButtons = new Map<FieldLabExperimentSlot, HTMLButtonElement>();
  private readonly experimentClearButtons = new Map<FieldLabExperimentSlot, HTMLButtonElement>();
  private readonly experimentMeta = new Map<FieldLabExperimentSlot, HTMLElement>();
  private readonly experimentDiffSummary: HTMLElement;

  constructor(callbacks: SquadFieldLabHudCallbacks) {
    const gamePane = document.querySelector<HTMLElement>("#game-pane");
    if (!gamePane) throw new Error("SquadFieldLabHud requires #game-pane.");

    this.root = document.createElement("section");
    this.root.className = "squad-field-lab-hud";
    this.root.dataset.squadFieldLabHud = "true";
    this.root.setAttribute("aria-label", "Squad Field Lab controls");

    const heading = document.createElement("div");
    heading.className = "squad-lab-heading";
    heading.textContent = "Companion / Squad Field Lab";

    const situationHeading = document.createElement("div");
    situationHeading.className = "squad-lab-section-title";
    situationHeading.textContent = "Situation";

    const situationRow = document.createElement("div");
    situationRow.className = "squad-lab-situation-grid";
    for (const situation of ["TRAINING", "PRESSURE"] as const) {
      const control = button(situation === "TRAINING" ? "Training" : "Pressure");
      control.dataset.situation = situation;
      control.addEventListener("click", () => callbacks.onSituation(situation));
      situationRow.append(control);
      this.situationButtons.set(situation, control);
    }

    const layoutHeading = document.createElement("div");
    layoutHeading.className = "squad-lab-section-title";
    layoutHeading.textContent = "Spatial layout";

    const layoutRow = document.createElement("div");
    layoutRow.className = "squad-lab-layout-grid";
    for (const layout of ["OPEN", "DOORWAY", "PILLAR", "MIXED"] as const) {
      const control = button(layout.toLowerCase());
      control.dataset.layout = layout;
      control.addEventListener("click", () => callbacks.onLayout(layout));
      layoutRow.append(control);
      this.layoutButtons.set(layout, control);
    }

    const sizeHeading = document.createElement("div");
    sizeHeading.className = "squad-lab-section-title";
    sizeHeading.textContent = "Deployed squad";

    const sizeRow = document.createElement("div");
    sizeRow.className = "squad-lab-size-grid";
    for (const count of [1, 2, 3, 4]) {
      const sizeButton = button(String(count));
      sizeButton.dataset.squadSize = String(count);
      sizeButton.addEventListener("click", () => callbacks.onSquadSize(count));
      sizeRow.append(sizeButton);
    }

    const sub = document.createElement("div");
    sub.className = "squad-lab-sub";
    sub.textContent =
      "WASD player · click/Shift-click squad · right-click move selected · drag slot handles · arrows direct focus";

    const roster = document.createElement("div");
    roster.className = "squad-lab-roster";
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const entry = button(LABELS[memberId], "squad-lab-roster-button");
      entry.dataset.memberId = memberId;
      entry.addEventListener("click", (event) => callbacks.onSelect(memberId, event.shiftKey));
      roster.append(entry);
      this.rosterButtons.set(memberId, entry);
    }
    const all = button("ALL", "squad-lab-roster-button");
    all.addEventListener("click", () => callbacks.onSelectAll());
    roster.append(all);

    const focusRow = document.createElement("div");
    focusRow.className = "squad-lab-button-row";
    const previous = button("◀ focus");
    previous.addEventListener("click", () => callbacks.onCycleFocus(-1));
    const next = button("focus ▶");
    next.addEventListener("click", () => callbacks.onCycleFocus(1));
    this.directButton = button("Direct: OFF");
    this.directButton.addEventListener("click", () => callbacks.onToggleDirect());
    focusRow.append(previous, next, this.directButton);

    const orderRow = document.createElement("div");
    orderRow.className = "squad-lab-button-row";
    for (const [mode, label] of [
      ["FOLLOW", "Follow"],
      ["HOLD", "Hold here"]
    ] as const) {
      const control = button(label);
      control.dataset.orderMode = mode;
      control.addEventListener("click", () => callbacks.onOrder(mode));
      orderRow.append(control);
    }
    const moveHint = document.createElement("div");
    moveHint.className = "squad-lab-inline-hint";
    moveHint.textContent = "Right-click world = move selected formation";

    const formationHeading = document.createElement("div");
    formationHeading.className = "squad-lab-section-title";
    formationHeading.textContent = "Formation geometry";

    const presets = document.createElement("div");
    presets.className = "squad-lab-preset-grid";
    for (const preset of ["WEDGE", "LINE", "COLUMN", "DIAMOND"] as const) {
      const control = button(preset.toLowerCase());
      control.addEventListener("click", () => callbacks.onPreset(preset));
      presets.append(control);
    }

    const rotateRow = document.createElement("div");
    rotateRow.className = "squad-lab-button-row";
    const rotateLeft = button("↺ 15°");
    const rotateRight = button("15° ↻");
    rotateLeft.addEventListener("click", () => callbacks.onRotate(-Math.PI / 12));
    rotateRight.addEventListener("click", () => callbacks.onRotate(Math.PI / 12));
    rotateRow.append(rotateLeft, rotateRight);

    const spacingRange = FIELD_LAB_PARAMETER_RANGES.spacingScale;
    this.spacing = parameterEditor(
      "Spacing",
      spacingRange.min,
      spacingRange.max,
      spacingRange.step,
      callbacks.onSpacing
    );
    this.spacing.root.dataset.parameter = "spacingScale";

    const dynamicsHeading = document.createElement("div");
    dynamicsHeading.className = "squad-lab-section-title";
    dynamicsHeading.textContent = "Movement dynamics · explicit scope";

    const dynamicsScopeRow = document.createElement("div");
    dynamicsScopeRow.className = "squad-lab-dynamics-scope-grid";
    for (const scope of ["GROUP", "SELECTED"] as const) {
      const control = button(scope === "GROUP" ? "Group defaults" : "Selected overrides");
      control.dataset.dynamicsScope = scope;
      control.addEventListener("click", () => {
        this.dynamicsScope = scope;
        this.updateDynamicsScopeVisuals();
      });
      dynamicsScopeRow.append(control);
      this.dynamicsScopeButtons.set(scope, control);
    }

    this.dynamicsScopeStatus = document.createElement("div");
    this.dynamicsScopeStatus.className = "squad-lab-inline-hint";
    this.dynamicsScopeStatus.dataset.dynamicsScopeStatus = "true";

    const applyDynamics = (key: FieldLabMemberDynamicsKey, value: number): void => {
      if (this.dynamicsScope === "GROUP") callbacks.onGroupDynamics(key, value);
      else callbacks.onSelectedDynamicsOverride(key, value);
    };

    const responseRange = FIELD_LAB_PARAMETER_RANGES.responsiveness;
    this.responsiveness = parameterEditor(
      "Response",
      responseRange.min,
      responseRange.max,
      responseRange.step,
      (value) => applyDynamics("responsiveness", value)
    );
    this.responsiveness.root.dataset.parameter = "responsiveness";

    const toleranceRange = FIELD_LAB_PARAMETER_RANGES.slotTolerance;
    this.tolerance = parameterEditor(
      "Slot tolerance",
      toleranceRange.min,
      toleranceRange.max,
      toleranceRange.step,
      (value) => applyDynamics("slotTolerance", value)
    );
    this.tolerance.root.dataset.parameter = "slotTolerance";

    const slowdownRange = FIELD_LAB_PARAMETER_RANGES.slowdownRadius;
    this.slowdownRadius = parameterEditor(
      "Slowdown radius",
      slowdownRange.min,
      slowdownRange.max,
      slowdownRange.step,
      (value) => applyDynamics("slowdownRadius", value)
    );
    this.slowdownRadius.root.dataset.parameter = "slowdownRadius";

    this.clearSelectedOverrides = button("Selected: inherit group defaults");
    this.clearSelectedOverrides.dataset.clearDynamicsOverrides = "true";
    this.clearSelectedOverrides.addEventListener(
      "click",
      () => callbacks.onClearSelectedDynamicsOverrides()
    );

    const experimentHeading = document.createElement("div");
    experimentHeading.className = "squad-lab-section-title";
    experimentHeading.textContent = "Experiment setups · persistent A/B";

    const experimentGrid = document.createElement("div");
    experimentGrid.className = "squad-lab-experiment-grid";
    for (const slot of ["A", "B"] as const) {
      const card = document.createElement("section");
      card.className = "squad-lab-experiment-card";
      card.dataset.experimentSlot = slot;

      const title = document.createElement("div");
      title.className = "squad-lab-experiment-title";
      title.textContent = `Setup ${slot}`;

      const meta = document.createElement("span");
      meta.className = "squad-lab-experiment-meta";
      meta.textContent = "empty";
      this.experimentMeta.set(slot, meta);
      title.append(meta);

      const label = document.createElement("input");
      label.type = "text";
      label.maxLength = 80;
      label.placeholder = `Label setup ${slot}`;
      label.className = "squad-lab-experiment-label";
      label.disabled = true;
      label.addEventListener("change", () => callbacks.onRenameExperiment(slot, label.value));
      this.experimentLabelInputs.set(slot, label);

      const actions = document.createElement("div");
      actions.className = "squad-lab-experiment-actions";

      const capture = button(`Capture ${slot}`);
      capture.dataset.experimentCapture = slot;
      capture.addEventListener("click", () => callbacks.onCaptureExperiment(slot));

      const restore = button(`Restore ${slot}`);
      restore.dataset.experimentRestore = slot;
      restore.disabled = true;
      restore.addEventListener("click", () => callbacks.onRestoreExperiment(slot));
      this.experimentRestoreButtons.set(slot, restore);

      const clear = button("Clear");
      clear.dataset.experimentClear = slot;
      clear.disabled = true;
      clear.addEventListener("click", () => callbacks.onClearExperiment(slot));
      this.experimentClearButtons.set(slot, clear);

      actions.append(capture, restore, clear);
      card.append(title, label, actions);
      experimentGrid.append(card);
    }

    this.experimentDiffSummary = document.createElement("div");
    this.experimentDiffSummary.className = "squad-lab-experiment-diff";
    this.experimentDiffSummary.dataset.experimentDiff = "true";
    this.experimentDiffSummary.textContent = "Capture A and B to compare exact authored setups.";

    this.pressureBlock = document.createElement("section");
    this.pressureBlock.className = "squad-lab-pressure-block";
    const pressureHeading = document.createElement("div");
    pressureHeading.className = "squad-lab-section-title";
    pressureHeading.textContent = "Cooperative pressure";
    this.pressureStatus = document.createElement("div");
    this.pressureStatus.className = "squad-lab-pressure-status";
    const pressureActions = document.createElement("div");
    pressureActions.className = "squad-lab-pressure-actions";

    const playerRepel = button("E · Player REPEL");
    playerRepel.dataset.pressureAction = "player";
    playerRepel.addEventListener("click", () => callbacks.onPlayerRepel());
    const focusedRepel = button("Enter · Focus REPEL");
    focusedRepel.dataset.pressureAction = "focused";
    focusedRepel.addEventListener("click", () => callbacks.onFocusedRepel());
    const selectedRepel = button("Space · Selected REPEL");
    selectedRepel.dataset.pressureAction = "selected";
    selectedRepel.addEventListener("click", () => callbacks.onSelectedRepel());
    pressureActions.append(playerRepel, focusedRepel, selectedRepel);
    this.pressureBlock.append(pressureHeading, this.pressureStatus, pressureActions);

    this.status = document.createElement("div");
    this.status.className = "squad-lab-status";
    this.orderStatus = document.createElement("div");
    this.orderStatus.className = "squad-lab-order-status";

    const footer = document.createElement("div");
    footer.className = "squad-lab-footer";
    footer.textContent =
      "Tab focus · F direct · 1–4 select one · P pause · O step · T time · R rebuild";

    this.root.append(
      heading,
      situationHeading,
      situationRow,
      layoutHeading,
      layoutRow,
      sizeHeading,
      sizeRow,
      sub,
      roster,
      focusRow,
      orderRow,
      moveHint,
      formationHeading,
      presets,
      rotateRow,
      this.spacing.root,
      dynamicsHeading,
      dynamicsScopeRow,
      this.dynamicsScopeStatus,
      this.responsiveness.root,
      this.tolerance.root,
      this.slowdownRadius.root,
      this.clearSelectedOverrides,
      experimentHeading,
      experimentGrid,
      this.experimentDiffSummary,
      this.pressureBlock,
      this.status,
      this.orderStatus,
      footer
    );
    gamePane.parentElement?.insertBefore(this.root, gamePane);
    this.updateDynamicsScopeVisuals();
  }

  update(state: SquadFieldLabHudState): void {
    const { control } = state;
    for (const [situation, entry] of this.situationButtons) {
      entry.classList.toggle("is-active", state.situation === situation);
    }
    for (const [layout, entry] of this.layoutButtons) {
      entry.classList.toggle("is-active", state.layout === layout);
    }

    for (const [memberId, entry] of this.rosterButtons) {
      const active = control.activeMembers.includes(memberId);
      const selected = control.selected.includes(memberId);
      const focused = control.focused === memberId;
      entry.disabled = !active;
      entry.classList.toggle("is-inactive", !active);
      entry.classList.toggle("is-selected", selected);
      entry.classList.toggle("is-focused", focused);
      entry.setAttribute("aria-pressed", String(selected));
      entry.textContent = `${LABELS[memberId]}${focused ? " ★" : ""}`;
    }

    for (const sizeButton of this.root.querySelectorAll<HTMLButtonElement>("[data-squad-size]")) {
      const count = Number(sizeButton.dataset.squadSize);
      sizeButton.classList.toggle("is-active", count === control.activeMembers.length);
    }

    this.directButton.classList.toggle("is-active", control.directControl);
    this.directButton.textContent = control.directControl
      ? `Direct ${LABELS[control.focused]}: ON`
      : "Direct: OFF";

    this.spacing.setValue(control.dynamics.spacingScale);
    this.spacing.setNote(
      `formation · ${FIELD_LAB_PARAMETER_RANGES.spacingScale.min}–${FIELD_LAB_PARAMETER_RANGES.spacingScale.max}`
    );

    this.updateDynamicsEditors(control);

    for (const slot of ["A", "B"] as const) {
      const captured = state.experiments[slot];
      const label = this.experimentLabelInputs.get(slot);
      const restore = this.experimentRestoreButtons.get(slot);
      const clear = this.experimentClearButtons.get(slot);
      const meta = this.experimentMeta.get(slot);
      if (label) {
        label.disabled = !captured;
        if (document.activeElement !== label) label.value = captured?.label ?? "";
      }
      if (restore) restore.disabled = !captured;
      if (clear) clear.disabled = !captured;
      if (meta) meta.textContent = captured ? `tick ${captured.capturedAtTick}` : "empty";
    }

    if (!state.experiments.A || !state.experiments.B) {
      this.experimentDiffSummary.textContent = "Capture A and B to compare exact authored setups.";
      this.experimentDiffSummary.dataset.state = "incomplete";
    } else if (state.experimentDiff?.equal) {
      this.experimentDiffSummary.textContent = "A/B: identical setup state.";
      this.experimentDiffSummary.dataset.state = "equal";
    } else {
      const diff = state.experimentDiff;
      this.experimentDiffSummary.textContent = diff
        ? `A/B: ${diff.differences.length} differences · ${diff.categories.join(" · ")}`
        : "A/B diff unavailable.";
      this.experimentDiffSummary.dataset.state = "different";
    }

    this.pressureBlock.hidden = state.situation !== "PRESSURE";
    const phase = state.episode?.phase ?? null;
    this.pressureBlock.dataset.tone = phaseTone(phase);
    this.pressureStatus.textContent = state.episode
      ? `${state.episode.phase} · cycle ${state.episode.cycle + 1} · last ${state.episode.lastOutcome} · repelled by ${state.episode.repelledBy.join(", ") || "none"}`
      : "pressure inactive";

    this.status.textContent =
      `${state.situation} / ${state.layout} · squad ${control.activeMembers.length} · selected ${control.selected.map((id) => LABELS[id]).join(" + ")} · focus ${LABELS[control.focused]} · ` +
      `orientation ${Math.round(control.orientationRadians * 180 / Math.PI)}°`;

    this.orderStatus.textContent = control.activeMembers
      .map((memberId) => {
        const assignment = control.assignments.find((value) => value.memberId === memberId);
        const override = control.memberDynamics.find((value) => value.memberId === memberId);
        const overrideCount = override
          ? [override.slotTolerance, override.responsiveness, override.slowdownRadius]
              .filter((value) => value !== null).length
          : 0;
        return `${LABELS[memberId]} ${assignment?.mode ?? "?"}${overrideCount > 0 ? ` · dyn×${overrideCount}` : ""}`;
      })
      .join(" · ");
  }

  private updateDynamicsScopeVisuals(): void {
    for (const [scope, entry] of this.dynamicsScopeButtons) {
      entry.classList.toggle("is-active", this.dynamicsScope === scope);
    }
    this.clearSelectedOverrides.disabled = this.dynamicsScope !== "SELECTED";
  }

  private updateDynamicsEditors(control: FieldLabSquadControlSnapshot): void {
    this.updateDynamicsScopeVisuals();
    const focused = control.focused;
    const selectedLabel = control.selected.map((id) => LABELS[id]).join(" + ");

    if (this.dynamicsScope === "GROUP") {
      this.dynamicsScopeStatus.textContent =
        "Editing group defaults · member overrides remain explicit and take precedence.";
      this.responsiveness.setValue(control.dynamics.responsiveness);
      this.tolerance.setValue(control.dynamics.slotTolerance);
      this.slowdownRadius.setValue(control.dynamics.slowdownRadius);
      this.responsiveness.setNote("group default");
      this.tolerance.setNote("group default");
      this.slowdownRadius.setNote("group default");
      return;
    }

    this.dynamicsScopeStatus.textContent =
      `Editing selected overrides: ${selectedLabel} · unset values inherit group defaults.`;

    const editors: Readonly<Record<FieldLabMemberDynamicsKey, ParameterEditor>> = {
      responsiveness: this.responsiveness,
      slotTolerance: this.tolerance,
      slowdownRadius: this.slowdownRadius
    };

    for (const key of ["responsiveness", "slotTolerance", "slowdownRadius"] as const) {
      const selectedValues = control.selected.map((memberId) => memberOverride(control, memberId, key));
      const first = selectedValues[0] ?? null;
      const same = selectedValues.every((value) => value === first);
      const focusedOverride = memberOverride(control, focused, key);
      const effective = focusedOverride ?? control.dynamics[key];
      editors[key].setValue(effective);

      if (!same) {
        editors[key].setNote(`mixed · focus ${LABELS[focused]}=${effective.toFixed(2)}`, "mixed");
      } else if (first === null) {
        editors[key].setNote(`inherit ${control.dynamics[key].toFixed(2)}`, "inherit");
      } else {
        editors[key].setNote(`override ${first.toFixed(2)}`, "override");
      }
    }
  }
}
