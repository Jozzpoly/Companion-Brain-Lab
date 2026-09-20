export type BuildIdentityState = "PINNED_SOURCE_SHA" | "UNPINNED_LOCAL";

export interface CompanionBuildIdentity {
  sourceSha: string | null;
  state: BuildIdentityState;
}

export function buildCompanionBuildIdentity(
  sourceSha: string | undefined
): CompanionBuildIdentity {
  const normalized = sourceSha?.trim() ?? "";
  return normalized.length > 0
    ? { sourceSha: normalized, state: "PINNED_SOURCE_SHA" }
    : { sourceSha: null, state: "UNPINNED_LOCAL" };
}

const viteEnv = (import.meta as ImportMeta & {
  env?: { VITE_SOURCE_SHA?: string };
}).env;

export const CURRENT_COMPANION_BUILD_IDENTITY = buildCompanionBuildIdentity(
  viteEnv?.VITE_SOURCE_SHA
);
