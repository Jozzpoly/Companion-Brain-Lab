# Research history recovery

The Sep 2026 experiment branch explosion was previously consolidated into `main` ancestry; see [branch-manifest-2026-09-20.json](branch-manifest-2026-09-20.json). Those old tips are recoverable by exact commit SHA; deleted branch names are **not** authoritative plans.

## November 2026 donor retirement

See [branch-manifest-2026-11-10.json](branch-manifest-2026-11-10.json). It records exact branch tips for two **unmerged** stacked donor PRs and one **orphan compiled preview**. The intent is to preserve each at an immutable named Git tag under `archive/2026-11-10/*` before removing their obsolete branch names.

**Verify tags exist and their SHA matches the manifest before assuming cleanup completed.** If not, the previous branch refs may still be the only durable named references. New agents should not trust a manifest's planned status as evidence of actual remote action.

Recover source code using Git's ordinary refs, e.g.:

```sh
git fetch --all --tags
git switch -c recovery/companion-cover archive/2026-11-10/companion-live-cover
```

This does **not** change `main`. The Cover source includes changes from PR #65; no need to manually stack branches for source inspection. Compiled preview tag is a different, deliberately orphaned history and is **not** source code. Original PR discussions [#65](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/65) and [#66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66) preserve claims and limitations.

## Authority rule

Old branch/PR/commit titles, tests and prose are **history and evidence, not instructions**. `../AGENTS.md` and `../docs/STATE.md` are the short route into actual source truth. The old long `../docs/CURRENT.md` is a September dossier, not the November execution queue.
