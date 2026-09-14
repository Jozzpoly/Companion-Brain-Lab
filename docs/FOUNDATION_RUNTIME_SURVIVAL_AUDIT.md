# Foundation Runtime Survival / Pre-Rework Audit

Status: **MECHANICAL FOUNDATION PASS · EXACT PUBLIC ARTIFACT DEPLOYED · BROWSER / OWNER QUALIFICATION OPEN · NOT YET REWORK-READY**

Mechanically qualified application runtime:

`81877d7fab6b52d4ea683c870074cf12e0793c43`

Runtime qualification CI:

`34872163500`

Public Pages authority:

- workflow: `.github/workflows/pages-research-preview.yml` on `main`;
- operational workflow commit: `6cad9a9b526dd9f798e68641e636346665406397`;
- final deployment run: `34873093904` — PASS;
- public URL: `https://jozzpoly.github.io/Companion-Brain-Lab/`;
- deterministic fault rehearsal: `https://jozzpoly.github.io/Companion-Brain-Lab/?foundationFaultProbe=1`.

This document is the live gate between the R1 research line and the next intentionally aggressive Companion Coordination Core redesign.

The exit condition is not “the latest bug seems fixed.” The exit condition is a substrate whose ordinary constrained-world states are represented as data rather than fatal exceptions, whose browser adapter preserves the same contracts tested headlessly, whose catastrophic faults remain observable after fail-stop, and whose exact public artifact survives Owner browser stress without unexplained whole-runtime shutdown.

## Why the foundation campaign was reopened

The prior audited R1-4 runtime had strong mechanical evidence, but the Owner browser gate reproduced a whole-workbench freeze.

Observed evidence:
- panel remained visibly `RUNNING`;
- last completed causal frame stopped at `observation t1886 -> outcome t1887`;
- player and companion input ceased to produce further World outcomes;
- no independent fatal-fault surface explained the stop.

That browser evidence invalidated the prior open Owner gate while preserving the earlier automated evidence as historical evidence.

A separately captured pillar incident at tick 2027 was not the freeze incident. Its tail was mostly healthy, but its history helped expose ambiguity in recovery counters and several constrained-state transitions. It remains supporting historical evidence, not the causal proof of the freeze.

## Reconstructed freeze-class mechanism

High-confidence mechanism now bound by deterministic regressions and a full-chain rehearsal:

1. ordinary Rapier contact can leave the dynamic companion in slight hard-body penetration/tolerance against static geometry;
2. pre-foundation local hard traversal treated initial overlap/contact as an immediate blocked sweep even for outward motion;
3. player prediction could simultaneously make STOP dynamically inadmissible;
4. zero admissible candidates reached the preserved S3 invariant `Spatial locomotion produced no admissible candidates`;
5. that uncaught exception could terminate the Phaser update path before the next World outcome, leaving the last rendered panel stale at `RUNNING`.

A second ordinary-state termination seam existed independently in the legacy relationship brain: all eight authored relational slots being illegal could reach `No valid relational positioning candidate`.

Both classes are now intercepted as typed ordinary states before historical invariant throws can become current browser-runtime termination.

## Foundation survival vocabulary

Normal constrained-world states are data, not programmer errors.

Current public vocabulary:
- `NORMAL` — ordinary local movement regime;
- `HARD_EGRESS` — the live body starts in hard contact/overlap and a safe outward whole-body escape exists;
- `NO_SAFE_VELOCITY` — no admissible local velocity exists; fail closed with STOP rather than terminate;
- `NO_VALID_RELATIONAL_SLOT` — the temporary legacy eight-slot objective vocabulary is exhausted; hold current position and reconsider tactically.

`NO_SAFE_VELOCITY` is propagated into progress/recovery as an intentional safety hold. It does not masquerade as unexplained no-progress and does not consume retry budget merely because safety deliberately chose STOP.

`NO_VALID_RELATIONAL_SLOT` is an explicit `RelationalDecision.objectiveState`. It is propagated as an intentional hold so `target == current position` cannot be mislabeled as `ARRIVED`.

Invalid/unreachable route truth still outranks an intentional hold.

## Hard-contact / hard-overlap egress contract

Hard egress is a shared chain contract, not a local-brain exception.

Authority path:

`static route -> local spatial choice -> NATURAL realization -> final hard validation -> World -> post-World recovery`

