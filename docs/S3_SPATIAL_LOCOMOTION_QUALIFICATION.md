# S3 Spatial Locomotion Core — Qualification State

Status: **MECHANICAL PASS · OWNER BROWSER GATE OPEN**

Qualified application/runtime SHA: `73ff755b5d6bce37d0ce7fc52ddfa959dbbab02f`

Primary qualifying GitHub Actions run: `34793845994` — **PASS**

## What S3 changes

S3 deliberately supersedes the previously proposed naive S2-C1 waypoint-following step.

The companion now has a distinct local spatial locomotion layer:

```text
relationship objective
  -> static route corridor / lookahead
  -> 360-degree local spatial observation
  -> candidate velocity field
  -> selected omnidirectional local velocity
  -> MotionIntent
  -> authoritative World / physics outcome
```

The route no longer directly commands the motor. It supplies corridor/lookahead guidance while the local locomotion layer chooses the actual short-horizon velocity.

The old MANUAL / CHASE / RELATIONAL modes remain available as A/B baselines. `SPATIAL` has real movement authority.

## Qualified evidence

Exact runtime head `73ff755b...` passes:

- strict TypeScript compile;
- 8/8 test files;
- **49/49 tests**;
- production Vite build;
- install audit: 0 vulnerabilities.

The production research bundle remains intentionally heavy at approximately 3.57 MB minified / 1.185 MB gzip. This is apparatus cost, not a shipping-performance qualification.

## Physical movement trials

The suite now includes long-running headless World trials, not only one-step policy tests.

### Pillar

A SPATIAL companion must reach a target on the far side of the central pillar within the bounded trial while:

- the route classifier actually enters `routed`;
- the physical trajectory exhibits substantial lateral detour;
- the companion makes no contact with `pillar.center`.

**PASS.**

### Doorway

A SPATIAL companion must traverse the doorway opening to the far-side target while:

- physically crossing to the requested side;
- making no contact with either doorway wall.

**PASS.**

These trials run the real `SpatialLocomotionBrain`, route planner, `LabWorld` and Rapier-backed World stepping together.

## Local spatial representation

Current bounded research representation:

- 24 whole-body radial static-clearance probes over 360 degrees;
- blocker identity and free distance;
- current and predicted player motion;
- relationship objective;
- route status/path;
- continuous lookahead point along the current route polyline;
- requested/actual local movement context;
- 24 candidate headings;
- multiple speed bands plus adaptive near-goal speed sampling and STOP;
- short-horizon whole-body static feasibility;
- short-horizon predicted player collision/separation;
- deterministic score terms and tie-breaking.

The exact resolution/weights are provisional experiment parameters, not architecture contracts.

## Important falsifications that shaped S3

S3 did not reach this state by tuning until tests turned green. The long-running trials exposed distinct missing concepts.

### Finding 1 — first waypoint became a fake goal

Initial pillar trial reached the first route corner and then remained in `HOLD` for hundreds of ticks.

Cause: local locomotion treated the first waypoint as the objective instead of understanding progress along a route corridor.

Repair: route guidance now computes a bounded lookahead point **along the route polyline**, crossing waypoint boundaries naturally.

### Finding 2 — route and local locomotion disagreed about free space

After adding corridor lookahead, the local mover could enter a region considered valid by its own 5 cm clearance while the route layer used an 8 cm clearance. The next replan therefore classified the companion's current situation as `unreachable`.

Repair: local static clearance is now the same explicit clearance contract as the S2-C0 route layer.

### Finding 3 — velocity resolution was too coarse near a goal

The doorway trial advanced correctly, then stopped approximately 0.37 m from the target for hundreds of ticks.

Cause: the slowest fixed velocity candidate still predicted a displacement larger than the remaining useful motion, allowing STOP to dominate.

Repair: candidate generation now adds an **adaptive near-goal speed sample** based on current route lookahead distance and prediction horizon.

### Finding 4 — stationary player proximity was mistaken for dynamic danger

An earlier scoring model created a broad soft avoidance envelope even around a stationary player and could starve useful route progress.

Repair: the soft player-risk envelope now expands with player motion. The hard physical/predictive collision boundary remains distinct.

## Debug workbench as a peer system

S3 treats observability as co-equal with movement intelligence.

A first-class `SPATIAL` debug preset now exists alongside PLAY / BRAIN / NAV / MOTION / ALL.

SPATIAL evidence includes:

- 360-degree radial clearance spokes;
- static blocker hits;
- full candidate velocity cloud;
- hard-rejected vs admissible candidates;
- selected short-horizon trajectory;
- route lookahead;
- current -> predicted player position;
- selected semantic motion state (`ADVANCE`, `SIDESTEP`, `BACKOFF`, `HOLD`);
- accepted/rejected candidate counts;
- score-term decomposition;
- top alternative candidates;
- causal reason strings;
- rolling semantic events and incident capture.

NAV remains visible as an independent source of truth, so route reasoning and local locomotion reasoning can be compared rather than collapsed into one opaque system.

## Current boundaries / non-claims

S3 does **not** prove a finished companion movement architecture.

Still deliberately open:

- relationship objective is still the legacy S1 eight-slot point model;
- no continuous relationship region/field yet;
- no general progress/stuck semantic classifier in runtime yet;
- no contested-passage / explicit `YIELD` policy yet;
- no ORCA/RVO or multi-companion avoidance;
- player avoidance is intentionally asymmetric and one-companion-specific for now;
- no combat/threat/role-aware spatial utility;
- no facing/animation constraints; current circular body is holonomic;
- no soft-contact experiment yet;
- no LLM involvement;
- 24 rays/headings, prediction horizon and score weights are provisional;
- experimental maximum speed is still an apparatus constant and must later move behind actor capability semantics.

The candidate-velocity field itself is also not assumed to be the final architecture. It is an inspectable research mechanism. If later evidence exposes a missing concept, prefer adding/repairing that concept over indefinitely tuning coefficients.

## Owner/browser gate

The browser gate should compare SPATIAL against the preserved RELATIONAL baseline and attack:

- pillar detours;
- doorway approach/crossing/reversal;
- repeated player reversals;
- circling around the companion;
- approaching the companion from multiple directions;
- head-on motion;
- player crossing in front of the companion;
- stopping suddenly near the companion;
- local sidestep/back-off behavior;
- oscillation/orbiting/timidity;
- whether SPATIAL debug actually explains surprising choices.

Any suspicious moment should be captured with `I` and, where useful, recorded on video.

S3 is not eligible for merge as an accepted movement system until this Owner/browser gate is evaluated.

## Next architecture pressure if S3 survives the gate

The most obvious remaining primitive is no longer the motor. It is the **relationship objective itself**.

The current eight discrete S1 slots are likely too point-like and too coarse for the intended companion. A serious next hypothesis is a continuous relationship region/field (annulus / side / rear / free-space utility) that can be combined with route topology, player movement and later threat/role context without snapping the companion to one of eight anchors.

This is a hypothesis for the next evidence cycle, not yet a canonical design.
