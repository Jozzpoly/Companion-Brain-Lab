# Authority-A1.1 — Post-implementation critical review

Status: **CURRENT EXECUTION REVIEW · REPLANS THE REST OF A1.1 · NO MOVEMENT AUTHORITY**

Date: 2026-09-15

This review is written after A1.1a/b qualified and after the first A1.1c projection implementation reached CI. It does not replace the post-A0 A1 stage plan. It corrects the meaning and remaining execution of A1.1 before the work is allowed to drift into a polished follow-target system.

## 1. Current evidence-backed state

Qualified before this review:

- A1.0: isolated decision-time authority shell, exact baseline pass-through, same-step Owner input seam;
- A1.1a: Owner-intent-safe semantic orientation and bounded Owner-only memory;
- A1.1b: pure player-relative utility evaluator, sampled semantic field, temporal provenance;
- A0 factual contracts remain available for capability, hard route truth, World outcome and attribution.

A1.1c currently projects semantic samples into World geometry and separates:

- local hard body fit;
- desired/comfort fit;
- hard route reachability;
- desired route reachability;
- explicit UNTESTED route evidence;
- actual static traversal query cost.

No A1.1 module is connected to movement authority.

## 2. Main architectural verdict

A1.1 is worth continuing, but its correct role is broader than "new companion follow positioning".

The durable abstraction should be:

> a player-relative **objective-space substrate** whose utility can describe useful relative states independently of absolute World position.

The current radial/front relationship profile is only the first experimental profile used to falsify that substrate. It must not become the identity of the companion or the permanent definition of following.

A future objective source may represent, for example:

- ordinary follow relationship;
- regroup;
- flank-left / flank-right;
- hold a useful side;
- cover / avoid blocking an interaction lane;
- command-driven formation position;
- later combat/role context.

A1.1 does not need to implement those roles now. It must avoid making them architecturally impossible by treating one current profile or representative point as canonical meaning.

## 3. Corrections to the remaining A1.1 work

### 3.1 Sample-space fragments are not automatically World topology components

A set of nearby reachable semantic samples can form a useful **sample-space accessibility fragment**.

That does not prove a distinct World navigation component or gateway family.

In particular, multiple endpoints can all be reachable from the current companion position while belonging to different local semantic lobes; conversely, apparent gaps in sampled semantic space can be sampling artifacts rather than World disconnection.

Therefore A1.1d must use precise names:

- `confirmedAccessibleFragments` or equivalent for connected confirmed-reachable members in the sampled relative lattice;
- `coverage: PARTIAL | COMPLETE` for qualification completeness;
- explicit unknown connectors under partial coverage.

Do not call these World topology components.

World topology/gateway identity remains separate future evidence. It may later consume route path/gateway signatures or another stronger topological proof.

### 3.2 Qualification priority and coverage strategy are different responsibilities

The current A1.1c bounded route budget prioritizes high semantic utility. That is useful when the question is "which promising state should I inspect first?"

It is weak when the question is "what is the shape/connectivity of the accessible useful set?"

Before A1.1d relies on bounded projection evidence, route qualification must expose the strategy/provenance of what was tested.

At minimum distinguish conceptually:

- semantic-priority qualification;
- coverage-oriented / stratified qualification;
- exhaustive qualification used by tests/offline evidence.

Do not infer absence of a fragment from a semantic-priority shortlist that never sampled the relevant part of the field.

### 3.3 Direct utility remains the semantic authority; the lattice remains an observation instrument

The strongest A1.1b design decision should remain protected:

`evaluateA1RelationshipUtility(relativeState, orientation, profile)` is the semantic contract.

The 32 x 3 lattice is only an experimental observation/projection mesh.

Later moving-frame velocity candidates must be scoreable directly at their predicted relative states. They must not snap to or chase the nearest sampled point.

### 3.4 Do not make route-heavy projection a motor-clock dependency

CCC-0 already proved that a small candidate count can hide much larger traversal cost.

A1.1 projection is allowed to be an evidence/topology-support layer with explicit freshness. It should not automatically run full route qualification every physics tick merely because the semantic objective can update every tick.

