import { describe, expect, it } from "vitest";
import {
  isOwnerReviewSearch,
  isTeammateReviewSearch,
  ownerReviewAllowsPanelAction,
  participantReviewKind,
  participantSafeSearch,
  teammateReviewAllowsPanelAction
} from "./owner-review-mode";

describe("Participant review boundaries", () => {
  it("preserves the historical owner=1 movement-review identity", () => {
    expect(isOwnerReviewSearch("?owner=1")).toBe(true);
    expect(isOwnerReviewSearch("?foo=bar&owner=1")).toBe(true);
    expect(isOwnerReviewSearch("?owner=0")).toBe(false);
    expect(isOwnerReviewSearch("")).toBe(false);
  });

  it("recognizes teammate=1 as the separate Stage B participant stimulus", () => {
    expect(isTeammateReviewSearch("?teammate=1")).toBe(true);
    expect(isTeammateReviewSearch("?foo=bar&teammate=1")).toBe(true);
    expect(isTeammateReviewSearch("?teammate=0")).toBe(false);
    expect(participantReviewKind("?owner=1&teammate=1")).toBe("teammate");
    expect(isOwnerReviewSearch("?owner=1&teammate=1")).toBe(false);
  });

  it("strips composable research and fault flags from both participant URLs", () => {
    expect(
      participantSafeSearch("?owner=1&a1debug=1&a1p2=1&foundationFaultProbe=1&semanticpush=1")
    ).toBe("?owner=1");
    expect(
      participantSafeSearch("?teammate=1&a1debug=1&a1p2=1&foundationFaultProbe=1&semanticpush=1")
    ).toBe("?teammate=1");
    expect(participantSafeSearch("?a1debug=1&a1p2=1")).toBe("?a1debug=1&a1p2=1");
  });

  it("keeps the historical movement-review controls unchanged", () => {
    expect(ownerReviewAllowsPanelAction("reset")).toBe(true);
    expect(ownerReviewAllowsPanelAction("capture-incident")).toBe(true);
    expect(ownerReviewAllowsPanelAction("scenario-open")).toBe(true);
    expect(ownerReviewAllowsPanelAction("scenario-pillar")).toBe(true);
    expect(ownerReviewAllowsPanelAction("scenario-doorway")).toBe(true);
    expect(ownerReviewAllowsPanelAction("scenario-head-on")).toBe(true);

    expect(ownerReviewAllowsPanelAction("toggle-pause")).toBe(false);
    expect(ownerReviewAllowsPanelAction("single-step")).toBe(false);
    expect(ownerReviewAllowsPanelAction("cycle-mode")).toBe(false);
    expect(ownerReviewAllowsPanelAction("toggle-actuator")).toBe(false);
    expect(ownerReviewAllowsPanelAction("cycle-a1-authority")).toBe(false);
    expect(ownerReviewAllowsPanelAction("cycle-time")).toBe(false);
    expect(ownerReviewAllowsPanelAction("p2-preview")).toBe(false);
    expect(ownerReviewAllowsPanelAction("p2-arm-singleton")).toBe(false);
    expect(ownerReviewAllowsPanelAction("p2-disarm")).toBe(false);
  });

  it("keeps the teammate slice on one stimulus: Reset and Save only", () => {
    expect(teammateReviewAllowsPanelAction("reset")).toBe(true);
    expect(teammateReviewAllowsPanelAction("capture-incident")).toBe(true);

    for (const action of [
      "scenario-open",
      "scenario-pillar",
      "scenario-doorway",
      "scenario-head-on",
      "toggle-pause",
      "single-step",
      "cycle-mode",
      "toggle-actuator",
      "cycle-a1-authority",
      "cycle-time",
      "p2-preview",
      "p2-arm-singleton",
      "p2-disarm"
    ] as const) {
      expect(teammateReviewAllowsPanelAction(action)).toBe(false);
    }
  });
});
