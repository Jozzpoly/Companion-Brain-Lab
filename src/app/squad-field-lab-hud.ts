import {
  FIELD_LAB_SQUAD_MEMBERS,
  type FieldLabFormationPreset,
  type FieldLabSquadControlSnapshot,
  type SquadOrderMode
} from "../squad/field-lab-squad-control";
import type {
  CooperativeEpisodeOutcome,
  CooperativeEpisodePhase,
  CooperativeEpisodeSnapshot
} from "../world/cooperative-episode-contract";
import type { FieldLabLayout, FieldLabSituation, SquadMemberId } from "../world/types";

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
  onResponsiveness(value: number): void;
  onTolerance(value: number): void;
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

function slider(
  label: string,
  min: number,
  max: number,
  step: number,
  onInput: (value: number) => void
): { root: HTMLElement; input: HTMLInputElement; value: HTMLElement } {
  const root = document.createElement("label");
  root.className = "squad-lab-slider";
  const heading = document.createElement("span");
  heading.textContent = label;
  const valueLabel = document.createElement("span");
  valueLabel.className = "squad-lab-slider-value";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.addEventListener("input", () => onInput(Number(input.value)));
  root.append(heading, valueLabel, input);
  return { root, input, value: valueLabel };
}

function phaseTone(phase: CooperativeEpisodePhase | null): string {
  if (phase === "PRESSURING") return "danger";
  if (phase === "APPROACHING") return "warning";
  if (phase === "DRIVEN_BACK") return "success";
  return "normal";
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
  private readonly spacing: ReturnType<typeof slider>;
  private readonly responsiveness: ReturnType<typeof slider>;
  private readonly tolerance: ReturnType<typeof slider>;

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

    this.spacing = slider("Spacing", 0.45, 2.5, 0.05, callbacks.onSpacing);
    this.responsiveness = slider("Response", 0.15, 1, 0.05, callbacks.onResponsiveness);
    this.tolerance = slider("Slot tolerance", 0.05, 0.9, 0.05, callbacks.onTolerance);

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
      this.responsiveness.root,
      this.tolerance.root,
      this.pressureBlock,
      this.status,
      this.orderStatus,
      footer
    );
    gamePane.parentElement?.insertBefore(this.root, gamePane);
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

    this.spacing.input.value = String(control.dynamics.spacingScale);
    this.spacing.value.textContent = control.dynamics.spacingScale.toFixed(2);
    this.responsiveness.input.value = String(control.dynamics.responsiveness);
    this.responsiveness.value.textContent = control.dynamics.responsiveness.toFixed(2);
    this.tolerance.input.value = String(control.dynamics.slotTolerance);
    this.tolerance.value.textContent = control.dynamics.slotTolerance.toFixed(2);

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
        return `${LABELS[memberId]} ${assignment?.mode ?? "?"}`;
      })
      .join(" · ");
  }
}
