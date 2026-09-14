# Foundation Runtime Survival / Pre-Rework Audit

Status: **ACTIVE HARDENING CAMPAIGN — NOT YET REWORK-READY**

This document is the live gate between R1 research history and the next intentionally aggressive companion-system redesign.

The exit condition is not “the latest bug seems fixed.” The exit condition is a sufficiently clean, legible and fault-tolerant foundation that large changes to relationship reasoning, pace/catch-up and player cooperation can be made without inheriting known hidden failure semantics.

## Owner evidence that reopened the foundation

The R1-4 audited runtime had strong mechanical evidence, but the Owner browser gate reproduced a whole-workbench freeze. The visible panel remained `RUNNING`; the last completed causal frame stopped at `observation t1886 -> outcome t1887`; player and companion input ceased to produce further World outcomes.

This invalidates the prior open Owner gate while preserving the earlier automated evidence as historical evidence.

A separately captured pillar incident at tick 2027 is not the freeze incident. Its retained tail is mostly healthy `PROGRESSING -> ARRIVED`, but its event history demonstrates repeated tracking, transient unreachable, player blocking, persistent unreachable and recovery episodes. It also exposed a debug-semantics ambiguity: `retryCount` is per semantic episode while `appliedLocalRetries` is cumulative since stack reset.

## Freeze causal chain — current status

**High-confidence mechanism, now bound by deterministic regressions:**

1. ordinary Rapier contact can leave the dynamic companion in slight hard-body penetration/tolerance against static geometry;
2. the pre-foundation R1 local hard check treated initial hard overlap as an immediate blocked sweep even for outward motion;
3. the player prediction layer could simultaneously reject STOP as a future player collision;
4. candidate exhaustion reached the preserved S3 invariant `Spatial locomotion produced no admissible candidates`;
5. that uncaught exception could terminate the Phaser scene update before the next World tick, leaving the last rendered panel at `RUNNING`.

A second ordinary-state termination seam existed in the legacy relationship brain: all eight authored relational slots being illegal reached `No valid relational positioning candidate`.

## Foundation contract now being enforced

Normal world states must be data, not exceptions.

Public survival vocabulary now includes:
- `NORMAL` local safety;
- `HARD_EGRESS` when the physical body starts in static overlap but an outward whole-body escape exists;
- `NO_SAFE_VELOCITY` when no local velocity is admissible, producing fail-closed STOP rather than termination;
- `NO_VALID_RELATIONAL_SLOT` when the legacy eight-slot vocabulary is exhausted, producing hold-current + tactical reconsideration rather than termination.

`NO_SAFE_VELOCITY` is propagated into progress/recovery as an intentional safety hold. It must not masquerade as unexplained no-progress and spend retry budget merely because the system consciously chose fail-closed STOP.

## Hard-overlap egress must be coherent through the entire chain

Hard egress is not a local-brain-only exception.

The foundation requires coherent semantics across:

`static route -> local spatial choice -> NATURAL realization -> final hard validation -> World -> post-outcome recovery`

Current hardening changes:
- router start edges use initial-overlap egress semantics only when the route start is already physically overlapping;
- route targets/corner nodes remain required to be physically valid;
- local candidate repair uses `allow-egress` plus a hard-clear long-horizon endpoint before rehabilitating a movement candidate;
- NATURAL treats `HARD_EGRESS` as a safety regime: temporal continuity/refinement is bypassed, approved upstream egress movement is executed directly, and final validation uses explicit initial-overlap egress semantics;
- normal NATURAL behavior returns immediately after physical clearance is restored.

## Shared static point-validity contract

The old code had two different meanings of “this body fits at this target.”

Legacy relationship used exact circle-vs-AABB endpoint geometry. The router used a square AABB expanded by body radius, which is overly conservative around obstacle corners and could produce `relationship valid -> route invalid-target` disagreement.

Foundation hardening centralizes this in `circleFitsStaticWorld()` using body-circle vs obstacle-AABB geometry plus world-boundary fit. Router and legacy relationship now consume the same primitive.

This is intentionally a point-validity contract only. Whole-path feasibility remains the responsibility of whole-body traversal queries.

## Runtime fault containment

