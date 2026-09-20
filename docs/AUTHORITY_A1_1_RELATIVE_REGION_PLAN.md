# Authority-A1.1 — Player-Relative Useful Region Plan

Status: **CANONICAL A1.1 PLANNING CHECKPOINT · CRITICAL REVIEW CORRECTED · NO NEW MOVEMENT AUTHORITY**

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
- disconnected near-best sets must remain disconnected when connectivity is actually known;
- a region/set is more truthful than one averaged target;
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
relative offset / radius
relative bearing when semantic orientation exists
semantic utility terms
orientation provenance
```

This meaning must not depend on absolute world position.

### 4.2 World projection evidence

A relative sample projected into the current world can expose:

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

Prefer a representative **member sample** or medoid-like member over a synthesized centroid. Never average disconnected fragments/components through invalid space.

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

### 5.3 Sampling basis is not semantic facing

A polar observation lattice needs a deterministic geometric basis, but A1.1 must not preserve an old semantic direction merely to stabilize sampling.

Use only:

```text
semanticOrientation: direction | null
samplingBasis: unit direction
samplingBasisSource:
  SEMANTIC_ORIENTATION
  WORLD_AXIS_SAMPLING_ONLY
```

When semantic orientation is absent:

- the sampling basis may use world +X **only as a coordinate basis**;
- directional semantic terms are disabled;
- the basis must be reported as `WORLD_AXIS_SAMPLING_ONLY`;
- the basis must never be stored as Owner semantic memory;
- transition from directional to orientation-free semantics may be marked continuity-non-comparable rather than hidden behind retained basis state.

This deliberately accepts an observable mesh-basis transition instead of introducing history-dependent hard-feasibility sampling through a stale prior basis.

If that transition proves materially harmful even while non-authoritative, redesign the sampling representation rather than silently retaining semantic history.

---

## 6. Semantic utility is a pure contract; sampling is only observation

A1.1 should not make the discrete lattice itself the definition of relationship meaning.

Define a pure relative-state utility seam conceptually equivalent to:

```text
A1RelativeState
  relativeOffset
  radius
  bearingToSemanticOrientation: number | null

A1RelationshipUtility
  total
  directionalTerm
  radialTerm
  orientationStrength
  reason / decomposition

evaluateRelationshipUtility(relativeState, orientation)
```

The evaluator must not depend on:

- absolute world position;
- route cost;
- current companion travel cost;
- comfort clearance;
- previous world anchor;
- final movement continuity.

The polar lattice samples this semantic utility function for evidence, feasibility projection and later visualization.

This matters for A1.2: a predicted future companion relative state should eventually be scoreable directly by the same semantic contract rather than by distance to the nearest sampled anchor.

### 6.1 Provisional sampled evidence

```text
A1RelativeRegionSample
  id
  angleIndex
  radiusIndex
  relativeState
  semanticUtility
  semanticEligible
  directionalSemanticsActive
```

Initial sample density/radii may mirror CCC-0 to isolate representation changes, but they remain experimental controls.

---

## 7. Semantic usefulness vs physical availability

A sample can be semantically useful yet currently difficult or impossible to occupy.

Therefore A1.1 exposes both dimensions rather than folding them into one score.

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

## 8. Keep multiple reachable fragments; claim components only when topology is complete

A1.1 must not collapse useful space to one chosen coherent component.

However partial route qualification creates another trap: two sets of confirmed reachable samples may appear disconnected only because untested samples between them were never qualified.

Therefore distinguish:

```text
A1UsefulRegionFragment
  fingerprint from confirmed member relative sample ids
  memberSampleIds
  semanticBestSampleId
  representativeSampleId   // debug/adapter only; actual member
  semanticUtilityRange
  hard/comfort summary

A1RegionTopologyEvidence
  completeness: PARTIAL | COMPLETE
  confirmedFragments
  untestedPotentialConnectorCount
  reason
