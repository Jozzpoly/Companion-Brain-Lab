# Run, verify and reproduce — Companion Brain Lab

**Context:** Node 22 (`.nvmrc`); Vite + TypeScript + Vitest + Phaser 4 + Rapier 2D. Repository `main` (Sep–Nov 2026) has **no dependency lockfile**. Never claim clean reproducibility from `npm install` alone.

## Local

From a **separate checkout** of this repository, not a neighboring project:

```sh
node --version
npm install
npm run dev
```

Vite normally serves `http://localhost:5173/`. Open:
- `http://localhost:5173/?fieldlab=1` — **current main-source Squad Field Lab**
- `http://localhost:5173/` — historical R1 Workbench/default
- `?fieldlab=1&coverlab=1` — **not** a main feature. Cover was donor code outside main.

Run the whole normal check:

```sh
npm run check
```

That executes `tsc -p tsconfig.json --noEmit`, `vitest run` and `vite build`. `npm test` alone omits TypeScript/build. For actual browser behavior, use targeted scripts already named in `package.json`, e.g. `npm run browser:squad-field-lab` and `npm run browser:squad-field-lab-combat-authoring`. Scripts need a working local Chromium/Playwright environment and can emit local artifacts; do not infer success from their existence.

If `npm install` fails with the recognized npm Arborist `Cannot read properties of null (reading 'edgesOut')` crash, CI retries `npm install --legacy-peer-deps` **only** for that known signature. An unrelated install error must be investigated, not hidden by bypass flags. The absence of `package-lock.json` remains an open engineering debt.

## CI and releases

- `validate` runs on main pushes and PRs; machine quality only.
- Specialist browser workflows have narrow path filters, often run on main source changes or `workflow_dispatch`; some are historical falsifiers. Do not delete or rerun them indiscriminately.
- `pages-research-preview.yml` is a **manual/pinned historic Pages composite**. Its older routes (Foundation, CCC, Owner review, Stage B/readiness) are experimental, often **rejected** as product gates. Editing docs does not publish newer Companion gameplay.
- The two Nov donor experiments (#65 Jaskinia; #66 Cover) can be recovered through their **archival source refs** from `archive/branch-manifest-2026-11-10.json`. They were never qualified as Owner product experiences.
- Real browser and World evidence must record the **exact source commit**, scenario, stop condition and outcome. Source code that says `PASS` is not a recent execution trace.

## Change safety

- Preserve World authority, simulated clock, player-command authority, and exact source provenance. Diagnostic `postMessage` must not become unlimited world-write permission.
- Do not publish a new Page, expose Owner notes/token/storage or mutate Jaskinia/other labs as an incidental action.
- If working from an archive tag, branch explicitly for experimentation; `main` is not an automatic successor of those branches.
- Before replacing a mechanism, identify its tests/callers and the historical negative evidence it protects.
