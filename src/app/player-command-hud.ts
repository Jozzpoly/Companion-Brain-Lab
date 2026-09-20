import type { PlayerDirectiveKind, PlayerDirectiveSnapshot } from "../brain/player-directive";

export interface PlayerCommandHudState {
  directive: PlayerDirectiveSnapshot;
}

const COMMANDS: ReadonlyArray<{ kind: PlayerDirectiveKind; key: string; label: string }> = [
  { kind: "AT_WILL", key: "F1", label: "At will" },
  { kind: "FOLLOW_ME", key: "F2", label: "Follow me" },
  { kind: "HOLD_HERE", key: "F3", label: "Hold here" }
];

export class PlayerCommandHud {
  private readonly root: HTMLElement;
  private readonly buttons = new Map<PlayerDirectiveKind, HTMLButtonElement>();
  private readonly status: HTMLElement;

  constructor(onDirective: (kind: PlayerDirectiveKind) => void) {
    const gamePane = document.querySelector<HTMLElement>("#game-pane");
    if (!gamePane) throw new Error("PlayerCommandHud requires #game-pane.");

    this.root = document.createElement("section");
    this.root.className = "player-command-hud";
    this.root.dataset.playerCommandHud = "true";
    this.root.setAttribute("aria-label", "Companion commands");

    const heading = document.createElement("div");
    heading.className = "player-command-heading";
    heading.textContent = "Companion";

    const commands = document.createElement("div");
    commands.className = "player-command-buttons";

    for (const command of COMMANDS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "player-command-button";
      button.dataset.directive = command.kind;
      button.setAttribute("aria-label", command.label);
      const key = document.createElement("kbd");
      key.textContent = command.key;
      const label = document.createElement("span");
      label.textContent = command.label;
      button.append(key, label);
      button.addEventListener("click", () => onDirective(command.kind));
      commands.append(button);
      this.buttons.set(command.kind, button);
    }

    this.status = document.createElement("div");
    this.status.className = "player-command-status";
    this.root.append(heading, commands, this.status);
    gamePane.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  update(state: PlayerCommandHudState): void {
    for (const [kind, button] of this.buttons) {
      const active = kind === state.directive.kind;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    const directiveLabel =
      COMMANDS.find((entry) => entry.kind === state.directive.kind)?.label ??
      state.directive.kind;
    this.status.textContent = `Order: ${directiveLabel}`;
  }
}