```

Rules:

- with `PARTIAL` topology, fragments are **confirmed reachable fragments**, not proof of globally disconnected components;
- true disconnected-component claims require complete qualification of relevant connectors or another complete topological proof;
- no fragment/component is selected as preferred in A1.1;
- no centroid/average point between fragments becomes semantic objective;
- every representative is an actual member sample and debug/adapter only.

A1.2 may later choose among the whole admissible set. A1.1 must not make that decision early.

---

## 9. Relative-space continuity

CCC-0 world-anchor continuity is rejected.

A1.1 continuity uses semantic-relative evidence:

- semantic sample membership/utility overlap;
- confirmed-fragment member overlap;
- fragment matching by maximum relative membership overlap;
- semantic orientation source/strength provenance;
- topology completeness;
- explicit comparability state.

Provisional continuity evidence:

```text
previousPresent
currentPresent
orientationRegimeComparable
semanticSampleOverlap
fragmentMatches[]
projectionTopologyCompleteness
projectionTopologyChanged: boolean | null
playerTranslationDelta   // diagnostic only
representativeWorldDelta // diagnostic only
```

Pure player translation in equivalent local geometry must not appear as semantic region churn merely because every world projection moved.

Ordinary rotation with valid semantic orientation should rotate world projections while preserving equivalent local relationship meaning.

A transition between directional and orientation-free semantics may be marked non-comparable rather than forcing false continuity.

With partial topology, `projectionTopologyChanged` may be `null`; missing route evidence must not masquerade as a real topology transition.

---

## 10. Moving-frame hook for A1.2

A1.1 should expose pure semantic/projection helpers rather than implementing PACE now.

Conceptually:

```text
evaluateRelationshipUtility(relativeState, orientation)

projectRelativeState(
  relativeState,
  playerReferencePosition,
  sampling/orientation basis
) -> worldPosition
```

A1.2 can later evaluate:

```text
futureRelative = predictedCompanionWorld - predictedPlayerWorld
utility = evaluateRelationshipUtility(futureRelative, futureOrientation)
```

without converting the current sampled region into one future point target.

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
A1.1 semantic utility field + sampled evidence
A1.1 world projection evidence
A1.1 continuity/fragments/topology completeness
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
previousSemanticUsefulSampleIds
previousConfirmedFragments
previousProjectionTopology summary/completeness
```

Do not store as semantic history:

- world-space representative;
- sampling basis when it came only from `WORLD_AXIS_SAMPLING_ONLY`;
- actual/external player velocity as orientation.

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
- semantically eligible count;
- hard-fit count;
- route-evaluated count;
- hard-reachable count;
- hard-unreachable count;
- untested count;
- actual static traversal query count;
- confirmed fragment count;
- topology completeness;
- source tick / age;
- evaluation duration in browser qualification when practical.

Before storing large region structures in `A1AuthorityRuntime.debugState()`, remove or avoid the known A1.0 eager deep-clone path for normal non-debug runtime. Heavy debug evidence should be lazy/bounded.

---

## 14. Required falsifiers

### 14.1 Translation invariance

Duplicate an open configuration with player + companion translated by the same vector and otherwise equivalent local geometry.

Require:

- same semantic utility for equivalent relative states;
- same semantic eligibility;
- same orientation provenance;
- world projections shift by the translation vector;
- no semantic continuity penalty from translation alone.

### 14.2 Rotation covariance

Rotate player, companion relative placement, same-step Owner input and local geometry by 90 degrees.

Require equivalent semantic utility/relative structure after the corresponding relative-frame transform and correspondingly rotated world projections.

Do not require raw world-angle sample ids to remain numerically identical if the sampling basis changes; require semantic equivalence.

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
- sampling-basis provenance is explicitly `WORLD_AXIS_SAMPLING_ONLY`;
- semantic utility does not prefer world +X merely because the observation lattice needs coordinates.

### 14.6 Memory fade

After meaningful Owner direction followed by stop:

- memory strength decreases monotonically by World ticks;
- external motion does not refresh it;
- eventual state is `NONE`;
- expiry does not create a semantic world-axis heading;
- no prior semantic direction is retained merely to stabilize physical sampling.

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
- topology completeness is `PARTIAL`;
- confirmed fragments are not reported as proven disconnected components;
- no global unreachable claim;
- coverage counts exactly match executed qualifications.

### 14.9 Disconnected useful components under complete evidence

