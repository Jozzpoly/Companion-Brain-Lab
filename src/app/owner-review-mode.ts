import type { CausalPanelAction } from "../debug/causal-panel";

export const OWNER_REVIEW_QUERY_KEY = "owner";
export const OWNER_REVIEW_QUERY_VALUE = "1";

const OWNER_REVIEW_PANEL_ACTIONS = new Set<CausalPanelAction>([
  "reset",
  "capture-incident",
  "scenario-open",
  "scenario-pillar",
  "scenario-doorway",
  "scenario-head-on"
]);

export function isOwnerReviewSearch(search: string): boolean {
  return new URLSearchParams(search).get(OWNER_REVIEW_QUERY_KEY) === OWNER_REVIEW_QUERY_VALUE;
}

/**
 * Owner review is a participant surface, not a composable research mode.
 * When it is active, strip every other query flag so debug/P2/fault apparatus
 * cannot be accidentally armed by a copied or hand-edited URL.
 */
export function participantSafeSearch(search: string): string {
  return isOwnerReviewSearch(search)
    ? `?${OWNER_REVIEW_QUERY_KEY}=${OWNER_REVIEW_QUERY_VALUE}`
    : search;
}

export function ownerReviewAllowsPanelAction(action: CausalPanelAction): boolean {
  return OWNER_REVIEW_PANEL_ACTIONS.has(action);
}