Current contract:
- route targets and graph corner nodes must be hard-valid points;
- every hard graph edge leaving the live `start` node uses `initialOverlap: "allow-egress"`;
- this start-edge rule also covers exact physical contact even when mathematical point fit still says the body is legal;
- directionality is regression-bound: from exact world-boundary contact, egress-aware traversal permits motion away from the wall and still blocks motion into the wall;
- local candidate repair requires egress-aware hard traversal plus a hard-clear predicted endpoint before rehabilitation;
- STOP is not considered a safe local result while the body is already hard-penetrating and a real egress move is required;
- NATURAL treats `HARD_EGRESS` as a safety regime, bypassing temporal refinement/continuity and executing the upstream-approved escape through egress-aware final validation;
- ordinary NATURAL behavior resumes after physical clearance is restored.

A deterministic 180-step Rapier + route + R1 NATURAL + World + post-World recovery rehearsal actually enters `HARD_EGRESS`, leaves it, returns to `NORMAL`, and remains finite throughout.

**Dynamic full-chain survival rehearsal: PASS.**

## Browser traversal adapter contract

A late claim-vs-code audit exposed a browser-only gap that headless movement tests could not reveal.

`R1LabScene` had wrapped `World.staticCircleTraversal()` in a three-argument closure and silently dropped the optional fourth `StaticTraversalOptions` argument. Therefore headless egress tests could pass while the real scene still executed default initial-overlap blocking.

The current browser boundary is explicit:

`src/app/static-traversal-query-adapter.ts`

`bindWorldStaticTraversalQuery()` preserves the complete query signature. A dedicated regression proves `initialOverlap: "allow-egress"` reaches World unchanged. The real scene uses the adapter for route construction and active local movement input.

**Browser/headless traversal-contract parity: mechanical PASS.**

## Static point-fit versus traversal contact semantics

`circleFitsStaticWorld()` is the shared domain authority for static endpoint/body fit used by the router and the temporary legacy relationship objective provider.

It intentionally answers a different question from a swept traversal query.

Bound distinctions:
- obstacle exact tangency is non-penetrating point occupancy;
- exact authored world-boundary tangency is mathematically legal point fit;
- Rapier overlap/cast APIs may still report exact physical contact at that same boundary;
- therefore domain point-fit parity is required for materially clear/penetrating placements, while exact contact behavior belongs to traversal/egress semantics.

This distinction was directly falsified against the backend. The router no longer turns legal exact boundary contact into false `unreachable` merely because a default swept cast reports a zero-distance start contact.

## Relationship exhaustion semantics

The legacy eight-slot relationship model is still temporary authority and is intentionally not being polished into the final companion architecture.

Foundation requirement is narrower: exhausting that vocabulary must not terminate the runtime or fabricate causal success.

Current behavior:
- no valid authored slot -> `objectiveState: NO_VALID_RELATIONAL_SLOT`;
- target becomes hold-current;
- tactical reconsideration continues;
- recovery reports `INTENTIONAL_HOLD` when route truth is otherwise valid;
- causal trace exposes `relationshipState` explicitly;
- route invalid/unreachable states remain authoritative over the hold.

**Relationship exhaustion survival + causal truth: PASS.**

## Runtime catastrophic-fault containment

Known ordinary world states have been removed from the active exception paths, but genuine programmer/data/runtime faults must remain visible.

`runtime-fault-sentinel` is installed before Phaser and listens for:
- `window.error`;
- `unhandledrejection`.

On the first catastrophic fault:
- first-fault evidence is latched;
- Phaser game loop is stopped;
- last rendered canvas remains available behind the independent DOM surface;
- the surface reports `RUNTIME FAULT — SIMULATION FAIL-STOPPED`;
- message, stack/location, fault JSON download and reload controls remain available;
- secondary faults do not overwrite first-fault evidence.

Constructor/startup exceptions are normalized into the same fail-stop surface.

A deterministic browser-only probe is implemented:

`?foundationFaultProbe=1`

After a short startup delay it deliberately throws outside Phaser. The normal URL is inert.

Unit/regression coverage binds activation and first-fault behavior.

**Fault-containment code/unit evidence: PASS.**

**Real published-browser fail-stop rehearsal: OPEN.**

## Causal / incident semantics

Incident schema remains:

`companion-brain-lab-r1-causal-incident-v2`

