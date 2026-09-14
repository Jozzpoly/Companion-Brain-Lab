# S5-A Continuous Relationship Field — core qualification

Status: **CORE MECHANICAL PASS / SHADOW ONLY / NO MOVEMENT AUTHORITY**

Qualified core SHA: `aeeb4628d2920988a1687bc6f74aaf971205babb`

Primary validation run: `34795828914`

## Why this exists

S3 proved that local companion movement can be omnidirectional and responsive. S4 then separated preferred motion from motion realization and added bounded temporal continuity plus local direction refinement. The oldest major structural simplification now sits above both: S1 still expresses relationship to the player as one of eight discrete point slots.

S5-A tests a different representation:

> evaluate a spatial utility field around the player, identify a coherent good region, and expose a representative point only as an adapter for downstream systems.

The field itself is the research object. The representative point is not the semantic model.

## Current field substrate

The first bounded implementation uses:

- 32 angular directions;
- 3 radii: `1.15 / 1.45 / 1.8 m`;
- 96 cheap local field samples total;
- a maximum 12-sample route-qualified shortlist;
- 10 Hz evaluation cadence;
- explicit utility terms for front obstruction, preferred distance, companion travel distance, static clearance, temporal continuity, and route cost.

Only the local shortlist pays the more expensive routing cost. This deliberately separates broad awareness from expensive topology evaluation.

## Route/topology contract

Samples can be:

- locally invalid;
- locally valid but not route-evaluated;
- route-evaluated and reachable (`direct` or `routed`);
- route-evaluated and unreachable/invalid.

Only route-qualified reachable samples can define the representative relationship region.

The interpolated representative point is itself revalidated against local geometry and the router. If interpolation produces invalid or unreachable geometry, the field falls back to its best qualified sample.

## Material falsification: centroid collapse

The first field implementation passed most tests but failed a critical open-space falsifier.

### Failure

The initial definition of a "good region" was:

> all reachable samples whose score is within a fixed window of the best score.

In a symmetric open-space case this included several spatially separate near-best areas on different sides of the player. A weighted average across all of them produced a representative anchor only about **0.28 m from the player center**.

This was mathematically valid averaging and semantically wrong companion positioning.

### Finding

A continuous field cannot be reduced to a global centroid of every good sample. The model needs **field topology**: a useful region must be a spatially coherent component.

### Repair

S5 now:

1. finds the best reachable sample;
2. collects near-best reachable samples inside the score window;
3. traverses polar-field adjacency starting from the best sample;
4. keeps only the connected component containing that best sample;
5. computes the weighted representative only inside that coherent component;
6. revalidates the resulting representative against geometry and route topology.

This is a conceptual improvement, not a weight tweak: the model moved from "bag of good points" to "connected good region".

## Exact automated evidence

Run `34795828914` on exact SHA `aeeb4628d2920988a1687bc6f74aaf971205babb`:

- strict TypeScript: **PASS**;
- 12/12 test files: **PASS**;
- **65/65 tests: PASS**;
- S3 physical pillar/doorway trials: **PASS**;
- S4 natural-motion physical trials: **PASS**;
- Vite production build: **PASS**;
- install audit: **0 vulnerabilities**.

### S5-specific falsifiers now passing

1. builds a 96-sample annular field rather than eight slots;
2. route evaluation is bounded to the configured shortlist;
3. open-space relationship selection prefers a non-front region;
4. representative anchor can lie between samples rather than snapping to one sample;
5. a small 5° player-heading change produces a bounded representative change when previous field state is provided;
6. pillar topology produces route-aware/routed field candidates rather than trusting Euclidean utility;
7. an oversized companion that cannot pass the doorway gets no false reachable relationship region;
8. identical evidence/state produces deterministic field output.

## What is proven

S5-A proves that a richer relationship representation can be evaluated as a bounded, route-aware spatial field and reduced to a **coherent** good region without giving the field movement authority.

It also proves that the global-centroid failure is detectable and avoidable through explicit field connectivity.

## What is NOT proven

S5-A does not yet prove:

- that the field feels better than the S1 eight-slot relationship model;
- that current utility terms are appropriate for companion play;
- that 32×3 sampling is the right long-term resolution;
- that the current polar adjacency is the final field topology;
- that the representative anchor should remain the long-term downstream interface;
- that field continuity remains good during long, adversarial player motion;
- that route-shortlist size 12 is sufficient in more complex geometry;
- that combat, threat, role or multi-companion terms belong in this exact field model.

## Required shadow-debug gate

Before the field receives movement authority, browser debug must expose it next to the preserved S1 baseline:

- all field samples;
- local invalid samples;
- utility magnitude/terms;
- route-qualified shortlist;
- unreachable qualified samples;
- coherent good-region membership;
- representative anchor and source;
- old eight-slot relationship target;
- explicit reason/fallback state.

The first browser phase remains observational: S4 movement continues to use the old S1 relationship target while S5 calculates what it would have preferred.

## Gate

**Current state: CORE MECHANICAL PASS / SHADOW VISUALIZATION NEXT / NO MOVEMENT AUTHORITY.**
