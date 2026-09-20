export type CausalPanelAction =
  | "toggle-pause"
  | "single-step"
  | "reset"
  | "cycle-mode"
  | "toggle-actuator"
  | "cycle-a1-authority"
  | "cycle-time"
  | "capture-incident"
  | "directive-at-will"
  | "directive-follow"
  | "directive-hold"
  | "p2-preview"
  | "p2-arm-singleton"
  | "p2-disarm"
  | "scenario-open"
  | "scenario-pillar"
  | "scenario-doorway"
  | "scenario-head-on"
  | "scenario-shared-danger"
  | "s1-player-intervene"
  | "s1-companion-intervene"
  | "toggle-s3-authority";

export type WorldDebugLayer =
  | "relationship"
  | "coordination"
  | "route"
  | "spatial"
  | "motion"
  | "trails"
  | "contacts";

export interface CausalPanelSection {
  id: string;
  title: string;
  lines: readonly string[];
  tone?: "normal" | "warning" | "danger" | "success";
}

export interface CausalPanelModel {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "normal" | "warning" | "danger" | "success";
  sections: readonly CausalPanelSection[];
}

interface RenderedCausalPanelSection {
  node: HTMLElement;
  details: HTMLDetailsElement;
  summary: HTMLElement;
  body: HTMLElement;
}

const DEFAULT_LAYERS: Readonly<Record<WorldDebugLayer, boolean>> = {
  relationship: false,
  coordination: false,
  route: true,
  spatial: true,
  motion: true,
  trails: true,
  contacts: true
};

const DEFAULT_OPEN_SECTION_IDS = new Set(["s1-apparatus", "direction", "run", "stage-b", "recovery", "route", "motion", "a1", "p2"]);

export class CausalPanelDisclosureState {
  private readonly remembered = new Map<string, boolean>();

  isOpen(sectionId: string): boolean {
    return this.remembered.get(sectionId) ?? DEFAULT_OPEN_SECTION_IDS.has(sectionId);
  }

  remember(sectionId: string, open: boolean): void {
    this.remembered.set(sectionId, open);
  }
}

function button(label: string, action: CausalPanelAction): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "debug-button";
  element.dataset.action = action;
  element.textContent = label;
  return element;
}

function layerLabel(layer: WorldDebugLayer): string {
  if (layer === "relationship") return "Relationship";
  if (layer === "coordination") return "Coordination";
  if (layer === "route") return "Route";
  if (layer === "spatial") return "Spatial";
  if (layer === "motion") return "Motion";
  if (layer === "trails") return "Trails";
  return "Contacts";
}

export class CausalPanel {
  private readonly root: HTMLElement;
  private readonly ownerSandboxSurface: boolean;
  private readonly content: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly sectionsRoot: HTMLElement;
  private readonly layerValues = new Map<WorldDebugLayer, boolean>();
  private readonly disclosureState = new CausalPanelDisclosureState();
  private readonly renderedSections = new Map<string, RenderedCausalPanelSection>();
  private collapsed = false;

