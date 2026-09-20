import type { StageBPartnerAction } from "./stage-b-partner";
import type { Vec2 } from "../world/types";

export type PlayerDirectiveKind = "AT_WILL" | "FOLLOW_ME" | "HOLD_HERE";

export interface PlayerDirectiveSnapshot {
  kind: PlayerDirectiveKind;
  issuedTick: number;
  holdAnchor: Vec2 | null;
}

export type CompanionPublicActionKind =
  | StageBPartnerAction["kind"]
  | "FOLLOW_PLAYER"
  | "HOLD_POSITION";

export type CompanionArbitrationSource = "AUTONOMY" | "PLAYER_DIRECTIVE";

export interface CompanionArbitrationDecision {
  source: CompanionArbitrationSource;
  selectedKind: CompanionPublicActionKind;
  objectiveKey: string;
  target: Vec2;
  directive: PlayerDirectiveSnapshot;
  autonomousProposal: StageBPartnerAction;
  reason: string;
}

function cloneDirective(value: PlayerDirectiveSnapshot): PlayerDirectiveSnapshot {
  return {
    ...value,
    holdAnchor: value.holdAnchor ? { ...value.holdAnchor } : null
  };
}

export class PlayerDirectiveRuntime {
  private current: PlayerDirectiveSnapshot = {
    kind: "AT_WILL",
    issuedTick: 0,
    holdAnchor: null
  };

  snapshot(): PlayerDirectiveSnapshot {
    return cloneDirective(this.current);
  }

  reset(tick = 0): PlayerDirectiveSnapshot {
    this.current = {
      kind: "AT_WILL",
      issuedTick: tick,
      holdAnchor: null
    };
    return this.snapshot();
  }

  issue(
    kind: PlayerDirectiveKind,
    tick: number,
    companionPosition: Vec2
  ): PlayerDirectiveSnapshot {
    this.current = {
      kind,
      issuedTick: tick,
      holdAnchor: kind === "HOLD_HERE" ? { ...companionPosition } : null
    };
    return this.snapshot();
  }
}

export function arbitrateCompanionAction(input: {
  directive: PlayerDirectiveSnapshot;
  autonomousProposal: StageBPartnerAction;
  relationshipTarget: Vec2;
}): CompanionArbitrationDecision {
  const directive = cloneDirective(input.directive);
  const autonomousProposal: StageBPartnerAction = {
    ...input.autonomousProposal,
    target: input.autonomousProposal.target
      ? { ...input.autonomousProposal.target }
      : null
  };

  if (directive.kind === "FOLLOW_ME") {
    return {
      source: "PLAYER_DIRECTIVE",
      selectedKind: "FOLLOW_PLAYER",
      objectiveKey: "player-directive:follow",
      target: { ...input.relationshipTarget },
      directive,
      autonomousProposal,
      reason:
        autonomousProposal.kind === "RESPOND_TO_THREAT"
          ? "FOLLOW_ME currently outranks the autonomous threat-response proposal; local movement/recovery still owns execution"
          : "FOLLOW_ME constrains the live objective to the player relationship while local movement/recovery owns execution"
    };
  }

  if (directive.kind === "HOLD_HERE") {
    if (!directive.holdAnchor) {
      throw new Error("HOLD_HERE requires the captured companion position from the issue tick.");
    }
    return {
      source: "PLAYER_DIRECTIVE",
      selectedKind: "HOLD_POSITION",
      objectiveKey: `player-directive:hold:${directive.issuedTick}`,
      target: { ...directive.holdAnchor },
      directive,
      autonomousProposal,
      reason:
        autonomousProposal.kind === "RESPOND_TO_THREAT"
          ? "HOLD_HERE currently outranks the autonomous threat-response proposal; the companion may solve movement locally but may not abandon the held responsibility"
          : "HOLD_HERE preserves the captured responsibility point while local movement/recovery owns execution"
    };
  }

  if (
    autonomousProposal.kind === "RESPOND_TO_THREAT" &&
    autonomousProposal.target
  ) {
    return {
      source: "AUTONOMY",
      selectedKind: "RESPOND_TO_THREAT",
      objectiveKey: autonomousProposal.objectiveKey ?? "autonomy:threat",
      target: { ...autonomousProposal.target },
      directive,
      autonomousProposal,
      reason:
        "AT_WILL leaves responsibility selection to the local brain; the active threat proposal becomes the live objective"
    };
  }

  return {
    source: "AUTONOMY",
    selectedKind: "REGROUP",
    objectiveKey: "autonomy:regroup",
    target: { ...input.relationshipTarget },
    directive,
    autonomousProposal,
    reason:
      "AT_WILL leaves responsibility selection to the local brain; with no higher-priority proposal it maintains the player relationship"
  };
}
