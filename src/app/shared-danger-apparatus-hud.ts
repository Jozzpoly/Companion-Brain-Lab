import type { ActorId } from "../world/types";
import type {
  SharedDangerEpisodeOutcome,
  SharedDangerSnapshot,
  WorldActionOutcome
} from "../world/shared-danger-contract";

export interface SharedDangerHudState {
  active: boolean;
  danger: SharedDangerSnapshot | null;
  lastEpisodeOutcome: SharedDangerEpisodeOutcome;
  lastActionOutcomes: readonly WorldActionOutcome[];
}

export class SharedDangerApparatusHud {
  private readonly root: HTMLElement;
  private readonly state: HTMLElement;
  private readonly playerButton: HTMLButtonElement;
  private readonly companionButton: HTMLButtonElement;

  constructor(onIntervene: (actorId: ActorId) => void) {
    const gamePane = document.querySelector<HTMLElement>("#game-pane");
    if (!gamePane) throw new Error("SharedDangerApparatusHud requires #game-pane.");

    this.root = document.createElement("section");
    this.root.className = "shared-danger-hud";
    this.root.dataset.sharedDangerHud = "true";
    this.root.setAttribute("aria-label", "Shared danger apparatus");
    this.root.hidden = true;

    const heading = document.createElement("div");
    heading.className = "shared-danger-heading";
    heading.textContent = "Shared danger · MANUAL apparatus";

    const hint = document.createElement("div");
    hint.className = "shared-danger-hint";
    hint.textContent = "WASD player · arrows companion";

    const actions = document.createElement("div");
    actions.className = "shared-danger-actions";

    this.playerButton = document.createElement("button");
    this.playerButton.type = "button";
    this.playerButton.className = "shared-danger-action";
    this.playerButton.setAttribute("aria-label", "Player intervene");
    this.playerButton.innerHTML = "<kbd>E</kbd><span>Player intervene</span>";
    this.playerButton.addEventListener("click", () => onIntervene("player"));

    this.companionButton = document.createElement("button");
    this.companionButton.type = "button";
    this.companionButton.className = "shared-danger-action";
    this.companionButton.setAttribute("aria-label", "Companion intervene");
    this.companionButton.innerHTML = "<kbd>Enter</kbd><span>Companion intervene</span>";
    this.companionButton.addEventListener("click", () => onIntervene("companion"));

    actions.append(this.playerButton, this.companionButton);

    this.state = document.createElement("div");
    this.state.className = "shared-danger-state";

    this.root.append(heading, hint, actions, this.state);
    gamePane.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  update(value: SharedDangerHudState): void {
    this.setVisible(value.active);
    if (!value.active) return;

    const phase = value.danger?.phase ?? "UNAVAILABLE";
    const lastAction = value.lastActionOutcomes.at(-1);
    if (lastAction) {
      this.state.textContent =
        `${phase} · last ${lastAction.actorId} attempt: ${lastAction.status}`;
    } else if (value.lastEpisodeOutcome !== "NONE") {
      this.state.textContent = `${phase} · ${value.lastEpisodeOutcome}`;
    } else {
      this.state.textContent = phase;
    }

    const complete = phase === "COMPLETE";
    this.playerButton.disabled = complete;
    this.companionButton.disabled = complete;
  }
}
