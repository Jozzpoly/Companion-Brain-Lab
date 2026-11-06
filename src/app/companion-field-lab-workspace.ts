/**
 * World-first responsive work surface for the existing Field Lab.
 *
 * The current simulation, its full research HUD and the causal microscope
 * remain the SAME DOM/runtime. No secondary game shell or miniature debug UI.
 * Below the practical three-column width, the Owner chooses which tools to
 * inspect in an overlay; closing them gives the World its whole viewport.
 */
export function installCompanionFieldLabWorkspace(): () => void {
  const shellNode = document.querySelector<HTMLElement>("#lab-shell");
  const hudNode = document.querySelector<HTMLElement>(".squad-field-lab-hud");
  const debugNode = document.querySelector<HTMLElement>("#debug-panel.squad-field-debug");
  if (!shellNode || !hudNode || !debugNode) {
    throw new Error("Companion workspace requires the real Field Lab HUD and microscope");
  }
  // Non-null capture across event-handler closures (strict TypeScript).
  const shell: HTMLElement = shellNode;
  const hud: HTMLElement = hudNode;
  const debug: HTMLElement = debugNode;

  const originalHudId = hud.id;
  if (!hud.id) hud.id = "companion-squad-tools";
  shell.classList.add("companion-world-first");

  const nav = document.createElement("nav");
  nav.className = "companion-world-tools";
  nav.setAttribute("aria-label", "Companion Field Lab workspace");

  function button(kind: "squad" | "microscope", label: string, controls: string) {
    const element = document.createElement("button");
    element.type = "button";
    element.dataset.workspaceDrawer = kind;
    element.className = "companion-world-tools-button";
    element.textContent = label;
    element.setAttribute("aria-controls", controls);
    element.setAttribute("aria-expanded", "false");
    return element;
  }
  const squadToggle = button("squad", "Squad tools", hud.id);
  const microscopeToggle = button("microscope", "Causal microscope", debug.id);
  nav.append(squadToggle, microscopeToggle);
  shell.append(nav);

  let active: "squad" | "microscope" | null = null;
  function setActive(next: "squad" | "microscope" | null) {
    active = next;
    hud.classList.toggle("is-workspace-open", active === "squad");
    debug.classList.toggle("is-workspace-open", active === "microscope");
    squadToggle.setAttribute("aria-expanded", String(active === "squad"));
    microscopeToggle.setAttribute("aria-expanded", String(active === "microscope"));
    squadToggle.classList.toggle("is-active", active === "squad");
    microscopeToggle.classList.toggle("is-active", active === "microscope");
    if (active === "microscope" && debug.classList.contains("is-collapsed")) {
      // Preserve the established microscope control, don't manufacture a
      // second debug representation or silently discard collapsed state.
      debug.querySelector<HTMLButtonElement>(".squad-field-debug-collapse")?.click();
    }
  }
  const onSquad = () => setActive(active === "squad" ? null : "squad");
  const onMicroscope = () => setActive(active === "microscope" ? null : "microscope");
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !active ||
        !window.matchMedia("(max-width: 1200px)").matches) return;
    event.preventDefault();
    setActive(null);
  };
  squadToggle.addEventListener("click", onSquad);
  microscopeToggle.addEventListener("click", onMicroscope);
  document.addEventListener("keydown", onKey);

  return () => {
    document.removeEventListener("keydown", onKey);
    squadToggle.removeEventListener("click", onSquad);
    microscopeToggle.removeEventListener("click", onMicroscope);
    nav.remove();
    shell.classList.remove("companion-world-first");
    hud.classList.remove("is-workspace-open");
    debug.classList.remove("is-workspace-open");
    hud.id = originalHudId;
  };
}
