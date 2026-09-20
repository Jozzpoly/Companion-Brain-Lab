# Historical branch recovery

The large 2026-09 research campaign previously used many short-lived experiment/planning branches. Those branch names were removed during repository cleanup to eliminate branch/PR sprawl.

No recorded branch tip was intentionally discarded.

## Recovery index

See:

`archive/branch-manifest-2026-09-20.json`

The manifest records every branch name and exact tip SHA captured immediately before cleanup.

## Preservation model

Before deletion, every unique legacy tip was incorporated into archive ancestry. That archive ancestry was then incorporated into `main` as a merge parent.

Therefore historical commits remain reachable through the canonical repository history even though their old branch refs no longer exist.

## Recovering an old branch

Find the old branch name in the manifest and use its SHA.

Example locally:

```bash
git switch -c recovery/<name> <sha>
```

Or create a temporary GitHub branch directly from that exact SHA when repository-native inspection is required.

A recovered branch is temporary research access, not automatically current project authority.

## Authority rule

Historical branch names, commits, PR descriptions and experiment documents are evidence/provenance only.

The current project entrypoint is:

`docs/CURRENT.md`
