# Foundation Runtime Survival / Pre-Rework Audit

Status: **MECHANICAL FOUNDATION PASS · BROWSER / OWNER QUALIFICATION OPEN · NOT YET REWORK-READY**

Mechanically qualified runtime source: `81877d7fab6b52d4ea683c870074cf12e0793c43`.

Qualification CI: run `34872163500` — TypeScript PASS, 31/31 test files PASS, 136/136 tests PASS, production build PASS, 0 npm vulnerabilities.

This document is the live gate between R1 research history and the next intentionally aggressive companion-system redesign.

The exit condition is not “the latest bug seems fixed.” The exit condition is a sufficiently clean, legible and fault-tolerant foundation that large changes to relationship reasoning, pace/catch-up and player cooperation can be made without inheriting known hidden failure semantics.

## Owner evidence that reopened the foundation

The R1-4 audited runtime had strong mechanical evidence, but the Owner browser gate reproduced a whole-workbench freeze. The visible panel remained `RUNNING`; the last completed causal frame stopped at `observation t1886 -> outcome t1887`; player and companion input ceased to produce further World outcomes.

This invalidated the prior open Owner gate while preserving the earlier automated evidence as historical evidence.

A separately captured pillar incident at tick 2027 was not the freeze incident. Its retained tail was mostly healthy `PROGRESSING -> ARRIVED`, but its event history demonstrated repeated tracking, transient unreachable, player blocking, persistent unreachable and recovery episodes. It also exposed a debug-semantics ambiguity: `retryCount` was per semantic episode while `appliedLocalRetries` was cumulative since stack reset.

## Freeze causal chain — current status

**High-confidence mechanism, now bound by deterministic regressions and full-chain rehearsal:**

1. ordinary Rapier contact can leave the dynamic companion in slight hard-body penetration/tolerance against static geometry;
2. the pre-foundation R1 local hard check treated initial hard overlap as an immediate blocked sweep even for outward motion;
3. the player prediction layer could simultaneously reject STOP as a future player collision;
4. candidate exhaustion reached the preserved S3 invariant `Spatial locomotion produced no admissible candidates`;
5. that uncaught exception could terminate the Phaser scene update before the next World tick, leaving the last rendered panel at `RUNNING`.

A second ordinary-state termination seam existed in the legacy relationship brain: all eight authored relational slots being illegal reached `No valid relational positioning candidate`.

Both ordinary-state exception paths are now intercepted by typed foundation semantics before those historical throws can become browser runtime termination.

## Foundation survival vocabulary

Normal constrained-world states must be data, not exceptions.

Current public vocabulary:
- `NORMAL` — ordinary local movement regime;
- `HARD_EGRESS` — body starts in physical contact/overlap and a whole-body escape is available;
- `NO_SAFE_VELOCITY` — no admissible local velocity; fail-closed STOP without runtime termination;
- `NO_VALID_RELATIONAL_SLOT` — legacy eight-slot objective vocabulary is exhausted; hold current position and reconsider tactically.

`NO_SAFE_VELOCITY` is propagated into progress/recovery as an intentional safety hold. It does not masquerade as unexplained no-progress or spend retry budget merely because the system consciously chose fail-closed STOP.

`NO_VALID_RELATIONAL_SLOT` is now an explicit `RelationalDecision.objectiveState`. It is also propagated as an intentional hold, so a temporary `target == current position` cannot be mislabeled as `ARRIVED`.

Invalid/unreachable route truth still outranks any intentional hold.

## Hard/contact egress contract — current status

Hard egress is not a local-brain-only exception.

The foundation maintains coherent semantics across:

`static route -> local spatial choice -> NATURAL realization -> final hard validation -> World -> post-outcome recovery`.

Current contract:
- route targets/corner nodes must be physically valid points;
- every hard route edge leaving the **live start node** uses `initialOverlap: "allow-egress"`;
- this start-edge rule applies even when mathematical point fit says the body is legal, because exact physical contact can still produce a Rapier zero-distance cast hit;
- directionality is regression-bound: from exact world-boundary contact an egress-aware cast clears motion away from the wall but still blocks motion into the wall;
- local candidate repair uses egress-aware hard traversal plus a hard-clear predicted endpoint before rehabilitating a candidate;
- while already hard-penetrating, STOP is not considered an admissible safe velocity;
- NATURAL treats `HARD_EGRESS` as a safety regime: temporal refinement/continuity is bypassed, the approved egress move is executed directly, and final validation uses explicit egress semantics;
- normal NATURAL behavior resumes after physical clearance is restored.

The full Rapier + route + R1 NATURAL + World + post-World recovery chain now has a 180-step deterministic survival rehearsal that actually enters hard egress, leaves it and returns to NORMAL with finite state throughout.

**Dynamic survival rehearsal: PASS.**

## Browser adapter contract — repaired

A late claim-vs-code audit found a browser-only gap that headless tests could not expose:

