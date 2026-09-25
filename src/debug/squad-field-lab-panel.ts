import type { FieldLabSquadControlSnapshot, FieldLabMemberTarget } from "../squad/field-lab-squad-control";
import type {
  FieldLabExperimentDiff,
  FieldLabExperimentRecord,
  FieldLabExperimentSlot
} from "../squad/field-lab-experiment";
import type {
  FieldLabTrialComparison,
  FieldLabTrialMemberStatus,
  FieldLabTrialSlot,
  FieldLabTrialSummary
} from "../squad/field-lab-trial";
import type {
  CooperativeEpisodeActionOutcome,
  CooperativeEpisodeOutcome,
  CooperativeEpisodeSnapshot
} from "../world/cooperative-episode-contract";
import type {
  ActorSnapshot,
  FieldLabLayout,
  FieldLabSituation,
  SquadMemberId,
  WorldSnapshot
} from "../world/types";

export type FieldLabMemberStatus = FieldLabTrialMemberStatus;

export interface SquadFieldLabPanelState {
  snapshot: WorldSnapshot;
  situation: FieldLabSituation;
  layout: FieldLabLayout;
  control: FieldLabSquadControlSnapshot;
  focusedBody: ActorSnapshot;
  focusedTarget: FieldLabMemberTarget;
  memberStatuses: Readonly<Record<SquadMemberId, FieldLabMemberStatus>>;
  cooperativeEpisode: CooperativeEpisodeSnapshot | null;
  cooperativeEpisodeOutcome: CooperativeEpisodeOutcome;
  cooperativeActionOutcomes: readonly CooperativeEpisodeActionOutcome[];
  experiments: Readonly<Partial<Record<FieldLabExperimentSlot, FieldLabExperimentRecord | null>>>;
  experimentDiff: FieldLabExperimentDiff | null;
  trials: Readonly<Partial<Record<FieldLabTrialSlot, FieldLabTrialSummary>>>;
  activeTrial: { slot: FieldLabTrialSlot; frameCount: number } | null;
  trialComparison: FieldLabTrialComparison | null;
  recentEvents: readonly string[];
}

