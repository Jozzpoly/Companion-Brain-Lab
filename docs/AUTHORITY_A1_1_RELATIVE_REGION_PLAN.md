# Authority-A1.1 — Player-Relative Useful Region Plan

Status: **CANONICAL A1.1 PLANNING CHECKPOINT · NO NEW MOVEMENT AUTHORITY**

Parent stage:

- `docs/AUTHORITY_A1_STAGE_PLAN_V2.md`
- `docs/AUTHORITY_A1_0_EXECUTION_EVIDENCE.md`
- exact qualified A1.0 runtime `7c0efd86f8c4808754f3e984e7af104854afcd3c`
- validate #751 PASS

Planning branch starts from A1.0 docs head:

`277103133b1cff0b73e0577f4202b2c96ee293c3`

This stage is deliberately representational and non-authoritative. A1.1 exists to make relationship meaning correct enough that A1.2 can later reason about PACE and world-unit velocity without chasing stale points or inheriting legacy slot semantics.

---

## 1. Stage question

Can A1 represent useful companion relationship space primarily as **player-relative semantic states**, then project those states into the current world for hard feasibility/topology evidence, while preserving fresh Owner intent, honest uncertainty, relative-space continuity and exact baseline movement?

A1.1 passes only if the representation survives adversarial translation, rotation, reversal, stationary periods, external player displacement, obstacle/topology changes and partial route qualification without collapsing back into one world-space target.

A1.1 does **not** choose a new authoritative companion velocity.

---

## 2. Live seams inherited from A1.0

A1.0 gives A1.1 a qualified decision boundary:

```text
before World snapshot @ t
+ current same-step Owner/player MotionIntent @ t
+ player/companion MovementCapability
+ previous completed A0 outcome ending @ t
        |
        v
A1Situation @ t
```

Important executable facts:

- current Owner request is distinct from previous body outcome;
- real same-tick reversal is visible before companion submission;
- external body motion remains physically visible without becoming current Owner input;
- previous outcome must match tick and scenario;
- the rich decision snapshot after t0 is the previous `World.step()` result, not a neutralized fresh `LabWorld.snapshot()`;
- A1 state already has an isolated epoch/reset boundary;
- A1 OFF bypasses the new path and DIRECT/TEMPORAL are still exact pass-through.

A1.1 must preserve all of these properties.

---

## 3. Critical donor audit

### 3.1 CCC-0 material worth preserving

From `shadow-relationship-region.ts` and its qualification history:

- broad polar sampling is a useful experimental probe;
- body-fit must be hard geometry first;
- route qualification is separate from local point validity;
- disconnected near-best sets must remain disconnected;
- a coherent region is more truthful than one averaged target;
- bounded qualification must say when evidence is incomplete;
- hard feasibility and desired comfort must remain distinct;
- continuity/topology evidence is useful when its provenance is explicit.

The existing 32 directions × 3 radii can be reused initially as a **controlled sampling donor**, not as an architectural invariant.

### 3.2 CCC-0 material explicitly rejected

Do not carry forward unchanged:

- `actual -> requested -> previous` as semantic player heading;
- current world-space sample `position` as relationship meaning;
- world-space `previousRepresentative` as continuity state;
- one `representativeAnchor` as semantic authority;
- a monolithic score mixing front/radius/travel/comfort/continuity/route terms;
- the assumption that a bounded route shortlist describes all unreachable space;
- current radii, weights, score window or route budget as permanent policy constants.

### 3.3 Legacy relational brain is an anti-donor for semantics

`RelationalPositioningBrain` preserves useful historical lessons but its eight named slots, point target, velocity-derived direction and target-chasing contract are not A1.1 architecture.

It remains a baseline comparison only.

### 3.4 Hard-route donor

`evaluateHardRouteTruth()` is the preferred factual donor because it separately exposes:

- hard-body reachability;
- desired-clearance reachability;
- `comfortErasesHardConnectivity`.

A1.1 must not interpret desired/comfort failure as hard unreachable.

The current static router remains an implementation donor, not the semantic definition of relationship topology.

---

## 4. Core representation split

A1.1 must separate three concepts that CCC-0 partly mixed together.

### 4.1 Semantic relative state

Meaning relative to the player:

```text
radial relationship
relative bearing / directional relation when semantic orientation exists
semantic utility terms
orientation provenance
```

This meaning must not depend on absolute world position.

### 4.2 World projection evidence

A semantic sample projected into the current world can expose:

```text
world position
hard body fit
hard route state
route/topology evidence
desired comfort state
travel/access cost
qualification freshness/coverage
```

Projection evidence is factual support for the semantic state. It is not the semantic state itself.

### 4.3 Debug / adapter representative

A representative may exist only for:

