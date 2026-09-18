import { describe, expect, it } from "vitest";
import { buildCompanionBuildIdentity } from "./build-identity";

describe("Companion build identity", () => {
  it("preserves the exact supplied source identity after trimming transport whitespace", () => {
    expect(buildCompanionBuildIdentity(" abc123 ")).toEqual({
      sourceSha: "abc123",
      state: "PINNED_SOURCE_SHA"
    });
  });

  it("labels an empty source identity as unpinned local instead of inventing provenance", () => {
    expect(buildCompanionBuildIdentity("")).toEqual({
      sourceSha: null,
      state: "UNPINNED_LOCAL"
    });
  });

  it("labels a missing source identity as unpinned local instead of inventing provenance", () => {
    expect(buildCompanionBuildIdentity(undefined)).toEqual({
      sourceSha: null,
      state: "UNPINNED_LOCAL"
    });
  });
});
