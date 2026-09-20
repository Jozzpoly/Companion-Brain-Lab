import type { CausalPanelAction } from "../debug/causal-panel";

export const OWNER_REVIEW_QUERY_KEY = "owner";
export const OWNER_REVIEW_QUERY_VALUE = "1";
export const TEAMMATE_REVIEW_QUERY_KEY = "teammate";
export const TEAMMATE_REVIEW_QUERY_VALUE = "1";

export type ParticipantReviewKind = "owner" | null;

const OWNER_REVIEW_PANEL_ACTIONS = new Set<CausalPanelAction>([
  "reset",
  "capture-incident",
  "scenario-open",
  "scenario-pillar",
  "scenario-doorway",
  "scenario-head-on"
]);

export function participantReviewKind(search: string): ParticipantReviewKind {
  const params = new URLSearchParams(search);
  return params.get(OWNER_REVIEW_QUERY_KEY) === OWNER_REVIEW_QUERY_VALUE ? "owner" : null;
}

export function isOwnerReviewSearch(search: string): boolean {
  return participantReviewKind(search) === "owner";
}

/** Historical compatibility marker only; moving main no longer hides the workbench for teammate=1. */
export function isTeammateReviewSearch(_search: string): boolean {
  return false;
}

/** Only the frozen historical owner=1 movement-review identity strips research flags. */
export function participantSafeSearch(search: string): string {
  return participantReviewKind(search) === "owner"
    ? `?${OWNER_REVIEW_QUERY_KEY}=${OWNER_REVIEW_QUERY_VALUE}`
    : search;
}

export function ownerReviewAllowsPanelAction(action: CausalPanelAction): boolean {
  return OWNER_REVIEW_PANEL_ACTIONS.has(action);
}