- visualization;
- bounded APIs that require one point;
- comparison with legacy targets.

It must never become the implicit relationship objective.

Prefer a representative **member sample** or medoid-like member over a synthesized centroid. Never average disconnected components through invalid space.

---

## 5. Owner-intent-safe relationship orientation

A1.1 needs its own semantic orientation contract.

Provisional source order:

1. meaningful same-step Owner control from `A1Situation@t`;
2. otherwise recent, explicitly aged **Owner-derived** orientation memory;
3. otherwise `NONE`.

External or mixed actual body motion never refreshes semantic orientation memory.

### 5.1 Provisional evidence

```text
A1RelationshipOrientation
  sourceTick
  source: SAME_STEP_OWNER | OWNER_MEMORY | NONE
  direction: Vec2 | null
  ageTicks: number | null
  strength: number
  reason
```

### 5.2 Memory rules

- age in **World ticks**, not evaluator-call count;
- monotone fading strength;
- bounded lifetime;
- same-step Owner reversal replaces the semantic direction immediately;
- external push cannot refresh age or direction;
- expiry ends in `NONE`, not world +X.

The CCC-0 smooth fade is donor evidence only. A1 gets its own memory contract and constants so trajectory-memory policy does not silently become relationship semantics.

### 5.3 Projection basis is not semantic facing

Sampling still needs a deterministic geometric basis even when semantic orientation is `NONE`.

Keep this distinction explicit:

```text
semanticOrientation: direction | null
projectionBasis: unit direction
projectionBasisSource:
  SEMANTIC_ORIENTATION
  PRIOR_PROJECTION_BASIS
  WORLD_AXIS_BOOTSTRAP
```

When orientation is absent, the projection basis may keep the lattice stable, but directional semantic terms are disabled. This prevents both:

- fabricated semantic +X facing;
- an unnecessary sampling-lattice snap when orientation memory expires.

A projection basis must never be reported as Owner intention.

---

## 6. Relative semantic sample

Provisional sample contract:

```text
A1RelativeRegionSample
  id
  angleIndex
  radiusIndex
  radius
  relativeBearing
  relativeOffset
  semanticUtility
  semanticTerms
  directionalSemanticsActive
```

`relativeOffset` is expressed in the current projection/player frame, not as an absolute world position.

`semanticUtility` should initially contain only relationship meaning, for example:

- directional/front-vs-back preference when orientation exists;
- radial preference/range.

Do **not** put these in semantic utility:

- companion travel distance;
- route cost;
- comfort clearance;
- world anchor continuity;
- final movement smoothness.

Those are execution/projection concerns and belong to separate evidence.

This separation is a hard A1.1 design property.

---

## 7. Semantic usefulness vs physical availability

A sample can be semantically useful yet currently difficult or impossible to occupy.

Therefore A1.1 should expose both dimensions rather than folding them into one score.

Provisional projection state:

```text
A1RegionProjectionEvidence
  sampleId
  sourceTick
  worldPosition
  hardFit
  routeQualification:
    UNTESTED | HARD_REACHABLE | HARD_UNREACHABLE
  hardRouteStatus / cost / topology evidence
  desiredReachable
  comfortErasesHardConnectivity
  localClearance / comfort quality
```

Important distinction:

- `hardFit=false` is known local physical invalidity;
- `HARD_UNREACHABLE` is allowed only after that exact projection was route-qualified;
- `UNTESTED` remains unknown.

A bounded shortlist may not create a global `NO_REACHABLE_REGION` claim unless all relevant hard-fit samples were exhausted or another complete proof exists.

---

## 8. Keep multiple useful components

A1.1 should not immediately collapse all useful space to one chosen coherent component.

Output a set of components over semantically useful, confirmed-hard-reachable relative samples:

```text
A1UsefulRegionComponent
  id / fingerprint from member relative sample ids
  memberSampleIds
  semanticBestSampleId
  representativeSampleId   // debug/adapter only
  semanticUtilityRange
  hard/comfort summary
```

Reasons:

- obstacles can split useful relationship space into left/right or near/far alternatives;
- one selected component would reintroduce hidden target switching;
- A1.2 should be able to evaluate velocity against the whole admissible useful set;
- disconnected components must never be centroid-averaged together.

A1.1 may expose a debug-preferred component, but downstream authority must not assume it is the objective.

---

## 9. Relative-space continuity

CCC-0 world-anchor continuity is rejected.

A1.1 continuity uses semantic-relative evidence:

- sample-id overlap;
- component member overlap;
- component matching by maximum relative membership overlap;
- semantic orientation source/strength provenance;
- explicit comparability state.

Provisional continuity evidence:

