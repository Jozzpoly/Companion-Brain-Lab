# Research history recovery

The Sep 2026 experiment branch explosion was previously consolidated into `main` ancestry; see [branch-manifest-2026-09-20.json](branch-manifest-2026-09-20.json). Those old tips are recoverable by exact commit SHA; deleted branch names are **not** authoritative plans.

## November 2026 donor retirement

See [branch-manifest-2026-11-10.json](branch-manifest-2026-11-10.json). It records exact branch tips for two **unmerged** stacked donor PRs and one **orphan compiled preview**. **COMPLETED 2026-11-10:** all three exact tips are preserved at **named lightweight Git tags** under `archive/2026-11-10/*` (tag refs are technically mutable; the manifest records exact SHA values for verification). The three former branch refs were deleted; only `main` remains. Both draft PRs were closed, unmerged. Exact cleanup evidence: [GitHub Actions #42904769440](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42904769440).

**At cleanup, all three tag SHAs were read back and matched the manifest.** Any future agent should still verify live Git refs rather than trust a dated declaration. Do not recreate the old long-lived development branches by default.

Recover source code using Git's ordinary refs, e.g.:

```sh
git fetch --all --tags
git switch -c recovery/companion-cover archive/2026-11-10/companion-live-cover
```

This does **not** change `main`. The Cover source includes changes from PR #65; no need to manually stack branches for source inspection. Compiled preview tag is a different, deliberately orphaned history and is **not** source code. Original PR discussions [#65](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/65) and [#66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66) preserve claims and limitations.

## Authority rule

Old branch/PR/commit titles, tests and prose are **history and evidence, not instructions**. `../AGENTS.md` and `../docs/STATE.md` are the short route into actual source truth. The old long `../docs/CURRENT.md` is a September dossier, not the November execution queue.