  constructor(onAction: (action: CausalPanelAction) => void) {
    const root = document.querySelector<HTMLElement>("#debug-panel");
    if (!root) throw new Error("R1 CausalPanel requires #debug-panel.");
    this.root = root;
    this.root.replaceChildren();
    const participantParams = new URLSearchParams(window.location.search);
    this.ownerSandboxSurface = participantParams.get("owner") === "1";
    if (this.ownerSandboxSurface) {
      this.collapsed = true;
      this.root.classList.add("is-collapsed", "is-owner-sandbox");
      this.root.setAttribute("aria-label", "Owner movement review controls");
      document.title = "Companion Brain Lab — Movement Review";
    }

    for (const [layer, visible] of Object.entries(DEFAULT_LAYERS) as Array<[WorldDebugLayer, boolean]>) {
      this.layerValues.set(layer, visible);
    }

    const header = document.createElement("div");
    header.className = "debug-panel-header";

    const heading = document.createElement("div");
    heading.className = "debug-heading";
    this.title = document.createElement("strong");
    this.title.textContent = "R1 Causal Workbench";
    this.subtitle = document.createElement("span");
    this.subtitle.className = "debug-subtitle";
    heading.append(this.title, this.subtitle);

    this.badge = document.createElement("span");
    this.badge.className = "debug-badge";

    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "debug-collapse";
    collapse.textContent = this.collapsed ? "›" : "‹";
    collapse.title = this.collapsed ? "Expand research panel" : "Collapse debug panel";
    collapse.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.root.classList.toggle("is-collapsed", this.collapsed);
      collapse.textContent = this.collapsed ? "›" : "‹";
      collapse.title = this.collapsed ? "Expand research panel" : "Collapse debug panel";
    });

    collapse.hidden = this.ownerSandboxSurface;
    header.append(heading, this.badge, collapse);

    this.content = document.createElement("div");
    this.content.className = "debug-panel-content";

    const controls = document.createElement("section");
    controls.className = "debug-section debug-controls";
    const controlTitle = document.createElement("h2");
    controlTitle.textContent = "Run";
    const controlGrid = document.createElement("div");
    controlGrid.className = "debug-button-grid";
    controlGrid.append(
      button("Pause / Run", "toggle-pause"),
      button("Single step", "single-step"),
      button("Reset", "reset"),
      button("Brain mode", "cycle-mode"),
      button("Direct / Natural", "toggle-actuator"),
      button("A1 authority", "cycle-a1-authority"),
      button("Time scale", "cycle-time"),
      button("Capture incident", "capture-incident")
    );
    if (
      (window as Window & { __authorityA12p2BrowserBridge?: { enabled: true } })
        .__authorityA12p2BrowserBridge?.enabled
    ) {
      controlGrid.append(
        button("P2 Preview", "p2-preview"),
        button("P2 Arm singleton", "p2-arm-singleton"),
        button("P2 Disarm", "p2-disarm")
      );
    }
    const directiveGrid = document.createElement("div");
    directiveGrid.className = "debug-button-grid debug-directive-grid";
    directiveGrid.append(
      button("At will", "directive-at-will"),
      button("Follow me", "directive-follow"),
      button("Hold here", "directive-hold")
    );

    const scenarioGrid = document.createElement("div");
    scenarioGrid.className = "debug-button-grid debug-scenario-grid";
    scenarioGrid.append(
      button("Open", "scenario-open"),
      button("Pillar", "scenario-pillar"),
      button("Doorway", "scenario-doorway"),
      button("Head-on", "scenario-head-on"),
      button("Danger", "scenario-shared-danger")
    );

    const apparatusGrid = document.createElement("div");
    apparatusGrid.className = "debug-button-grid debug-apparatus-grid";
    apparatusGrid.append(
      button("Player intervene", "s1-player-intervene"),
      button("Companion intervene", "s1-companion-intervene"),
      button("S3 authority", "toggle-s3-authority")
    );
    const directiveTitle = document.createElement("h2");
    directiveTitle.textContent = "Player direction";
    const apparatusTitle = document.createElement("h2");
    apparatusTitle.textContent = "S1 apparatus";
    controls.append(
      controlTitle,
      controlGrid,
      directiveTitle,
      directiveGrid,
      scenarioGrid,
      apparatusTitle,
      apparatusGrid
    );

    controls.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const action = target.dataset.action as CausalPanelAction | undefined;
      if (action) onAction(action);
    });

    const layers = document.createElement("section");
    layers.className = "debug-section";
    const layerTitle = document.createElement("h2");
    layerTitle.textContent = "World layers";
    const layerGrid = document.createElement("div");
    layerGrid.className = "debug-layer-grid";
    for (const layer of Object.keys(DEFAULT_LAYERS) as WorldDebugLayer[]) {
      const label = document.createElement("label");
      label.className = "debug-layer-toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = this.layerValues.get(layer) ?? false;
      input.addEventListener("change", () => this.layerValues.set(layer, input.checked));
      const text = document.createElement("span");
      text.textContent = layerLabel(layer);
      label.append(input, text);
      layerGrid.append(label);
    }
    layers.append(layerTitle, layerGrid);

    this.sectionsRoot = document.createElement("div");
    this.sectionsRoot.className = "debug-dynamic-sections";

    const hint = document.createElement("section");
    hint.className = "debug-section debug-hint";
    hint.textContent = "Keyboard: WASD player · arrows manual companion · 5 Danger · E player intervene · Enter companion intervene · F1/F2/F3 experimental commands · M mode · N actuator · T time · P pause · O step · I incident · R reset.";

    this.content.append(controls, layers, this.sectionsRoot, hint);

    if (this.ownerSandboxSurface) {
      const ownerControls = document.createElement("section");
      ownerControls.className = "owner-review-controls";

      const ownerTitle = document.createElement("strong");
      ownerTitle.className = "owner-review-title";
      ownerTitle.textContent = "Movement review";

      const ownerHint = document.createElement("span");
      ownerHint.className = "owner-review-hint";
      ownerHint.textContent = "WASD to move";

      ownerControls.append(ownerTitle, ownerHint);

      const scenarios = document.createElement("div");
      scenarios.className = "owner-review-scenarios";
      scenarios.append(
        button("Open", "scenario-open"),
        button("Pillar", "scenario-pillar"),
        button("Door", "scenario-doorway"),
        button("Head-on", "scenario-head-on")
      );
      ownerControls.append(scenarios);

      const actions = document.createElement("div");
      actions.className = "owner-review-actions";
      const reset = button("Reset", "reset");
      const save = button("Save", "capture-incident");
      save.classList.add("owner-capture");
      save.title = "Capture this moment (keyboard: I)";
      save.setAttribute("aria-label", "Capture this moment");
      actions.append(reset, save);

      ownerControls.append(actions);
      ownerControls.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;
        const action = target.dataset.action as CausalPanelAction | undefined;
        if (action) onAction(action);
      });
      this.root.append(ownerControls);
    }

    this.root.append(header, this.content);
  }

  layerVisible(layer: WorldDebugLayer): boolean {
    if (this.ownerSandboxSurface) return false;
    return this.layerValues.get(layer) ?? false;
  }

  private createRenderedSection(sectionId: string): RenderedCausalPanelSection {
    const node = document.createElement("section");
    node.className = "debug-section debug-dynamic-section";

    const details = document.createElement("details");
    details.dataset.sectionId = sectionId;
    details.open = this.disclosureState.isOpen(sectionId);
    details.addEventListener("toggle", () => this.disclosureState.remember(sectionId, details.open));

    const summary = document.createElement("summary");
    const body = document.createElement("div");
    body.className = "debug-lines";
    details.append(summary, body);
    node.append(details);

    const rendered = { node, details, summary, body };
    this.renderedSections.set(sectionId, rendered);
    return rendered;
  }

  update(model: CausalPanelModel): void {
    this.title.textContent = model.title;
    this.subtitle.textContent = model.subtitle;
    this.badge.textContent = model.badge;
    this.badge.dataset.tone = model.badgeTone;

    const seen = new Set<string>();
    const desiredNodes: HTMLElement[] = [];

    for (const section of model.sections) {
      seen.add(section.id);
      const rendered = this.renderedSections.get(section.id) ?? this.createRenderedSection(section.id);
      rendered.node.dataset.tone = section.tone ?? "normal";
      rendered.summary.textContent = section.title;
      rendered.body.replaceChildren();
      for (const line of section.lines) {
        const row = document.createElement("div");
        row.textContent = line;
        rendered.body.append(row);
      }
      desiredNodes.push(rendered.node);
    }

    for (const [sectionId, rendered] of this.renderedSections) {
      if (seen.has(sectionId)) continue;
      this.disclosureState.remember(sectionId, rendered.details.open);
      rendered.node.remove();
      this.renderedSections.delete(sectionId);
    }

    for (let index = 0; index < desiredNodes.length; index += 1) {
      const desired = desiredNodes[index];
      if (!desired) continue;
      const current = this.sectionsRoot.children.item(index);
      if (current !== desired) this.sectionsRoot.insertBefore(desired, current);
    }
  }
}
