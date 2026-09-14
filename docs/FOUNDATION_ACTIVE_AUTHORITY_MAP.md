# Foundation Active Authority Map

Status: **MECHANICAL FOUNDATION PASS · LIVE AUTHORITY MAP · BROWSER / OWNER GATES OPEN**

Mechanically qualified runtime source: `81877d7fab6b52d4ea683c870074cf12e0793c43`.

This document answers one narrow question before the next large redesign: **which code currently owns behavior, and which code is retained only as history / donor evidence?**

The repository intentionally preserves experimental strata. File age, an old qualification document, or the continued presence of a class does not make that class current runtime authority.

## Current browser runtime chain

### 1. Bootstrap and catastrophic-fault boundary

`src/main.ts`

Current authority:
- installs `runtime-fault-sentinel` before Phaser;
- creates the Phaser game with `R1LabScene`;
- first uncaught runtime fault stops the Phaser game loop and leaves the last rendered evidence visible behind the independent fault surface;
- constructor/startup failure is normalized into the same fault surface;
- schedules the research-only deterministic fault probe only when the exact query flag `foundationFaultProbe=1` is present.

Supporting authority:
- `src/debug/runtime-fault-sentinel.ts`
- `src/debug/foundation-fault-probe.ts`

The sentinel is **observability + fail-stop**, not unknown-fault recovery. The fault probe is qualification apparatus, not gameplay behavior.

### 2. Owner-facing orchestration / workbench

`src/app/r1-lab-scene.ts`

Owns current browser orchestration:
- input and scenario control;
- relationship objective request;
- pre-World route and movement evidence;
- player + companion `MotionIntent` submission;
- World step;
- post-World route/evidence recomputation;
- recovery observation;
- causal trace / incident export;
- workbench visualization.

The scene is an apparatus/orchestrator. It should not silently become a second movement brain.

A critical browser boundary is named and test-bound rather than expressed as an ad-hoc lambda:
- `src/app/static-traversal-query-adapter.ts`

`bindWorldStaticTraversalQuery()` forwards the complete `StaticTraversalQuery` signature, including `StaticTraversalOptions`. This prevents the browser scene from silently dropping `initialOverlap: "allow-egress"` while headless tests remain green.

### 3. Relationship objective authority

`src/brain/relational-positioning.ts`

Current temporary authority for the semantic relationship objective. It still uses the legacy eight-slot vocabulary.

Its public decision now distinguishes:
- `objectiveState: "TARGET"`;
- `objectiveState: "NO_VALID_RELATIONAL_SLOT"`.

When every legacy slot is illegal, the brain holds current body position and schedules tactical reconsideration rather than throwing. The exhausted vocabulary state is propagated into post-World recovery as `INTENTIONAL_HOLD`; it must not masquerade as `ARRIVED` merely because the temporary hold target equals the current body position.

The eight-slot policy is deliberately **not** final architecture. It is a bounded current objective provider that the next redesign may replace aggressively.

Static endpoint validity is delegated to:
- `src/navigation/static-body-geometry.ts`.

### 4. Static point-fit and traversal semantics

Point/body fit authority:
- `src/navigation/static-body-geometry.ts`

`circleFitsStaticWorld()` is shared by relationship endpoint validity and static routing.

Important contract separation:
- point occupancy/body fit answers whether a circular body can occupy a coordinate;
- swept traversal answers whether movement between two coordinates is feasible.

Obstacle tangency is non-penetrating point occupancy. Exact authored world-boundary tangency is also mathematically legal in the domain helper, while Rapier's overlap query may classify exact contact differently. Tests therefore require physical-backend parity on materially clear/penetrating states rather than forcing point-fit semantics to copy an overlap-query edge case.

### 5. Static route authority

`src/navigation/static-router.ts`

Current static route authority:
- hard-body graph connectivity;
- desired/comfort-clearance evidence;
- deterministic route selection;
- shared target/body point validity;
- egress-aware **hard start edges** for the live physical start node.

Every hard edge leaving `start` uses `initialOverlap: "allow-egress"`. This is intentional even when the mathematical point-fit helper says the start is legal, because exact physical contact can still produce a zero-distance Rapier cast hit.

This is bounded by a directionality regression:
- from exact boundary contact, movement away from the wall clears;
- movement into the wall remains blocked.