Create two disconnected near-best hard-reachable arcs and exhaustively qualify relevant connectors.

Require:

- topology completeness is `COMPLETE`;
- two components/fragments survive as genuinely disconnected;
- no centroid/average point between them becomes semantic objective;
- each debug representative is an actual member sample;
- A1.1 chooses neither component as preferred.

### 14.10 Pure translation continuity

Advance player and companion together at equal displacement while preserving relative state and equivalent local geometry.

Require:

- semantic field remains equivalent;
- relative membership overlap remains high/identical where discretization permits;
- confirmed fragment matching remains stable when topology evidence is complete;
- world representative displacement may be large and is explicitly non-semantic.

### 14.11 Representation-boundary discontinuity

Sweep slowly across known CCC-0 representative/component discontinuities.

Require semantic utility and relative/topological evidence change only for real semantic/feasibility reasons; a debug representative jump alone may not alter A1 movement because A1.1 still has no authority.

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
- topology completeness visible;
- baseline command still exact pass-through.

Browser mechanical PASS remains distinct from Owner feel PASS.

---

## 16. Bounded implementation sequence

This is not a fixed roadmap; re-plan after any material falsifier.

### A1.1a — semantic orientation contract

- A1-specific Owner-derived orientation memory;
- non-semantic sampling-basis provenance;
- same-step reversal / external-push / no-history tests.

### A1.1b — pure relative semantic utility + sampling

- pure arbitrary-relative-state utility evaluator;
- sampled player-relative evidence;
- semantic-only utility decomposition;
- no world feasibility inside the semantic core;
- translation/rotation metamorphic tests.

### A1.1c — world projections + hard truth

- project relative samples into world;
- hard-fit evidence;
- hard-route truth vs desired comfort;
- honest bounded route coverage.

### A1.1d — reachable fragments + relative continuity

- preserve multiple confirmed reachable fragments;
- PARTIAL vs COMPLETE topology evidence;
- relative overlap/matching;
- member-sample debug representatives only;
- no preferred fragment/component;
- no world-anchor continuity authority.

### A1.1e — pass-through runtime/browser integration

- attach bounded evidence to A1-owned runtime state;
- lazy debug path;
- exact movement differential;
- real Chromium qualification.

Do not proceed to A1.2 merely because the first region looks plausible. Complete the representation falsifiers first.

---

## 17. A1.1 promotion gate to A1.2

A1.1 passes only when all are true:

- semantic relationship utility is player-relative first and independently evaluable from absolute world position;
- current Owner intent has semantic priority over prior physical motion;
- external player displacement cannot refresh relationship orientation;
- no-direction state fabricates no semantic heading;
- sampling basis is explicitly non-semantic when orientation is absent and retains no hidden prior semantic direction;
- semantic utility is separate from travel/route/comfort/continuity costs;
- world projection carries explicit hard/comfort facts;
- partial route coverage remains honest and topology completeness is explicit;
- hard-only passage stays available;
- multiple disconnected useful components can coexist when complete evidence proves them;
- partial evidence is described only as confirmed fragments, not global disconnection;
- representatives are non-authoritative member/debug adapters;
- A1.1 selects no preferred fragment/component;
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
4. one representative/fragment/component must be selected early for the model to function;
5. partial route qualification is described as global unreachable or proven-disconnected truth;
6. desired comfort removes hard-feasible states;
7. pure player translation looks like semantic churn;
8. continuity requires anchoring to previous world positions;
9. orientation expiry invents world-axis facing;
10. sampling stability requires silently retaining an expired semantic direction;
11. sample density/weights are being tuned to hide representation discontinuities;
12. A1.1 evaluation changes baseline companion commands or World outcomes;
13. debug cloning/evidence begins dominating runtime cost.

---

## 19. First implementation decision

Begin with **A1.1a only**.

Do not start by copying `ShadowRelationshipRegion` into an A1 file.

First make Owner-intent-safe semantic orientation and non-semantic sampling-basis provenance executable and independently tested. Only then build the pure relative semantic utility contract and sampled field on top of that seam.

This preserves the main lesson of A1.0: establish the factual/semantic boundary before letting downstream complexity depend on it.
