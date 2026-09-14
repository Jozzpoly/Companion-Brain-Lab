# Foundation Public Preview Qualification

Status: **PUBLIC ARTIFACT DEPLOYMENT PASS · BROWSER BEHAVIOR GATE OPEN**

This document freezes the operational evidence for the exact Foundation Runtime Survival / pre-rework Owner-gate candidate. It does not claim that browser behavior has passed merely because GitHub Pages deployed successfully.

## Exact application runtime

Mechanically qualified source:

`81877d7fab6b52d4ea683c870074cf12e0793c43`

Qualification CI:

`34872163500`

Mechanical evidence:
- TypeScript PASS;
- 31/31 test files PASS;
- 136/136 tests PASS;
- production Vite build PASS;
- npm audit: 0 vulnerabilities.

The public workflow is intentionally pinned to this immutable source SHA rather than to `foundation/runtime-survival-cleanup` or another moving branch.

## Operational Pages authority

Operational workflow lives on `main`:

`.github/workflows/pages-research-preview.yml`

Current operational workflow commit:

`6cad9a9b526dd9f798e68641e636346665406397`

The workflow checks out application source `81877d7fab6b52d4ea683c870074cf12e0793c43`, then independently runs `npm install` and `npm run check` before upload/deploy.

Current Pages action majors:
- `actions/checkout@v5`;
- `actions/setup-node@v5`;
- `actions/configure-pages@v6`;
- `actions/upload-pages-artifact@v5`;
- `actions/deploy-pages@v5`.

This replaced the previous operational action line after the first successful foundation deployment exposed a deprecation warning from `deploy-pages@v4`. The application runtime SHA did not change.

## Deployment evidence

Final refreshed Pages workflow run:

`34873093904`

Result:
- exact runtime checkout: PASS;
- dependency install: PASS;
- exact runtime `npm run check`: PASS;
- Pages configuration: PASS;
- artifact upload: PASS;
- deployment: PASS.

GitHub reported the environment URL as:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

The deployment action reported success after creating the Pages deployment from the workflow artifact.

A previous foundation deployment run `34872879589` also passed before the action-version refresh. It is retained only as corroborating operational evidence; run `34873093904` is the current deployment authority.

## Browser gate URLs

Normal artifact:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

Deterministic catastrophic-fault rehearsal:

`https://jozzpoly.github.io/Companion-Brain-Lab/?foundationFaultProbe=1`

The fault-probe parameter is implemented in the exact runtime source and is regression-covered. The Pages deployment proves that source was built and published; it does **not** prove that a real user browser rendered the expected fail-stop surface.

## Evidence boundary

**PASS:**
- exact mechanically qualified source is pinned;
- the pinned source is revalidated inside the Pages workflow;
- Pages build/upload/deploy succeeds;
- public environment URL is established;
- operational Pages action versions are current for this gate.

**OPEN / NOT CLAIMED:**
- real browser canvas/workbench startup sanity;
- real `window.error -> runtime-fault-sentinel -> game.loop.stop()` behavior on the deployed artifact;
- visual persistence of the last canvas behind the fault surface;
- fault JSON download in a real browser;
- Owner wall/doorway/reversal/long-run torture behavior;
- final foundation readiness.

Container/network limitations are not substituted for browser evidence. The remaining qualification must be performed against the exact public URLs above.

## Relationship to the live audit

This closes the audit item requiring an exact mechanically qualified runtime to be pinned and successfully deployed through operational Pages.

The remaining readiness gates are now:
1. deterministic browser fault-probe rehearsal;
2. ordinary public-artifact sanity after removing the probe parameter;
3. Owner torture run with incident/video evidence for anything suspicious;
4. final readiness verdict reconciling Owner evidence with the mechanical campaign.

Do not begin the aggressive Companion Coordination Core redesign merely because this deployment gate passed.
