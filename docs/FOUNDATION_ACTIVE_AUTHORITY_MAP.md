# Foundation Active Authority Map

Status: **FOUNDATION HARDENING — LIVE AUTHORITY MAP**

This document answers one narrow question before the next large redesign: **which code currently owns behavior, and which code is retained only as history / donor evidence?**

The repository intentionally preserves experimental strata. File age, an old qualification document, or the continued presence of a class does not make that class current runtime authority.

## Current browser runtime chain

### 1. Bootstrap and catastrophic-fault boundary

`src/main.ts`

Current authority:
- installs `runtime-fault-sentinel` before Phaser;
- creates the Phaser game with `R1LabScene`;
- first uncaught runtime fault stops the Phaser game loop and leaves the last rendered evidence visible behind the independent fault surface;
- constructor/startup failure is normalized into the same fault surface.

Supporting authority:
- `src/debug/runtime-fault-sentinel.ts`

The sentinel is **observability + fail-stop**, not unknown-fault recovery.

### 2. Owner-facing orchestration / workbench

`src/app/r1-lab-scene.ts`

Owns current browser orchestration:
- input and scenario control;
- relationship objective request;
- pre-World route and movement evidence;
- player + companion MotionIntent submission;
- World step;
- post-World route/evidence recomputation;
- recovery observation;
- causal trace / incident export;
- workbench visualization.

This scene is an apparatus/orchestrator. It should not silently become a second movement brain.

### 3. Relationship objective authority

`src/brain/relational-positioning.ts`

Current temporary authority for the semantic relationship target. It still uses the legacy eight-slot vocabulary, but ordinary slot exhaustion is now represented as `NO_VALID_RELATIONAL_SLOT` / `hold-current` rather than an exception.

Its eight-slot policy is deliberately **not** considered final architecture. It is a bounded current objective provider that the next redesign may replace aggressively.

Static endpoint validity is delegated to:
- `src/navigation/static-body-geometry.ts`

### 4. Static route authority

`src/navigation/static-router.ts`

Current static route authority:
- hard-body graph connectivity;
- desired/comfort-clearance evidence;
- deterministic route selection;
- explicit hard-overlap egress only for edges leaving an already-overlapping start;
- shared target/body point validity.

Supporting geometry:
- `src/navigation/static-body-geometry.ts`

The router does not own dynamic player cooperation.

### 5. Active local movement stack

Browser runtime enters:
- `src/brain/r1-workbench-spatial-stack.ts`

It selects one of two A/B realization paths while preserving shared spatial/recovery semantics.

#### DIRECT path

`r1-workbench-spatial-stack.ts`
→ `r1-recovering-direct-spatial.ts`
→ `r1-hard-comfort-spatial.ts`

#### NATURAL path

`r1-workbench-spatial-stack.ts`
→ `r1-recovering-natural-spatial.ts`
→ `r1-natural-spatial-locomotion.ts`
→ `r1-hard-comfort-spatial.ts`
→ optional normal-regime refinement / continuity / final constraint

Normal NATURAL realization uses:
- `src/brain/preferred-velocity-refinement.ts`
- `src/brain/motion-continuity.ts`
- `src/brain/final-command-constraint.ts`

`HARD_EGRESS` is a safety regime: it bypasses temporal refinement/continuity and executes an upstream-approved egress move through egress-aware final validation.

`NO_SAFE_VELOCITY` is a typed fail-closed hold, not an exception.

### 6. Important symbol-level dependency on preserved S3 code

`src/brain/spatial-locomotion.ts` is **mixed authority**, not simply active or historical.

Active R1 uses its low-level primitives and data model:
- spatial observation;
- candidate generation/scoring;
- candidate selection when at least one candidate is admissible;
- constants/types used by the R1 wrapper.

However these old entry points are **not current browser runtime authority**:
- raw `evaluateSpatialLocomotion()` ordinary candidate-exhaustion semantics;
- raw `SpatialLocomotionBrain` as an independently authoritative mover.