Target/corner nodes do not receive this live-start privilege. Route targets remain physically valid points and ordinary graph nodes use ordinary traversal semantics.

The router does not own dynamic player cooperation.

### 6. Active local movement stack

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

A body already in true hard penetration cannot classify STOP as an admissible safe velocity. Only a hard-clearing egress move is admissible; if none exists the public state is `NO_SAFE_VELOCITY` and the system fail-closes to STOP without throwing.

### 7. Important symbol-level dependency on preserved S3 code

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

### 8. World / physics authority

Domain boundary:
- `src/world/world.ts`

Physical execution:
- `src/physics/rapier-physical-world.ts`

Rapier owns physical resolution. The brain requests motion; it does not author final body positions.

Static traversal and occupancy queries also come through the physical world adapter. Dynamic actors are intentionally excluded from static geometry queries.

### 9. Post-World temporal progress / recovery authority

After each World step:
- route is recomputed from post-World state;
- `src/brain/r1-recovery-supervisor.ts`;
- `src/brain/progress-recovery.ts`.

The progress monitor owns temporal classification such as:
- `ARRIVED`;
- `PROGRESSING`;
- `TRACKING_MOVING_OBJECTIVE`;
- `INTENTIONAL_HOLD`;
- `BLOCKED_PLAYER` / `BLOCKED_STATIC`;
- `ROUTE_INVALID`;
- transient/persistent unreachable;
- `RECOVERING` / `NO_PROGRESS`.

Ordering is part of the contract:
1. invalid/unreachable route truth outranks all proximity claims;
2. an explicit upstream intentional hold outranks coincident geometric arrival;
3. ordinary arrival is considered only after those semantic states.

Only bounded `RETRY_LOCAL` is executed by the R1 wrapper. Higher-level reconsider/report actions remain evidence for an upstream authority rather than hidden movement mutations.

`NO_SAFE_VELOCITY` and `NO_VALID_RELATIONAL_SLOT` are explicitly forwarded as intentional holds so recovery does not invent fake arrival or no-progress.

### 10. Causal evidence authority

Current causal evidence:
- `src/debug/causal-frame-trace.ts`
- `src/debug/causal-panel.ts`
- incident export in `src/app/r1-lab-scene.ts`.

Decision evidence includes explicit `relationshipState`, so objective-vocabulary exhaustion remains visible in incident files rather than being inferred from a magic slot string.

Incident-v2 legacy recovery fields remain for compatibility:
- `retryCount`;
- `appliedLocalRetries`.

Self-describing aliases expose their scopes:
- `retryBudgetUsedThisEpisode`;
- `cumulativeLocalRetriesSinceReset`.

`CausalFrameTrace` fills these aliases automatically from legacy fields when needed, and the real scene emits them directly. A future deliberate incident-schema v3 may remove the old names; this foundation campaign does not silently break v2 consumers.

## Mechanically qualified evidence surface

Runtime source `81877d7fab6b52d4ea683c870074cf12e0793c43` passed CI run `34872163500`:
- TypeScript PASS;
- 31/31 test files PASS;
- 136/136 tests PASS;
- production Vite build PASS;
- npm audit: 0 vulnerabilities.

The suite includes dedicated regressions for:
- 180-step full-chain hard-egress survival and return to NORMAL;
- no-safe-velocity fail-closed behavior;
- exact-contact start-edge routing;
- egress directionality at world boundaries;
- full browser traversal-query option forwarding;
- relationship-vocabulary exhaustion as intentional hold rather than arrival;
- first-fault containment latch;
- deterministic fault-probe activation;
- incident-v2 recovery alias compatibility.

This is a **mechanical qualification**, not an Owner browser qualification.

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
→ `relationship objective + objectiveState`
→ `shared static target geometry`
→ `typed full-signature World traversal adapter`
→ `static route with egress-aware live start`
→ `R1 workbench stack`
→ `R1 hard/comfort local safety`
→ `DIRECT` **or** `NATURAL realization`
→ `World`
→ `Rapier`
→ `post-World route`
→ `progress/recovery`
→ `causal evidence / Owner workbench`.

Unknown faults escape this chain only into the global fail-stop sentinel; ordinary constrained-world conditions must remain represented inside the chain as data.