```text
previousPresent
currentPresent
orientationRegimeComparable
semanticSampleOverlap
componentMatches[]
projectionTopologyChanged
playerTranslationDelta   // diagnostic only
representativeWorldDelta // diagnostic only
```

Pure player translation in equivalent local geometry must not appear as semantic region churn merely because every world projection moved.

Ordinary rotation with a valid semantic orientation should rotate world projections while preserving local semantic meaning.

A transition between directional and orientation-free semantics may be marked non-comparable rather than forcing false continuity.

---

## 10. Moving-frame hook for A1.2

A1.1 should expose a pure projection helper rather than implementing PACE now.

Conceptually:

```text
projectRelativeState(
  relativeSample,
  playerReferencePosition,
  semantic/projection basis
) -> worldPosition
```

A1.2 can later use the same semantic state against a predicted player reference at horizon `h`.

A1.1 must not hardwire `current world projection == future target`.

This is the architectural hand-off that prevents stale point chasing.

---

## 11. Runtime integration boundary

A1.1 remains pass-through.

When A1 DIRECT or TEMPORAL is selected in SPATIAL mode:

```text
baseline companion decision
A1Situation@t
A1.1 orientation/history
A1.1 relative semantic region
A1.1 world projection evidence
A1.1 continuity/components
        |
        v
record/debug only
        |
        v
return exact baseline companion MotionIntent
```

A1 OFF must still bypass A1 evaluation.

Do not install:

- useful-region movement authority;
- PACE;
- player cooperation;
- local velocity candidate authority;
- temporal realization;
- final player guard.

---

## 12. A1-owned history

Provisional A1.1 history:

```text
lastEvaluationTick
ownerOrientationDirection / sourceTick / age
projectionBasis
previousSemanticUsefulSampleIds
previousComponents
previousProjectionTopology summary
```

Do not store a world-space representative as semantic history.

Reset on the existing A1-owned epoch boundary:

- A1 variant switch;
- scenario reset;
- relevant base-mode/actuator reset already defined by A1.0.

Do not reset ordinary semantic history on every region refresh.

---

## 13. Performance / evidence discipline

A1.1 must not repeat the CCC-0 mistake where a small route shortlist hid a much larger static traversal cost.

Evidence must report:

- total semantic samples;
- hard-fit count;
- route-evaluated count;
- hard-reachable count;
- hard-unreachable count;
- untested count;
- actual static traversal query count;
- component count;
- source tick / age;
- evaluation duration in browser qualification when practical.

Before storing large region structures in `A1AuthorityRuntime.debugState()`, remove or avoid the known A1.0 eager deep-clone path for normal non-debug runtime. Heavy debug evidence should be lazy/bounded.

---

## 14. Required falsifiers

### 14.1 Translation invariance

Duplicate an open configuration with player + companion translated by the same vector and otherwise equivalent local geometry.

Require:

- same semantic utility by relative sample id;
- same useful semantic membership;
- same orientation provenance;
- world projections shift by the translation vector;
- no semantic continuity penalty from translation alone.

### 14.2 Rotation covariance

Rotate player, companion relative placement, same-step Owner input and local geometry by 90 degrees.

Require equivalent semantic utility/component structure in player-relative coordinates and correspondingly rotated world projections.

### 14.3 Same-step Owner reversal

At decision tick `t`, change Owner control +X -> -X.

Require semantic orientation uses -X at `t` even while previous completed body request still contains +X.

No previous body velocity may override current Owner semantics.

### 14.4 Solver-push semantic isolation

Owner control zero; companion physically pushes player.

Require:

- actual/external body motion remains visible in `A1Situation`;
- semantic orientation is not refreshed from that motion;
- with no valid Owner memory, orientation is `NONE`;
- with recent Owner memory, age continues increasing rather than resetting.

### 14.5 Stationary no-history symmetry

With zero Owner control and no semantic memory:

- orientation is `NONE`;
- no front/back penalty is fabricated;
- projection basis provenance is explicitly non-semantic;
- semantic utility does not prefer world +X merely because the lattice needs a basis.

### 14.6 Memory fade

After meaningful Owner direction followed by stop:

- memory strength decreases monotonically by World ticks;
- external motion does not refresh it;
- eventual state is `NONE`;
- expiry does not create a semantic world-axis heading.

### 14.7 Hard-only passage

Use the existing hard/comfort counterexample.

Require:

- hard-reachable sample remains physically available;
- desired comfort may be unreachable;
- `comfortErasesHardConnectivity` is visible;
- sample is not removed from hard admissible evidence merely for comfort.

### 14.8 Partial route coverage honesty

Force a qualification budget smaller than the hard-fit set.

Require:

- untested samples remain `UNTESTED`;
- no global unreachable claim;
- coverage counts exactly match executed qualifications.

### 14.9 Disconnected useful components

Create two disconnected near-best hard-reachable arcs.

