import type { StageBPartnerAction } from "./stage-b-partner";
import type { Vec2 } from "../world/types";

export type PlayerDirectiveKind = "AT_WILL" | "FOLLOW_ME" | "HOLD_HERE";
export type DirectiveCompatibility = "UNCONSTRAINED" | "COMPATIBLE" | "BLOCKED";

export const FOLLOW_AUTONOMY_RADIUS = 3.5;
export const HOLD_AUTONOMY_RADIUS = 2.75;

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
  compatibility: DirectiveCompatibility;
  constraintDistance: number | null;
  constraintLimit: number | null;
  reason: string;
}

function cloneDirective(value: PlayerDirectiveSnapshot): PlayerDirectiveSnapshot {
  return {
    ...value,
    holdAnchor: value.holdAnchor ? { ...value.holdAnchor } : null
  };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cloneProposal(value: StageBPartnerAction): StageBPartnerAction {
  return {
    ...value,
    target: value.target ? { ...value.target } : null
  };
}

function autonomousThreatWithin(
  proposal: StageBPartnerAction,
  anchor: Vec2,
  limit: number
): { compatible: boolean; distance: number | null } {
  if (proposal.kind !== "RESPOND_TO_THREAT" || !proposal.target) {
    return { compatible: false, distance: null };
  }
  const d = distance(proposal.target, anchor);
  return { compatible: d <= limit, distance: d };
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
  playerPosition: Vec2;
}): CompanionArbitrationDecision {
  const directive = cloneDirective(input.directive);
  const autonomousProposal = cloneProposal(input.autonomousProposal);

  if (directive.kind === "FOLLOW_ME") {
    const compatibility = autonomousThreatWithin(
      autonomousProposal,
      input.playerPosition,
      FOLLOW_AUTONOMY_RADIUS
    );

    if (compatibility.compatible && autonomousProposal.target) {
      return {
        source: "AUTONOMY",
        selectedKind: "RESPOND_TO_THREAT",
        objectiveKey: autonomousProposal.objectiveKey ?? "autonomy:threat",
        target: { ...autonomousProposal.target },
        directive,
        autonomousProposal,
        compatibility: "COMPATIBLE",
        constraintDistance: compatibility.distance,
        constraintLimit: FOLLOW_AUTONOMY_RADIUS,
        reason:
          "FOLLOW_ME acts as a leash rather than an autonomy kill-switch: the threat is inside the player-local response envelope, so local protection is compatible with the directive"
      };
    }

    return {
      source: "PLAYER_DIRECTIVE",
      selectedKind: "FOLLOW_PLAYER",
      objectiveKey: "player-directive:follow",
      target: { ...input.relationshipTarget },
      directive,
      autonomousProposal,
      compatibility:
        autonomousProposal.kind === "RESPOND_TO_THREAT" ? "BLOCKED" : "COMPATIBLE",
      constraintDistance: compatibility.distance,
      constraintLimit:
        autonomousProposal.kind === "RESPOND_TO_THREAT" ? FOLLOW_AUTONOMY_RADIUS : null,
      reason:
        autonomousProposal.kind === "RESPOND_TO_THREAT"
          ? "FOLLOW_ME blocks this autonomous response because the proposed threat lies outside the player-local leash; local movement/recovery still owns execution"
          : "FOLLOW_ME preserves the player relationship while leaving local movement/recovery autonomous inside that responsibility"
    };
  }

  if (directive.kind === "HOLD_HERE") {
    if (!directive.holdAnchor) {
      throw new Error("HOLD_HERE requires the captured companion position from the issue tick.");
    }

    const compatibility = autonomousThreatWithin(
      autonomousProposal,
      directive.holdAnchor,
      HOLD_AUTONOMY_RADIUS
    );

    if (compatibility.compatible && autonomousProposal.target) {
      return {
        source: "AUTONOMY",
        selectedKind: "RESPOND_TO_THREAT",
        objectiveKey: autonomousProposal.objectiveKey ?? "autonomy:threat",
        target: { ...autonomousProposal.target },
        directive,
        autonomousProposal,
        compatibility: "COMPATIBLE",
        constraintDistance: compatibility.distance,
        constraintLimit: HOLD_AUTONOMY_RADIUS,
        reason:
          "HOLD_HERE defines an area of responsibility rather than freezing cognition: the threat entered the hold envelope, so local response is compatible with the directive"
      };
    }

    return {
      source: "PLAYER_DIRECTIVE",
      selectedKind: "HOLD_POSITION",
      objectiveKey: `player-directive:hold:${directive.issuedTick}`,
      target: { ...directive.holdAnchor },
      directive,
      autonomousProposal,
      compatibility:
        autonomousProposal.kind === "RESPOND_TO_THREAT" ? "BLOCKED" : "COMPATIBLE",
      constraintDistance: compatibility.distance,
      constraintLimit:
        autonomousProposal.kind === "RESPOND_TO_THREAT" ? HOLD_AUTONOMY_RADIUS : null,
      reason:
        autonomousProposal.kind === "RESPOND_TO_THREAT"
          ? "HOLD_HERE blocks this autonomous response because the proposed threat lies outside the held responsibility envelope"
          : "HOLD_HERE preserves the captured responsibility point while local movement/recovery remains autonomous inside it"
    };
  }

  if (autonomousProposal.kind === "RESPOND_TO_THREAT" && autonomousProposal.target) {
    return {
      source: "AUTONOMY",
      selectedKind: "RESPOND_TO_THREAT",
      objectiveKey: autonomousProposal.objectiveKey ?? "autonomy:threat",
      target: { ...autonomousProposal.target },
      directive,
      autonomousProposal,
      compatibility: "UNCONSTRAINED",
      constraintDistance: null,
      constraintLimit: null,
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
    compatibility: "UNCONSTRAINED",
    constraintDistance: null,
    constraintLimit: null,
    reason:
      "AT_WILL leaves responsibility selection to the local brain; with no higher-priority proposal it maintains the player relationship"
  };
}
