import { describe, expect, it } from "vitest";
import {
  isOwnerReviewSearch,
  isTeammateReviewSearch,
  ownerReviewAllowsPanelAction,
  participantReviewKind,
  participantSafeSearch
} from "./owner-review-mode";

describe("Participant review boundaries", () => {
  it("preserves the historical owner=1 movement-review identity", () => {
    expect(isOwnerReviewSearch("?owner=1")).toBe(true);
    expect(isOwnerReviewSearch("?foo=bar&owner=1")).toBe(true);
    expect(isOwnerReviewSearch("?owner=0")).toBe(false);
  });

  it("retires the rejected teammate=1 hidden-debug contract on moving main", () => {
    expect(isTeammateReviewSearch("?teammate=1")).toBe(false);
    expect(participantReviewKind("?teammate=1")).toBeNull();
    expect(participantReviewKind("?owner=1&teammate=1")).toBe("owner");
  });

  it("sanitizes only the historical owner surface", () => {
    expect(participantSafeSearch("?owner=1&a1debug=1&a1p2=1")).toBe("?owner=1");
    expect(participantSafeSearch("?teammate=1&a1debug=1&a1p2=1"))
      .toBe("?teammate=1&a1debug=1&a1p2=1");
  });

  it("keeps historical movement-review controls frozen", () => {
    for (const action of [
      "reset","capture-incident","scenario-open","scenario-pillar","scenario-doorway","scenario-head-on"
    ] as const) expect(ownerReviewAllowsPanelAction(action)).toBe(true);

    for (const action of [
      "toggle-pause","single-step","cycle-mode","toggle-actuator","cycle-a1-authority",
      "cycle-time","directive-at-will","directive-follow","directive-hold",
      "p2-preview","p2-arm-singleton","p2-disarm"
    ] as const) expect(ownerReviewAllowsPanelAction(action)).toBe(false);
  });
});