function fmt(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function signed(value: number, digits = 2): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function memberLabel(id: SquadMemberId): string {
  if (id === "companion") return "C1";
  if (id === "squad-2") return "C2";
  if (id === "squad-3") return "C3";
  return "C4";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

    const focusedDynamics = state.control.memberDynamics.find(
      (entry) => entry.memberId === state.control.focused
    );
    const effectiveResponse =
      focusedDynamics?.responsiveness ?? state.control.dynamics.responsiveness;
    const effectiveTolerance =
      focusedDynamics?.slotTolerance ?? state.control.dynamics.slotTolerance;
    const effectiveSlowdown =
      focusedDynamics?.slowdownRadius ?? state.control.dynamics.slowdownRadius;
    const dynamicsOverrides = [
      focusedDynamics?.responsiveness !== null ? "response" : null,
      focusedDynamics?.slotTolerance !== null ? "tolerance" : null,
      focusedDynamics?.slowdownRadius !== null ? "slowdown" : null
    ].filter((value): value is string => Boolean(value));

    this.content.innerHTML = `
      <section class="squad-field-debug-section">
        <h2>Group</h2>
        <div class="squad-field-debug-lines">
          <div>tick ${state.snapshot.tick} · scenario ${state.snapshot.scenarioId}</div>
          <div>situation ${state.situation} · layout ${state.layout} · obstacles ${state.snapshot.obstacles.length}</div>
          <div>real squad bodies ${state.control.activeMembers.length} · ${state.control.activeMembers.map(memberLabel).join(", ")}</div>
          <div>selected ${selected}</div>
          <div>focus ${memberLabel(state.control.focused)} · direct ${state.control.directControl ? "ON" : "off"}</div>
          <div>orientation ${Math.round(state.control.orientationRadians * 180 / Math.PI)}° · spacing ${fmt(state.control.dynamics.spacingScale)}</div>
          <div>group response ${fmt(state.control.dynamics.responsiveness)} · tolerance ${fmt(state.control.dynamics.slotTolerance)}m · slowdown ${fmt(state.control.dynamics.slowdownRadius)}m</div>
        </div>
      </section>
      <section class="squad-field-debug-section">
        <h2>Experiment A/B</h2>
        <div class="squad-field-debug-lines">
          <div>A ${state.experiments.A ? `${escapeHtml(state.experiments.A.label || "unlabelled")} · tick ${state.experiments.A.capturedAtTick}` : "empty"}</div>
          <div>B ${state.experiments.B ? `${escapeHtml(state.experiments.B.label || "unlabelled")} · tick ${state.experiments.B.capturedAtTick}` : "empty"}</div>
          <div>${state.experimentDiff
            ? state.experimentDiff.equal
              ? "A/B setup state identical"
              : `${state.experimentDiff.differences.length} differences · ${state.experimentDiff.categories.join(" · ")}`
            : "capture both setups for structural comparison"}</div>
          ${state.experimentDiff && !state.experimentDiff.equal
            ? state.experimentDiff.differences.slice(0, 14).map((difference) =>
                `<div><strong>${difference.category}</strong> · ${escapeHtml(difference.path)} · A ${escapeHtml(difference.a)} → B ${escapeHtml(difference.b)}</div>`
              ).join("")
            : ""}
          ${state.experimentDiff && state.experimentDiff.differences.length > 14
            ? `<div>+${state.experimentDiff.differences.length - 14} more differences</div>`
            : ""}
        </div>
      </section>
      <section class="squad-field-debug-section">
        <h2>Trial / Trace A/B</h2>
        <div class="squad-field-debug-lines">
          <div>A ${state.trials.A ? `${escapeHtml(state.trials.A.label)} · ${state.trials.A.frameCount}t` : "empty"} · B ${state.trials.B ? `${escapeHtml(state.trials.B.label)} · ${state.trials.B.frameCount}t` : "empty"}</div>
          <div>${state.activeTrial ? `recording ${state.activeTrial.slot} · ${state.activeTrial.frameCount} ticks` : "not recording"}</div>
          ${state.trialComparison
            ? state.trialComparison.members.map((member) => {
                const targetDelta = member.meanTargetErrorDelta === null
                  ? "n/a"
                  : `${signed(member.meanTargetErrorDelta)}m`;
                const a = state.trialComparison!.a.members.find(
                  (summary) => summary.memberId === member.memberId
                );
                const b = state.trialComparison!.b.members.find(
                  (summary) => summary.memberId === member.memberId
                );
                const eventTick = (value: number | null | undefined) =>
                  value === null || value === undefined ? "none" : `${value}t`;
                const targetError = (value: number | null | undefined) =>
                  value === null || value === undefined ? "n/a" : `${fmt(value)}m`;
                return (
                  `<div><strong>${memberLabel(member.memberId)}</strong> · Δpath ${signed(member.pathDistanceDelta)}m · Δtarget ${targetDelta} · ΔmotionErr ${signed(member.meanMotionErrorDelta)} · blocked ${signed(member.blockedTicksDelta, 0)}t / longest ${signed(member.longestBlockedRunDelta, 0)}t · contacts ${signed(member.contactTicksDelta, 0)}t · authority transitions ${signed(member.authorityTransitionsDelta, 0)} · order transitions ${signed(member.orderTransitionsDelta, 0)}</div>` +
                  `<div class="squad-field-debug-subline">${memberLabel(member.memberId)} exposure · first blocked A ${eventTick(a?.firstBlockedTickOffset)} → B ${eventTick(b?.firstBlockedTickOffset)} · first contact A ${eventTick(a?.firstContactTickOffset)} → B ${eventTick(b?.firstContactTickOffset)} · block episodes A ${a?.blockedEpisodes ?? 0} → B ${b?.blockedEpisodes ?? 0} · final A ${a?.finalStatus ?? "n/a"} / ${targetError(a?.finalTargetError)} → B ${b?.finalStatus ?? "n/a"} / ${targetError(b?.finalTargetError)}</div>`
                );
              }).join("")
            : "<div>run both traces to compare temporal outcomes</div>"}
        </div>
      </section>
      ${state.cooperativeEpisode ? `
      <section class="squad-field-debug-section" data-tone="${state.cooperativeEpisode.phase === "PRESSURING" ? "danger" : state.cooperativeEpisode.phase === "APPROACHING" ? "warning" : state.cooperativeEpisode.phase === "DRIVEN_BACK" ? "success" : "normal"}">
        <h2>Cooperative pressure</h2>
        <div class="squad-field-debug-lines">
          <div>phase ${state.cooperativeEpisode.phase} · cycle ${state.cooperativeEpisode.cycle + 1} · remaining ${state.cooperativeEpisode.phaseTicksRemaining}t</div>
          <div>this-step outcome ${state.cooperativeEpisodeOutcome} · remembered ${state.cooperativeEpisode.lastOutcome}</div>
          <div>repelled by ${state.cooperativeEpisode.repelledBy.join(", ") || "none"}</div>
          <div>attempts ${state.cooperativeActionOutcomes.length > 0
            ? state.cooperativeActionOutcomes.map((outcome) => `${outcome.actorId}:${outcome.status}@${fmt(outcome.distance)}m`).join(" · ")
            : "none this step"}</div>
        </div>
      </section>
      ` : ""}
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
          <div>dynamics response ${fmt(effectiveResponse)} · tolerance ${fmt(effectiveTolerance)}m · slowdown ${fmt(effectiveSlowdown)}m</div>
          <div>dynamics scope ${dynamicsOverrides.length > 0 ? `override: ${dynamicsOverrides.join(", ")}` : "inherit group defaults"}</div>
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