The R1 hard/comfort adapter owns the ordinary zero-admissible-candidate boundary before calling the historical selector. Therefore the preserved S3 throw in `chooseSpatialVelocity()` is an internal invariant for callers that violate that boundary, not the current gameplay state machine.

This distinction is intentionally explicit so a future redesign can replace candidate generation without accidentally reviving historical top-level authority.

### 7. World / physics authority

Domain boundary:
- `src/world/world.ts`

Physical execution:
- `src/physics/rapier-physical-world.ts`

Rapier owns physical resolution. The brain requests motion; it does not author final body positions.

Static traversal and occupancy queries also come through the physical world adapter. Dynamic actors are intentionally excluded from static geometry queries.

### 8. Post-World temporal progress / recovery authority

After each World step:
- route is recomputed from post-World state;
- `src/brain/r1-recovery-supervisor.ts`
- `src/brain/progress-recovery.ts`

The progress monitor owns temporal classification such as:
- ARRIVED;
- PROGRESSING;
- TRACKING_MOVING_OBJECTIVE;
- INTENTIONAL_HOLD;
- BLOCKED_PLAYER / BLOCKED_STATIC;
- ROUTE_INVALID;
- transient/persistent unreachable;
- RECOVERING / NO_PROGRESS.

Only bounded `RETRY_LOCAL` is executed by the R1 wrapper. Higher-level reconsider/report actions remain evidence for an upstream authority rather than hidden movement mutations.

`NO_SAFE_VELOCITY` is explicitly forwarded as an intentional safety hold so the recovery monitor does not invent fake no-progress.

### 9. Causal evidence authority

Current causal evidence:
- `src/debug/causal-frame-trace.ts`
- `src/debug/causal-panel.ts`
- incident export in `src/app/r1-lab-scene.ts`

Incident-v2 legacy recovery fields remain for compatibility:
- `retryCount`;
- `appliedLocalRetries`.

New public frame aliases make their scopes self-describing:
- `retryBudgetUsedThisEpisode`;
- `cumulativeLocalRetriesSinceReset`.

A future deliberate incident-schema v3 may remove the old names. This foundation campaign does not silently break v2 consumers.

## Preserved historical / donor apparatus — not current browser authority

The following are intentionally retained but are not the current launched scene / top-level movement authority:

- `src/app/lab-scene.ts`;
- `src/app/s4-lab-scene.ts`;
- `src/brain/natural-spatial-locomotion.ts` and its old top-level S4 path;
- raw historical S1/S3/S4 entry points superseded by R1 wrappers;
- older S0-S5 qualification documents and browser-gate documents;
- old S5 relationship-field research until it is explicitly transplanted and independently requalified.

Historical tests remain useful regression/donor evidence. Their continued success does not automatically promote their old architecture back into current authority.

## Authority boundaries intentionally left open for the next redesign

Foundation readiness does **not** require freezing these interfaces as final architecture:

- eight-slot relationship objective provider;
- fixed experiment max-speed policy;
- `MotionIntent` shape;
- dynamic player right-of-way / movement corridor ownership;
- pace / urgency / catch-up policy;
- multi-companion coordination;
- combat / command hierarchy.

These are exactly the seams intended for aggressive redesign after the foundation gate.

## Current call-chain summary

`main / fault boundary`
→ `R1LabScene orchestration`
→ `relationship objective`
→ `shared static target geometry`
→ `static route`
→ `R1 workbench stack`
→ `R1 hard/comfort local safety`
→ `DIRECT` **or** `NATURAL realization`
→ `World`
→ `Rapier`
→ `post-World route`
→ `progress/recovery`
→ `causal evidence / Owner workbench`

Unknown faults escape this chain only into the global fail-stop sentinel; ordinary constrained-world conditions must remain represented inside the chain as data.