The foundation does not silently migrate consumers to a breaking v3.

Legacy recovery fields remain:
- `retryCount` — retry budget used in the current semantic episode;
- `appliedLocalRetries` — cumulative local retries since stack reset.

Self-describing aliases are emitted by the real scene:
- `retryBudgetUsedThisEpisode`;
- `cumulativeLocalRetriesSinceReset`.

`CausalFrameTrace` also fills those aliases automatically when a producer supplies only legacy fields.

Relationship evidence includes explicit `relationshipState`.

**Recovery-counter ambiguity: CLOSED.**

## Active-path exception boundary

### Ordinary states — exceptions forbidden

Regression-covered ordinary classes include:
- local velocity candidate exhaustion;
- no legal legacy relationship slot;
- desired-clearance overlap;
- hard contact/overlap outward egress;
- exact world-boundary contact routing;
- temporary and persistent route loss;
- player/static blocking;
- intentional fail-closed hold;
- relationship-vocabulary exhaustion hold.

### Programmer / data invariants — exceptions allowed

Examples:
- required actor missing from a snapshot;
- duplicate MotionIntent for one actor;
- non-finite coordinates;
- non-positive radius/dt/speed where contracts require positive values;
- impossible internal router reference;
- invalid recovery tick/objective key;
- invalid trace capacity.

These are not gameplay states. They should fail loudly into the browser sentinel rather than fabricate plausible behavior.

### Startup / environment faults — fail-stop allowed

Examples:
- required DOM/keyboard apparatus unavailable;
- physics/runtime initialization failure.

The sentinel is observability + fail-stop, not unknown-fault recovery.

## Mechanically qualified runtime

Exact application source:

`81877d7fab6b52d4ea683c870074cf12e0793c43`

CI run:

`34872163500`

Evidence:
- Node 22.23.2 / npm 10.9.8;
- 42 packages added, 43 audited, 0 vulnerabilities;
- TypeScript `tsc --noEmit`: PASS;
- Vitest: **31/31 files PASS**;
- Vitest: **136/136 tests PASS**;
- Vite 8.2.2 production build: PASS;
- remaining Vite large-chunk note is non-blocking research bundling debt.

Important included falsifiers/regressions:
- 180-step full-chain hard-egress survival and return to `NORMAL`;
- hard-overlap STOP inadmissibility;
- exact-contact route-start recovery;
- exact-boundary egress directionality;
- browser traversal-options forwarding;
- relationship exhaustion as hold rather than arrival;
- fault-sentinel first-fault latch;
- deterministic fault-probe activation;
- incident-v2 alias compatibility;
- preserved prior R1 moving-objective and doorway recovery rehearsals.

**Mechanical foundation verdict: PASS.**

## Exact public Pages qualification

Operational Pages workflow is intentionally separate from the experiment branch and pins immutable application source.

Current operational workflow commit on `main`:

`6cad9a9b526dd9f798e68641e636346665406397`

Final refreshed Pages run:

`34873093904`

That run independently:
- checked out exact `81877d7fab6b52d4ea683c870074cf12e0793c43`;
- installed dependencies;
- reran `npm run check` successfully;
- configured Pages;
- uploaded the artifact;
- deployed successfully.

Public environment URL reported by GitHub:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

Operational action majors were refreshed without changing application source:
- `actions/checkout@v5`;
- `actions/setup-node@v5`;
- `actions/configure-pages@v6`;
- `actions/upload-pages-artifact@v5`;
- `actions/deploy-pages@v5`.

The exact final Pages artifact was downloaded after deployment; its production JS bundle contains both `foundationFaultProbe` and `FOUNDATION_FAULT_PROBE` markers.

**Exact-source pin/build/upload/deploy gate: PASS.**

This does not imply browser behavior PASS.

## Automated browser evidence limitation

A real Chromium/Playwright attempt was made against the exact downloaded production artifact.

The execution environment blocks navigation before application startup with browser policy error:

`ERR_BLOCKED_BY_ADMINISTRATOR`

This occurs for both localhost HTTP and direct file navigation, before Phaser or the fault probe can execute.

Therefore:
- it is an environment limitation, not an application failure;
- it is not counted as browser PASS;
- policy bypasses, altered app source, or synthetic non-browser substitutes are not accepted as equivalent evidence.

The binding browser gate remains the real public artifact in an ordinary user browser.