Ordinary world states are being removed from exception paths, but genuine programmer/data/runtime faults must remain visible rather than leaving a frozen canvas with stale `RUNNING` text.

`runtime-fault-sentinel` is installed before Phaser and independently listens for:
- `window.error`;
- `unhandledrejection`.

On the first catastrophic fault it renders a DOM-level `RUNTIME FAULT — SIMULATION FAIL-STOPPED` surface with message, stack/location when available, fault JSON download and workbench reload.

The sentinel deliberately does **not** pretend an unknown internal fault is recoverable. Its contract is observability after fail-stop, not silent continuation.

## Active-path throw audit

### Ordinary world states — throws forbidden

Resolved / covered:
- local velocity candidate exhaustion;
- no legal legacy relationship slot;
- desired-clearance overlap;
- hard-overlap outward egress;
- temporary route loss / persistent unreachable;
- player/static blocking;
- intentional fail-closed hold.

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

## Cleanup completed during this campaign

- removed stale package version label `0.0.0-s1`; current lab prerelease is `0.1.0-foundation.0`;
- validation workflow now explicitly includes `foundation/**` pushes;
- GitHub Actions checkout/setup-node moved from Node-20-based v4 actions to v5;
- R1-4 PR is explicitly marked Owner FAIL / evidence preserved rather than leaving a stale open-gate claim;
- runtime survival has dedicated deterministic regressions rather than relying on manual reproduction only;
- static body target validity is centralized;
- hard-egress semantics are being propagated end-to-end rather than patched at one layer.

## Known non-blocking research history

The repository intentionally retains older S0-S5 modules/tests as research baselines. Their behavior is not automatically the current runtime authority.

In particular, the preserved S3 `chooseSpatialVelocity()` may still throw on zero accepted candidates because it is a historical baseline. The active post-R1 foundation adapter must never forward ordinary candidate exhaustion into that throw. Tests bind this boundary.

Do not “clean” historical evidence by rewriting every old experiment to modern semantics. Clean authority boundaries instead.

## Open foundation debt before readiness can be claimed

1. **Dynamic survival rehearsal** — the full Rapier + route + R1 NATURAL + recovery chain must survive the hard-overlap/approaching-player class for a long multi-tick run, actually execute hard egress and return to NORMAL.
2. **Fault-sentinel browser proof** — automated normalization/build evidence is insufficient; a browser rehearsal must show that a deliberately surfaced fault produces the independent fault UI rather than a silent frozen `RUNNING` canvas.
3. **Debug counter semantics** — incident/debug documentation must make explicit that progress `retryCount` is episode-local while workbench `appliedLocalRetries` is cumulative since stack reset. A future incident-schema revision may rename them, but ambiguity must not remain undocumented.
4. **Active authority map** — final handoff/readiness state must state which modules are active authority versus preserved historical baselines.
5. **Final claim-vs-code audit** — rerun a broad search for ordinary-state throws and stale contradictory contracts after repairs, not merely before them.
6. **Owner torture gate** — wall pin/push/release, doorway contention, rapid reversals and longer continuous movement must complete without whole-runtime freeze or unexplained shutdown.

## Explicitly deferred to the next aggressive redesign, not blockers to foundation readiness

These are important product limitations, but they are intentionally **not** to be solved inside the cleanup campaign:

- replacing the legacy eight-slot relationship model with Relationship Field v2 / region reasoning;
- player movement corridor, right-of-way and chokepoint cooperation;
- dynamic pace / urgency / catch-up speed budget;
- redesigning `MotionIntent` around explicit desired velocity / speed authority;
- combat, commands, multiple companions;
- promotion/transplant of old S5 shadow research.

Those are the next “large-change” layer. The purpose of this campaign is to make the substrate safe enough to change them aggressively.

## Readiness exit statement

The campaign may be declared complete only when the evidence supports the following statement without qualification:

> Ordinary constrained-world states cannot terminate the active runtime; hard-overlap egress is coherent through route, local motion and actuation; catastrophic faults remain observable outside the Phaser update loop; static geometry semantics are shared; current authority is explicit; the full automated suite and dynamic survival rehearsals are green; and an Owner torture gate shows no unexplained whole-runtime shutdown.

Only then should the project move to the large Companion Coordination Core redesign.
