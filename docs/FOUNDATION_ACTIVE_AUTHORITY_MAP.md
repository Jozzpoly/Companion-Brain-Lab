# Foundation Active Authority Map

Status: **FOUNDATION PASS · REWORK-READY · LIVE AUTHORITY MAP**

Owner-tested public runtime:

`b217943e027e66993f0010643b2933b01d4b1e6d`

Latest test-only foundation head adding DIRECT survival coverage:

`7c2d25dead58ca26d3bb195bc1b91911c60d32a5`

Canonical readiness verdict:

[`FOUNDATION_FINAL_READINESS.md`](FOUNDATION_FINAL_READINESS.md)

This document answers one question: **which code owns the current defended substrate, and which code is preserved only as historical / donor evidence before the next aggressive redesign?**

## Current runtime authority

### Bootstrap / catastrophic fault boundary

Authority:

- `src/main.ts`
- `src/debug/runtime-fault-sentinel.ts`
- `src/debug/foundation-fault-probe.ts`

Responsibilities:

- install fail-stop observability before Phaser;
- create the active `R1LabScene`;
- stop the Phaser loop on the first uncaught catastrophic fault;
- preserve first-fault evidence and expose the independent fault surface;
- keep the research-only deliberate fault probe one-shot.

The sentinel is observability + fail-stop, not unknown-fault recovery.

### Owner-facing orchestration / workbench

Authority:

- `src/app/r1-lab-scene.ts`
- `src/app/static-traversal-query-adapter.ts`

Responsibilities:

- input/scenario controls;
- pre-step relationship / route / movement orchestration;
- player + companion MotionIntent submission;
- World step;
- post-World route/recovery observation;
- causal trace / incident export;
- research visualization.

`bindWorldStaticTraversalQuery()` preserves the full traversal signature, including `StaticTraversalOptions`, so browser authority cannot silently drop egress semantics proven headlessly.

### Temporary relationship objective

Authority:

- `src/brain/relational-positioning.ts`

Current vocabulary is still the legacy eight-slot model.

Public objective states:

- `TARGET`;
- `NO_VALID_RELATIONAL_SLOT`.

All-slot exhaustion is an intentional hold/reconsider state, not an exception and not fake arrival.

This module is intentionally **temporary authority** and is expected to be replaced aggressively by player-relative region / field reasoning.

### Static point validity / route authority

Authority:

- `src/navigation/static-body-geometry.ts`
- `src/navigation/static-router.ts`

Contracts:

- point/body fit is distinct from swept traversal;
- hard physical connectivity is distinct from desired/comfort clearance;
- route targets/corner nodes remain normally hard-valid;
- every hard edge leaving the live physical `start` uses egress-aware traversal;
- exact contact can move away from geometry but not into it.

The static router does not own dynamic player cooperation/right-of-way.

### Local movement authority

Entry point:

- `src/brain/r1-workbench-spatial-stack.ts`

Shared safety / preferred-motion layer:

- `src/brain/r1-hard-comfort-spatial.ts`

DIRECT realization:

- `src/brain/r1-recovering-direct-spatial.ts`

NATURAL realization:

- `src/brain/r1-recovering-natural-spatial.ts`
- `src/brain/r1-natural-spatial-locomotion.ts`
- `src/brain/preferred-velocity-refinement.ts`
- `src/brain/motion-continuity.ts`
- `src/brain/final-command-constraint.ts`

Foundation safety vocabulary includes:

- `NORMAL`;
- `HARD_EGRESS`;
- `NO_SAFE_VELOCITY`.

`HARD_EGRESS` is a safety regime: NATURAL bypasses temporal smoothing/continuity and executes the approved outward escape through egress-aware final validation.

A body in true hard penetration cannot classify STOP as a normal admissible safe result. If no hard-clearing egress exists, the system exposes `NO_SAFE_VELOCITY` and fail-closes without throwing.

### Preserved S3 primitive dependency

`src/brain/spatial-locomotion.ts` is mixed authority.

R1 still uses its low-level observation / candidate generation / scoring / selection primitives and types.

The old raw top-level S3 mover is **not** current browser authority. R1 intercepts ordinary zero-admissible-candidate states before historical invariant throws can become gameplay termination.

### World / physics authority

Authority:

- `src/world/world.ts`
- `src/physics/rapier-physical-world.ts`

World owns domain progression and MotionIntent validation. Rapier owns physical resolution and static scene queries. Brain layers request motion; they do not author final body positions.

### Post-World progress / recovery

Authority:

- `src/brain/r1-recovery-supervisor.ts`
- `src/brain/progress-recovery.ts`

Public temporal states include arrival, progress, moving-objective tracking, intentional hold, player/static blocking, invalid route, transient/persistent unreachable, no-progress and recovering.

Ordering matters:

1. invalid/unreachable route truth outranks arrival;
2. explicit intentional hold outranks coincident geometric arrival;
3. ordinary arrival is considered afterwards.

Only bounded `RETRY_LOCAL` has local movement authority. Higher-level reconsider/report actions remain evidence for upstream coordination authority.

### Causal evidence authority

Authority:

- `src/debug/causal-frame-trace.ts`
- `src/debug/causal-panel.ts`
- incident export in `src/app/r1-lab-scene.ts`.

Causal evidence preserves:

- pre-step relationship/route/motion decision;
- actual command realization;
- World outcome;
- post-World route/recovery state;
- explicit relationship state;
- episode retry usage and cumulative local retry count.

Incident-v2 legacy field names remain for compatibility; self-describing aliases expose their scopes.

## Qualification surface

Owner-tested public runtime `b217943e...`:

- 31/31 test files PASS;
- 137/137 tests PASS;
- TypeScript/build PASS;
- npm audit 0 vulnerabilities;
- exact Pages deployment PASS;
- real-browser fault-containment evidence;
- approximately 123-second ordinary Owner torture PASS with no unexplained substrate failure.

Later test-only branch head `7c2d25d...`:

- 32/32 test files PASS;
- 138/138 tests PASS;
- adds the parallel DIRECT 180-step full-chain survival rehearsal;
- no browser runtime behavior change.

## Historical / donor code — not current top-level authority

Preserved for research evidence or selective reuse:

- `src/app/lab-scene.ts`;
- `src/app/s4-lab-scene.ts`;
- old S1/S3/S4 top-level movers;
- old S0-S5/R1 qualification documents;
- S5 continuous relationship-field research;
- R1-5A red dynamic player-conflict research.

Historical success/failure remains evidence but does not restore old architecture to current authority.

## Explicitly open for aggressive redesign

Foundation PASS does not freeze:

- the eight-slot relationship objective;
- fixed experiment max speed;
- pace / urgency / catch-up authority;
- `MotionIntent` shape / desired-speed contract;
- dynamic player right-of-way / movement corridor;
- NATURAL post-continuity dynamic player-conflict handling;
- multi-companion coordination;
- commands;
- combat.

These are the intended seams of the next Companion Coordination Core redesign.

## Current defended call chain

`bootstrap / fault boundary`
→ `R1LabScene`
→ `temporary relationship objective`
→ `shared static point validity`
→ `full-signature traversal adapter`
→ `static route / live-start egress`
→ `R1 hard-vs-comfort spatial safety`
→ `DIRECT or NATURAL realization`
→ `World`
→ `Rapier`
→ `post-World route`
→ `progress / recovery`
→ `causal evidence`.

Unknown programmer/data faults fail-stop through the sentinel. Ordinary constrained-world states remain represented as data inside the chain.