## Repo / evidence hygiene

Current evidence roles:
- `FOUNDATION_RUNTIME_SURVIVAL_AUDIT.md` — live foundation truth and readiness boundary;
- `FOUNDATION_ACTIVE_AUTHORITY_MAP.md` — current runtime authority at module/symbol level;
- `FOUNDATION_BROWSER_OWNER_GATE.md` — exact browser/Owner procedure;
- `FOUNDATION_PUBLIC_PREVIEW_QUALIFICATION.md` — Pages deployment evidence and public-artifact boundary;
- `R1_AUDIT_LEDGER.md` — historical R1 evidence, not current authority.

Historical S0-S5/R1 modules and tests remain donor/regression evidence. Their continued existence does not restore superseded top-level authority.

The branch retains the final R1 evidence ancestry; cleanup did not fork away from the previous qualified line.

## Closed foundation gates

The following are now closed:
- deterministic ordinary-state regressions for the reproduced freeze class;
- hard-contact/overlap egress semantics across the active movement chain;
- 180-step full-chain survival rehearsal;
- relationship-slot exhaustion survival semantics;
- browser traversal callback contract parity;
- static point-fit semantic consolidation;
- recovery/incident counter semantics;
- active authority mapping;
- broad claim-vs-code / adapter-boundary sweep;
- exact mechanically qualified runtime pin;
- exact Pages rebuild/upload/deploy.

No currently known mechanical code blocker remains unresolved inside the foundation scope.

## Remaining gates before rework readiness

Only evidence that genuinely requires a real browser / Owner remains open.

### 1. Deterministic browser fault-probe rehearsal

Open:

`https://jozzpoly.github.io/Companion-Brain-Lab/?foundationFaultProbe=1`

Required observations:
- independent fault surface appears;
- message contains `FOUNDATION_FAULT_PROBE`;
- simulation stops rather than continuing behind the overlay;
- last canvas remains visible;
- fault JSON can be downloaded;
- secondary faults do not replace first-fault evidence.

### 2. Normal public-artifact sanity

Reload without the query parameter:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

Verify normal workbench startup, advancing ticks, player input, SPATIAL/NATURAL operation, scenario controls, pause/single-step/reset and incident export without spontaneous fault surface.

### 3. Owner torture run

Deliberately stress:
- wall pin / push / release;
- boundary scrape and corner contact;
- doorway/chokepoint contention;
- rapid player reversals and moving objectives;
- long continuous runs, including 2x after ordinary 1x sanity;
- DIRECT/NATURAL comparison for at least one difficult sequence.

Capture incident JSON immediately for suspicious zero motion, wrong `PERSISTENT_UNREACHABLE`, sticky `NO_SAFE_VELOCITY`, recovery loops, incorrect arrival/hold semantics, teleport/disappearance, freeze or fault surface. Video remains valuable for timing/visual failures.

### 4. Final readiness verdict

Owner evidence must be reconciled against this audit. Only then may the foundation campaign be declared complete and the aggressive Companion Coordination Core redesign begin.

## Explicitly deferred beyond foundation

These are important product limitations, but they are not foundation blockers unless they reveal a substrate/survival/causal-truth defect:
- replacement of the legacy eight-slot relationship objective with Relationship Field / region reasoning;
- player movement corridor and right-of-way cooperation;
- dynamic pace / urgency / catch-up policy;
- redesign of `MotionIntent` and speed authority;
- multi-companion coordination;
- command hierarchy;
- combat;
- LLM cognition;
- selective promotion/transplant of older S5 research.

Do not spend the foundation campaign polishing these deferred systems.

## Readiness exit statement

The campaign may be declared complete only when the evidence supports this statement without qualification:

> Ordinary constrained-world states cannot terminate the active runtime; contact/overlap egress is coherent through route, local motion and actuation; browser adapters preserve the tested contracts; catastrophic faults become a real observable fail-stop instead of a silent frozen `RUNNING` canvas; static geometry semantics are explicit; current authority is known; the full automated suite and dynamic survival rehearsals are green; the exact qualified artifact is deployed; and an Owner browser torture gate shows no unexplained whole-runtime shutdown or material contradiction between world behavior and causal evidence.

**The mechanical and deployment portions now pass. The browser/Owner portion remains open.**

Only after that final evidence should the project enter the large Companion Coordination Core redesign.
