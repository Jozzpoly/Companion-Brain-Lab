import type { CausalPanelAction } from "../debug/causal-panel";

export const OWNER_REVIEW_QUERY_KEY = "owner";
export const OWNER_REVIEW_QUERY_VALUE = "1";
export const TEAMMATE_REVIEW_QUERY_KEY = "teammate";
export const TEAMMATE_REVIEW_QUERY_VALUE = "1";

export type ParticipantReviewKind = "owner" | "teammate" | null;

const OWNER_REVIEW_PANEL_ACTIONS = new Set<CausalPanelAction>([
  "reset",
  "capture-incident",
  "scenario-open",
  "scenario-pillar",
  "scenario-doorway",
  "scenario-head-on"
]);

const TEAMMATE_REVIEW_PANEL_ACTIONS = new Set<CausalPanelAction>([
  "reset",
  "capture-incident"
]);

export function participantReviewKind(search: string): ParticipantReviewKind {
  const params = new URLSearchParams(search);
  // The current teammate slice wins if somebody accidentally combines both
  // participant flags. This keeps the newer stimulus isolated from the older
  // movement-review surface rather than composing them.
  if (params.get(TEAMMATE_REVIEW_QUERY_KEY) === TEAMMATE_REVIEW_QUERY_VALUE) {
    return "teammate";
  }
  if (params.get(OWNER_REVIEW_QUERY_KEY) === OWNER_REVIEW_QUERY_VALUE) {
    return "owner";
  }
  return null;
}

export function isOwnerReviewSearch(search: string): boolean {
  return participantReviewKind(search) === "owner";
}

export function isTeammateReviewSearch(search: string): boolean {
  return participantReviewKind(search) === "teammate";
}

/**
 * Participant reviews are immutable stimuli, not composable research modes.
 * Strip every other query flag so debug/P2/fault apparatus cannot be
 * accidentally armed by a copied or hand-edited participant URL.
 */
export function participantSafeSearch(search: string): string {
  const kind = participantReviewKind(search);
  if (kind === "owner") {
    return `?${OWNER_REVIEW_QUERY_KEY}=${OWNER_REVIEW_QUERY_VALUE}`;
  }
  if (kind === "teammate") {
    return `?${TEAMMATE_REVIEW_QUERY_KEY}=${TEAMMATE_REVIEW_QUERY_VALUE}`;
  }
  return search;
}

export function ownerReviewAllowsPanelAction(action: CausalPanelAction): boolean {
  return OWNER_REVIEW_PANEL_ACTIONS.has(action);
}

export function teammateReviewAllowsPanelAction(action: CausalPanelAction): boolean {
  return TEAMMATE_REVIEW_PANEL_ACTIONS.has(action);
}