Likely future cadence split:

- same-step Owner semantics: fast / decision tick;
- cheap direct relative utility: fast;
- heavy projection/route/accessibility evidence: slower and/or invalidation-driven;
- acute final physical safety: fast / final command boundary.

Exact cadence is not decided here.

### 3.5 No new movement authority until the first complete teammate loop exists

Post-forensics evidence still stands: WHERE authority must not be promoted by itself.

The first authoritative A1 build must contain a coherent minimum of:

- moving-frame relative objective evaluation;
- capability-honest PACE / correction intensity;
- player cooperation / right-of-way policy;
- world-unit local velocity selection;
- temporal/direct A/B realization;
- narrow joint final physical authority;
- outcome attribution / invalidation.

These pieces may be implemented and falsified in slices, but movement authority should stay pass-through until the complete loop can be exercised together.

## 4. Revised remainder of A1.1

### A1.1c — projection truth

Finish and qualify:

- translation-covariant world projection;
- hard local fit separate from desired fit;
- hard route truth separate from desired comfort connectivity;
- UNTESTED remains unknown;
- exact query-cost evidence;
- f32/physics precision handled as numerical reality rather than semantic failure.

### A1.1d — sampled accessibility fragments + continuity

Build pure evidence for:

- adjacency in the relative sample lattice;
- confirmed reachable fragment membership;
- PARTIAL vs COMPLETE coverage;
- unknown potential connectors under partial coverage;
- relative-space fragment matching across observations;
- orientation-regime comparability;
- translation-invariant continuity;
- rotation-covariant continuity when semantic orientation remains valid;
- explicit non-comparability when semantic orientation regime changes.

No preferred fragment. No representative semantic authority. Any representative is an actual member sample and debug/adapter only.

### A1.1e — bounded objective contract review

Before runtime integration, prove that the representation is not accidentally tied to one follow profile.

Required evidence should include at least:

- a second synthetic semantic profile with materially different useful relative states;
- the same projection/accessibility machinery works without branching on role names;
- direct utility evaluation remains independent of World routing;
- no downstream module assumes that `preferredRadius=1.45`, "behind", or the current 32 x 3 mesh is universal.

This is not a gameplay role system. It is an anti-hardcoding falsifier.

### A1.1f — passive runtime observation only

Only after a-e are qualified:

- integrate A1.1 evidence behind A1 DIRECT/TEMPORAL selectors while returning exact baseline companion intent;
- keep A1 OFF silent;
- store only bounded/lazy debug evidence;
- expose source ticks/ages and heavy-projection freshness;
- verify exact zero-authority differential again;
- qualify browser cost and observability before A1.2.

## 5. Revised post-A1.1 direction

Do not interpret the next stage as "turn region into a target and add speed".

The next major experiment should construct a **moving-frame coordination objective** and then a complete parallel teammate loop.

High-value working hypothesis:

`companion desired velocity ≈ player feed-forward velocity + bounded relative-error correction`

with that family then evaluated/modified by:

- objective-space utility;
- PACE/capability bounds;
- route/topology guidance;
- asymmetric player cooperation;
- static/body hard legality;
- temporal embodiment.

This hypothesis directly addresses the demonstrated equal-speed tracking failure: maintaining a good relative state while both actors move at 3 u/s should not require chasing a world point left behind at the previous observation.

It is only a hypothesis. A future velocity-field experiment must compare it against broader candidate families and reject it if it creates brittle or over-coupled behavior.

## 6. North-star interpretation

The companion should increasingly feel like an embodied teammate because it has:

- its own meaningful objective state;
- its own geometric trajectory;
- temporally continuous physical realization;
- explicit respect for player agency;
- honest interpretation of causes and failures;
- enough autonomy to act without babysitting;
- enough legibility that the Owner can understand why it acted.

Do not manufacture aliveness from stale targets, hidden lag, solver feedback or arbitrary timers.

Preserve meaningful temporal autonomy; replace accidental pseudo-agency with explicit teammate semantics.