`R1LabScene` had wrapped `World.staticCircleTraversal()` in a three-argument callback, silently discarding the optional fourth `StaticTraversalOptions` argument. Headless egress tests could therefore pass while the real browser scene still executed default initial-overlap blocking.

The browser boundary is now explicit:
- `src/app/static-traversal-query-adapter.ts`
- `bindWorldStaticTraversalQuery()`

A dedicated regression proves `initialOverlap: "allow-egress"` reaches World unchanged, and the real scene uses this adapter for both route construction and active local movement input.

**Browser/headless traversal contract parity: mechanical PASS.**

## Shared static point-validity contract

The old code had two different meanings of “this body fits at this target.”

Legacy relationship used exact circle-vs-AABB endpoint geometry. The router used a square AABB expanded by body radius, which was overly conservative around obstacle corners and could produce `relationship valid -> route invalid-target` disagreement.

Foundation hardening centralizes point fit in `circleFitsStaticWorld()` using body-circle vs obstacle-AABB geometry plus authored world-boundary fit. Router and legacy relationship now consume the same primitive.

A later falsifier clarified an important boundary:
- obstacle exact tangency is non-penetrating point occupancy in both domain helper and Rapier occupancy query;
- exact authored world-boundary tangency is mathematically legal in the domain helper while Rapier's shape-overlap query may classify exact contact as occupied;
- therefore parity is required on materially clear/penetrating placements, while exact backend contact semantics remain the responsibility of traversal/egress queries.

This is intentionally a **point-validity** contract only. Whole-path feasibility remains the responsibility of whole-body traversal queries.

## Runtime fault containment

Ordinary world states have been removed from the known exception paths, but genuine programmer/data/runtime faults must remain visible rather than leaving a frozen canvas with stale `RUNNING` text.

`runtime-fault-sentinel` is installed before Phaser and listens for:
- `window.error`;
- `unhandledrejection`.

On the first catastrophic fault:
- first-fault evidence is latched;
- the Phaser game loop is actually stopped;
- the last rendered canvas remains visible;
- an independent DOM surface reports `RUNTIME FAULT — SIMULATION FAIL-STOPPED`;
- message, stack/location, fault JSON download and reload controls remain available;
- subsequent secondary faults do not overwrite the original evidence.

Constructor/startup exceptions are normalized into the same surface.

A deterministic browser-only probe now exists:
- query parameter: `foundationFaultProbe=1`;
- after a short startup delay it deliberately throws outside Phaser;
- normal URLs remain inert.

This lets the exact published artifact exercise the real `window.error -> sentinel -> game.loop.stop()` chain without DevTools and without manufacturing a gameplay fault.

**Fault containment code/unit evidence: PASS.**

**Published-browser visual/behavior proof: OPEN until the exact runtime is deployed and rehearsed.**

## Causal / incident semantics

Incident schema remains `companion-brain-lab-r1-causal-incident-v2`; the foundation does not silently introduce a breaking v3 migration.

Legacy recovery fields remain:
- `retryCount` — episode-local retry budget use;
- `appliedLocalRetries` — cumulative local retries since stack reset.

Self-describing aliases are available and emitted by the real scene:
- `retryBudgetUsedThisEpisode`;
- `cumulativeLocalRetriesSinceReset`.

`CausalFrameTrace` also fills aliases automatically when a producer supplies only legacy fields, preserving compatibility with v2-style frames.

Relationship evidence now exposes explicit `relationshipState`, so `NO_VALID_RELATIONAL_SLOT` does not have to be inferred from a magic slot string.

**Debug counter ambiguity: CLOSED.**

## Active-path throw audit

### Ordinary world states — throws forbidden

Resolved / regression-covered:
- local velocity candidate exhaustion;
- no legal legacy relationship slot;
- desired-clearance overlap;
- hard-overlap/contact outward egress;
- exact world-boundary contact routing;
- temporary route loss / persistent unreachable;
- player/static blocking;
- intentional fail-closed hold;
- relationship-vocabulary exhaustion hold.

### Programmer / data invariants — throws allowed, sentinel-visible in browser

Examples in active authority:
- required player/companion actor missing from a World snapshot;
- duplicate motion intent for one actor;
- non-finite motion/query coordinates;
- non-positive body radius, dt or configured speed where the API contract requires positive values;
- impossible router internal reference to a node that was not built;
- invalid progress-monitor tick/objective key;
- invalid trace capacity.

These are not gameplay states and should fail loudly rather than fabricate behavior.

### Startup / environment faults — fail-stop allowed

Examples:
- required DOM/keyboard startup apparatus unavailable;
- physics/runtime initialization failure.

The global fault sentinel is the final browser evidence surface for uncaught faults in these classes.

## Mechanically qualified runtime

Exact runtime source:

`81877d7fab6b52d4ea683c870074cf12e0793c43`