Require:

- two components survive;
- no centroid/average point between them becomes semantic objective;
- each debug representative is an actual member sample.

### 14.10 Pure translation continuity

Advance player and companion together at equal displacement while preserving relative state.

Require:

- high/identical relative membership overlap;
- component identity/matching remains stable;
- world representative displacement may be large and is explicitly non-semantic.

### 14.11 Representation-boundary discontinuity

Sweep slowly across known CCC-0 representative/component discontinuities.

Require semantic utility and relative components change only for real semantic/feasibility reasons; a debug representative jump alone may not alter A1 movement because A1.1 still has no authority.

### 14.12 Exact movement non-interference

Repeat A1.0 deterministic differential with A1.1 evaluation enabled.

Require baseline companion intent and World outcomes remain exact under OFF/DIRECT/TEMPORAL pass-through.

---

## 15. Browser qualification

A1.1 browser gate should use the existing workbench rather than synthetic-only visualization.

Minimum run:

1. A1 OFF baseline silence;
2. A1 DIRECT pass-through with relative-region panel/overlay;
3. real straight Owner movement;
4. stop and memory fade;
5. real same-step reversal;
6. Pillar;
7. Doorway;
8. Head-on / external player displacement fixture if practical;
9. DIRECT -> TEMPORAL reset;
10. OFF restoration.

Require:

- no page/console/request errors;
- no runtime fault sentinel;
- no >1 s rendering stall;
- explicit timing report;
- same-step input provenance;
- route coverage/query counts visible;
- baseline command still exact pass-through.

Browser mechanical PASS remains distinct from Owner feel PASS.

---

## 16. Bounded implementation sequence

This is not a fixed roadmap; re-plan after any material falsifier.

### A1.1a — semantic orientation contract

- A1-specific Owner-derived orientation memory;
- projection-basis separation;
- same-step reversal / external-push / no-history tests.

### A1.1b — pure relative semantic lattice

- player-relative samples;
- semantic-only utility decomposition;
- no world feasibility yet in the semantic core;
- translation/rotation metamorphic tests.

### A1.1c — world projections + hard truth

- project relative states into world;
- hard-fit evidence;
- hard-route truth vs desired comfort;
- honest bounded route coverage.

### A1.1d — components + relative continuity

- preserve multiple components;
- relative overlap/matching;
- member-sample debug representatives only;
- no world-anchor continuity authority.

### A1.1e — pass-through runtime/browser integration

- attach evidence to A1-owned runtime state;
- lazy/bounded debug path;
- exact movement differential;
- real Chromium qualification.

Do not proceed to A1.2 merely because the first region looks plausible. Complete the representation falsifiers first.

---

## 17. A1.1 promotion gate to A1.2

A1.1 passes only when all are true:

- semantic region is player-relative first;
- current Owner intent has semantic priority over prior physical motion;
- external player displacement cannot refresh relationship orientation;
- no-direction state fabricates no semantic heading;
- semantic utility is separate from travel/route/comfort/continuity costs;
- world projection carries explicit hard/comfort facts;
- partial route coverage remains honest;
- hard-only passage stays available;
- multiple disconnected useful components can coexist;
- representatives are non-authoritative member/debug adapters;
- continuity is relative-space based rather than world-anchor based;
- translation and rotation falsifiers pass;
- exact A1.0 movement differential remains green;
- real Chromium gate passes;
- evidence cost is bounded and visible.

A1.1 PASS means only:

> A1 now has a defensible representation of useful relationship space that A1.2 may use to investigate capability-honest PACE and world-unit velocity selection.

It does not mean the companion should move according to that region yet.

---

## 18. Stop / redesign triggers

Stop instead of tuning if:

1. relationship orientation is refreshed by externally induced actual body motion;
2. a world-space point becomes the persistent semantic objective;
3. semantic usefulness requires travel/route/comfort weights to make sense;
4. one representative/component must be selected early for the model to function;
5. partial route qualification is described as global unreachable truth;
6. desired comfort removes hard-feasible states;
7. pure player translation looks like semantic churn;
8. continuity requires anchoring to previous world positions;
9. orientation expiry invents world-axis facing;
10. sample density/weights are being tuned to hide representation discontinuities;
11. A1.1 evaluation changes baseline companion commands or World outcomes;
12. debug cloning/evidence begins dominating runtime cost.

---

## 19. First implementation decision

Begin with **A1.1a only**.

Do not start by copying `ShadowRelationshipRegion` into an A1 file.

First make Owner-intent-safe semantic orientation and projection-basis provenance executable and independently tested. Only then build the relative semantic lattice on top of that contract.

This preserves the main lesson of A1.0: establish the factual/semantic seam before letting downstream complexity depend on it.
