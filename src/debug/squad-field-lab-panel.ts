import type { FieldLabSquadControlSnapshot, FieldLabMemberTarget } from "../squad/field-lab-squad-control";
import type { ActorSnapshot, SquadMemberId, WorldSnapshot } from "../world/types";

export type FieldLabMemberStatus = "DIRECT" | "MOVING" | "ARRIVED" | "BLOCKED" | "INVALID_TARGET";

export interface SquadFieldLabPanelState {
  snapshot: WorldSnapshot;
  control: FieldLabSquadControlSnapshot;
  focusedBody: ActorSnapshot;
  focusedTarget: FieldLabMemberTarget;
  memberStatuses: Readonly<Record<SquadMemberId, FieldLabMemberStatus>>;
  recentEvents: readonly string[];
}

function fmt(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function memberLabel(id: SquadMemberId): string {
  if (id === "companion") return "C1";
  if (id === "squad-2") return "C2";
  if (id === "squad-3") return "C3";
  return "C4";
}

export class SquadFieldLabPanel {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly collapse: HTMLButtonElement;
  private collapsed = false;

  constructor() {
    const root = document.querySelector<HTMLElement>("#debug-panel");
    if (!root) throw new Error("SquadFieldLabPanel requires #debug-panel.");
    this.root = root;
    this.root.className = "squad-field-debug";

    const header = document.createElement("div");
    header.className = "squad-field-debug-header";

    const heading = document.createElement("div");
    heading.className = "squad-field-debug-heading";
    heading.innerHTML = "<strong>Squad Field Debug</strong><span>group truth → focused companion truth</span>";

    this.collapse = document.createElement("button");
    this.collapse.type = "button";
    this.collapse.className = "squad-field-debug-collapse";
    this.collapse.textContent = "›";
    this.collapse.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.root.classList.toggle("is-collapsed", this.collapsed);
      this.collapse.textContent = this.collapsed ? "‹" : "›";
    });

    header.append(heading, this.collapse);
    this.content = document.createElement("div");
    this.content.className = "squad-field-debug-content";
    this.root.replaceChildren(header, this.content);
  }

  update(state: SquadFieldLabPanelState): void {
    if (this.collapsed) return;
    const selected = state.control.selected.map(memberLabel).join(" + ");
    const assignmentLines = state.control.assignments
      .filter((assignment) => state.control.activeMembers.includes(assignment.memberId))
      .map((assignment) => {
        const anchor = assignment.worldAnchor
          ? `@${fmt(assignment.worldAnchor.x)},${fmt(assignment.worldAnchor.y)}`
          : "@PLAYER";
        return `${memberLabel(assignment.memberId)} ${assignment.mode} ${anchor} · ${state.memberStatuses[assignment.memberId]}`;
      })
      .join("<br>");

    const contacts = state.focusedBody.contacts.length > 0
      ? state.focusedBody.contacts.map((contact) => `${contact.with}×${contact.contactCount}`).join(", ")
      : "none";

    const target = state.focusedTarget.target
      ? `${fmt(state.focusedTarget.target.x)}, ${fmt(state.focusedTarget.target.y)}`
      : "DIRECT / no formation target";

    const distance = state.focusedTarget.target
      ? Math.hypot(
          state.focusedTarget.target.x - state.focusedBody.position.x,
          state.focusedTarget.target.y - state.focusedBody.position.y
        )
      : null;

    this.content.innerHTML = `
      <section class="squad-field-debug-section">
        <h2>Group</h2>
        <div class="squad-field-debug-lines">
          <div>tick ${state.snapshot.tick} · scenario ${state.snapshot.scenarioId}</div>
          <div>real squad bodies ${state.control.activeMembers.length} · ${state.control.activeMembers.map(memberLabel).join(", ")}</div>
          <div>selected ${selected}</div>
          <div>focus ${memberLabel(state.control.focused)} · direct ${state.control.directControl ? "ON" : "off"}</div>
          <div>orientation ${Math.round(state.control.orientationRadians * 180 / Math.PI)}° · spacing ${fmt(state.control.dynamics.spacingScale)}</div>
          <div>response ${fmt(state.control.dynamics.responsiveness)} · tolerance ${fmt(state.control.dynamics.slotTolerance)}m</div>
        </div>
      </section>
      <section class="squad-field-debug-section">
        <h2>Assignments</h2>
        <div class="squad-field-debug-lines">${assignmentLines}</div>
      </section>
      <section class="squad-field-debug-section is-focus">
        <h2>Focused · ${memberLabel(state.control.focused)}</h2>
        <div class="squad-field-debug-lines">
          <div>authority ${state.focusedTarget.authority} · order ${state.focusedTarget.orderMode} · ${state.memberStatuses[state.control.focused]}</div>
          <div>body ${fmt(state.focusedBody.position.x)}, ${fmt(state.focusedBody.position.y)}</div>
          <div>target ${target}${distance === null ? "" : ` · distance ${fmt(distance)}m`}</div>
          <div>slot local ${fmt(state.focusedTarget.localSlot.x)}, ${fmt(state.focusedTarget.localSlot.y)}</div>
          <div>requested ${fmt(state.focusedBody.requestedVelocity.x)}, ${fmt(state.focusedBody.requestedVelocity.y)}</div>
          <div>actual ${fmt(state.focusedBody.actualVelocity.x)}, ${fmt(state.focusedBody.actualVelocity.y)}</div>
          <div>motion error ${fmt(state.focusedBody.motionError)} · contacts ${contacts}</div>
        </div>
      </section>
      <section class="squad-field-debug-section">
        <h2>Recent transitions</h2>
        <div class="squad-field-debug-lines">
          ${state.recentEvents.length > 0
            ? [...state.recentEvents].slice(-10).reverse().map((entry) => `<div>${entry}</div>`).join("")
            : "<div>none</div>"}
        </div>
      </section>
      <div class="squad-field-debug-foot">
        Debug is selection-aware by design. World overlays show current spatial truth; this panel explains focused provenance.
      </div>
    `;
  }
}
