# Run, verify and reproduce — Companion Brain Lab

**Context:** Node 22 (`.nvmrc`); Vite + TypeScript + Vitest + Phaser 4 + Rapier 2D. The repository now tracks `package-lock.json` and `.npmrc`. Use `npm ci` for clean repeatable installs with the recorded npm 10 compatibility policy. See [CI #42906609446](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42906609446) for actual test evidence.

## Local

From a **separate checkout** of this repository, not a neighboring project:

```sh
node --version
npm ci
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

That executes `tsc -p tsconfig.json --noEmit`, `vitest run` and `vite build`. `npm test` alone omits TypeScript/build. For actual browser behavior, use targeted scripts already named in `package.json`, e.g. `npm run browser:squad-field-lab` and `npm run browser:squad-field-lab-combat-authoring`. Scripts need a working local Chromium/Playwright environment and can emit local artifacts into the ignored `artifacts/` folder; do not infer success from their existence.

Dependency cleanup 2026-11-10: default npm 10.9.9 peer resolution crashed inside Arborist (`edgesOut`) on clean GitHub Actions. The earlier conditional `--legacy-peer-deps` fallback worked. Its peer-resolution mode is now declared once in project `.npmrc`, and a lockfile was generated using it. `npm ci` followed by TypeScript, 780 Vitest tests and Vite build **passed on the original clean-install runner**. After subsequent evidence-based deletions, the main source has **190 test files / 774 tests**, also green ([CI](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42914713815)). Legacy peer resolution bypasses some peer compatibility checks; remove this workaround only after proving a compatible dependency graph and rebuilding the lockfile on a clean machine. Unrelated install errors must still be investigated.

## CI and releases

- `validate` runs on main pushes and PRs; machine quality only.
- `live-runtime-browser` runs automatically for source, dependency and entrypoint changes on main/PR. It verifies both main-source URLs (historical R1 and active Field Lab) plus material combat authoring in Chromium; [proof](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42913234752). It also asserts the **selected route's JS chunk** was requested and the other route's chunk was not. This is a mechanistic browser PASS, not Owner gameplay acceptance.
- Ten **specialist/historical** browser workflows are preserved but run only via `workflow_dispatch` on demand; they no longer fan out after every `World` change. `manual-research-audit` is likewise opt-in. All eleven now install the verified `npm ci` lockfile (not ad-hoc peer-resolution fallbacks). Choose a specialist when changing the contract it owns; do not delete its script without dependency/evidence analysis. The pinned historic Pages deployment intentionally retains its own old-SHA install semantics.
- `pages-research-preview.yml` is a **manual/pinned historic Pages composite**. Its older routes (Foundation, CCC, Owner review, Stage B/readiness) are experimental, often **rejected** as product gates. Editing docs does not publish newer Companion gameplay.
- The two Nov donor experiments (#65 Jaskinia; #66 Cover) can be recovered through their **archival source refs** from `archive/branch-manifest-2026-11-10.json`. They were never qualified as Owner product experiences.
- Real browser and World evidence must record the **exact source commit**, scenario, stop condition and outcome. Source code that says `PASS` is not a recent execution trace.

## Change safety

- Preserve World authority, simulated clock, player-command authority, and exact source provenance. Diagnostic `postMessage` must not become unlimited world-write permission.
- Do not publish a new Page, expose Owner notes/token/storage or mutate Jaskinia/other labs as an incidental action.
- If working from an archive tag, branch explicitly for experimentation; `main` is not an automatic successor of those branches.
- Before replacing a mechanism, identify its tests/callers and the historical negative evidence it protects.
