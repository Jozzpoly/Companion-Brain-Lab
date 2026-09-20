import type { SharedPressureSnapshot } from "../world/shared-pressure";
import type { Vec2 } from "../world/types";

export type StageBPartnerActionKind = "REGROUP" | "RESPOND_TO_THREAT";

export interface StageBPartnerAction {
  kind: StageBPartnerActionKind;
  objectiveKey: string | null;
  target: Vec2 | null;
  reason: string;
}

export function decideStageBPartnerAction(
  pressure: SharedPressureSnapshot | null
): StageBPartnerAction {
  if (pressure?.enabled && pressure.phase === "ACTIVE" && pressure.target) {
    return {
      kind: "RESPOND_TO_THREAT",
      objectiveKey: `stage-b-pressure:${pressure.cycle}`,
      target: { ...pressure.target },
      reason: "active shared-world threat has priority over ordinary relationship positioning"
    };
  }

  return {
    kind: "REGROUP",
    objectiveKey: null,
    target: null,
    reason: pressure?.enabled
      ? "no active shared threat; preserve the ordinary player-companion relationship"
      : "Stage B pressure is not active in this fixture"
  };
}