CI run:

`34872163500`

Evidence:
- Node 22.23.2 / npm 10.9.8;
- `npm install`: 42 packages added, 43 audited, 0 vulnerabilities;
- TypeScript `tsc --noEmit`: PASS;
- Vitest: **31/31 files PASS**;
- Vitest: **136/136 tests PASS**;
- Vite 8.2.2 production build: PASS;
- only remaining build note is the existing large-chunk warning, treated as non-blocking research bundling debt.

Important included regressions:
- 180-step full-chain egress survival and return to NORMAL;
- hard-overlap STOP inadmissibility;
- exact-contact route start recovery;
- egress directionality at world boundary;
- browser traversal-option forwarding;
- relationship exhaustion as intentional hold, not arrival;
- fault-sentinel first-fault latch;
- deterministic browser fault-probe activation;
- incident-v2 alias compatibility;
- preserved prior R1 dynamic movement/recovery rehearsals.

This supports **MECHANICAL FOUNDATION PASS**. It does not by itself support Owner/browser qualification.

## Cleanup completed during this campaign

- removed stale package version label `0.0.0-s1`; current lab prerelease is `0.1.0-foundation.0`;
- validation workflow explicitly includes `foundation/**` pushes;
- GitHub Actions checkout/setup-node moved from v4 to v5;
- R1-4 PR is explicitly marked Owner FAIL / evidence preserved rather than retaining a stale open-gate claim;
- runtime survival has dedicated deterministic regressions rather than relying on manual reproduction only;
- static body point validity is centralized;
- hard-egress semantics are propagated end-to-end rather than patched at one layer;
- browser traversal callback truncation was replaced by a typed full-signature adapter;
- README no longer presents S0 as current project state;
- R1 audit ledger is explicitly historical evidence rather than live authority;
- executable historical S0 Pages workflow was removed from the active foundation branch;
- foundation branch ancestry includes the final R1 evidence line (`behind=0`);
- active authority is documented at symbol level in `FOUNDATION_ACTIVE_AUTHORITY_MAP.md`.

## Known non-blocking research history

The repository intentionally retains older S0-S5 modules/tests as research baselines. Their behavior is not automatically current runtime authority.

In particular, the preserved S3 `chooseSpatialVelocity()` may still throw on zero accepted candidates because it is a historical baseline. The active post-R1 foundation adapter must never forward ordinary candidate exhaustion into that throw. Tests bind this boundary.

Do not “clean” historical evidence by rewriting every old experiment to modern semantics. Clean authority boundaries instead.

## Remaining gates before readiness can be claimed

The broad mechanical/claim-vs-code campaign has stopped producing an unaddressed code blocker and the exact runtime suite is green. The remaining gates are deliberately browser/Owner-facing:

1. **Pin exact mechanically qualified runtime** — operational Pages must publish source `81877d7fab6b52d4ea683c870074cf12e0793c43`, not a moving branch head.
2. **Fault-sentinel browser proof** — open the exact public artifact with `?foundationFaultProbe=1`; verify independent fail-stop UI, frozen simulation loop, preserved canvas and fault JSON evidence.
3. **Normal public-artifact sanity** — reload without the probe parameter and verify the same exact build runs normally.
4. **Owner torture gate** — wall pin/push/release, boundary scrape/contact, doorway contention, rapid reversals, longer continuous movement, DIRECT/NATURAL comparison and incident capture must complete without silent whole-runtime freeze or unexplained shutdown.
5. **Final readiness verdict** — reconcile Owner evidence against this audit and only then decide whether the foundation is safe enough for the aggressive Companion Coordination Core redesign.

## Explicitly deferred to the next aggressive redesign, not blockers to foundation readiness

These are important product limitations but are intentionally **not** to be solved inside cleanup:
- replacing the legacy eight-slot relationship model with Relationship Field v2 / region reasoning;
- player movement corridor, right-of-way and chokepoint cooperation;
- dynamic pace / urgency / catch-up speed budget;
- redesigning `MotionIntent` around explicit desired velocity / speed authority;
- combat, commands and multiple companions;
- promotion/transplant of old S5 shadow research.

Those are the next large-change layer. The purpose of this campaign is to make the substrate safe enough to change them aggressively.

## Readiness exit statement

The campaign may be declared complete only when the evidence supports the following statement without qualification:

> Ordinary constrained-world states cannot terminate the active runtime; contact/overlap egress is coherent through route, local motion and actuation; browser adapters preserve the tested contracts; catastrophic faults become a real observable fail-stop instead of a silent frozen `RUNNING` canvas; static geometry semantics are explicit; current authority is known; the full automated suite and dynamic survival rehearsals are green; and an Owner torture gate shows no unexplained whole-runtime shutdown.

**We have reached the mechanical half of that statement. The browser/Owner half remains open.**

Only after those remaining gates should the project move to the large Companion Coordination Core redesign.
