export type CausalPanelAction =
  | "toggle-pause"
  | "single-step"
  | "reset"
  | "cycle-mode"
  | "toggle-actuator"
  | "cycle-time"
  | "capture-incident"
  | "scenario-open"
  | "scenario-pillar"
  | "scenario-doorway"
  | "scenario-head-on";

export type WorldDebugLayer =
  | "relationship"
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

const DEFAULT_LAYERS: Readonly<Record<WorldDebugLayer, boolean>> = {
  relationship: false,
  route: true,
  spatial: true,
  motion: true,
  trails: true,
  contacts: true
};

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
  if (layer === "route") return "Route";
  if (layer === "spatial") return "Spatial";
  if (layer === "motion") return "Motion";
  if (layer === "trails") return "Trails";
  return "Contacts";
}

export class CausalPanel {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly sectionsRoot: HTMLElement;
  private readonly layerValues = new Map<WorldDebugLayer, boolean>();
  private collapsed = false;

  constructor(onAction: (action: CausalPanelAction) => void) {
    const root = document.querySelector<HTMLElement>("#debug-panel");
    if (!root) throw new Error("R1 CausalPanel requires #debug-panel.");
    this.root = root;
    this.root.replaceChildren();

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
    collapse.textContent = "‹";
    collapse.title = "Collapse debug panel";
    collapse.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.root.classList.toggle("is-collapsed", this.collapsed);
      collapse.textContent = this.collapsed ? "›" : "‹";
      collapse.title = this.collapsed ? "Expand debug panel" : "Collapse debug panel";
    });

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
      button("Time scale", "cycle-time"),
      button("Capture incident", "capture-incident")
    );
    const scenarioGrid = document.createElement("div");
    scenarioGrid.className = "debug-button-grid debug-scenario-grid";
    scenarioGrid.append(
      button("Open", "scenario-open"),
      button("Pillar", "scenario-pillar"),
      button("Doorway", "scenario-doorway"),
      button("Head-on", "scenario-head-on")
    );
    controls.append(controlTitle, controlGrid, scenarioGrid);

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
    hint.textContent = "Keyboard remains available: WASD · M mode · N actuator · T time · P pause · O step · I incident · R reset.";

    this.content.append(controls, layers, this.sectionsRoot, hint);
    this.root.append(header, this.content);
  }

  layerVisible(layer: WorldDebugLayer): boolean {
    return this.layerValues.get(layer) ?? false;
  }

  update(model: CausalPanelModel): void {
    this.title.textContent = model.title;
    this.subtitle.textContent = model.subtitle;
    this.badge.textContent = model.badge;
    this.badge.dataset.tone = model.badgeTone;

    this.sectionsRoot.replaceChildren();
    for (const section of model.sections) {
      const node = document.createElement("section");
      node.className = "debug-section debug-dynamic-section";
      node.dataset.tone = section.tone ?? "normal";
      const details = document.createElement("details");
      details.open = section.id === "run" || section.id === "recovery" || section.id === "route" || section.id === "motion";
      const summary = document.createElement("summary");
      summary.textContent = section.title;
      const body = document.createElement("div");
      body.className = "debug-lines";
      for (const line of section.lines) {
        const row = document.createElement("div");
        row.textContent = line;
        body.append(row);
      }
      details.append(summary, body);
      node.append(details);
      this.sectionsRoot.append(node);
    }
  }
}
