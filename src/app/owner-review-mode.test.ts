import { describe, expect, it } from "vitest";
import {
  isOwnerReviewSearch,
  ownerReviewAllowsPanelAction,
  participantSafeSearch
} from "./owner-review-mode";

describe("Owner movement-review boundary", () => {
  it("recognizes only owner=1 as participant review mode", () => {
    expect(isOwnerReviewSearch("?owner=1")).toBe(true);
    expect(isOwnerReviewSearch("?foo=bar&owner=1")).toBe(true);
    expect(isOwnerReviewSearch("?owner=0")).toBe(false);
    expect(isOwnerReviewSearch("")).toBe(false);
  });

  it("strips composable research and fault flags from Owner review URLs", () => {
    expect(
      participantSafeSearch("?owner=1&a1debug=1&a1p2=1&foundationFaultProbe=1&semanticpush=1")
    ).toBe("?owner=1");
    expect(participantSafeSearch("?a1debug=1&a1p2=1")).toBe("?a1debug=1&a1p2=1");
  });

  it("allows only participant-safe panel actions", () => {
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
});
