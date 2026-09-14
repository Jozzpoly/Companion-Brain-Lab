# R1-2 / R1-3 — Spatial Contract + Final Command Qualification

Status: **AUTOMATED PASS / OWNER BROWSER GATE NOT YET RUN**

Qualified application/core head: `20e9a144ffe1b8d554a013fdb4571c23064dad9b`

Primary validation run: `34837296868` — **SUCCESS**

- strict TypeScript: PASS
- 15/15 test files: PASS
- 80/80 tests: PASS
- production build: PASS
- npm install audit: 0 vulnerabilities

This document qualifies only the bounded R1-2/R1-3 claims below. It does not claim general movement robustness, browser feel, constrained-space cooperation, or final architecture.

---

## 1. R1-2 query/spatial contract — demonstrated

The old movement stack used one enlarged static traversal semantics for three different meanings:

1. physical body feasibility;
2. preferred static clearance;
3. egress from a state already violating preferred clearance.

R1-0 proved that this conflation creates a clearance prison: a physically legal body can be unable to issue any autonomous movement because its enlarged desired-clearance envelope begins in overlap.

R1-2 separates those meanings.

### World query vocabulary

The Rapier adapter now exposes domain-shaped read-only queries for:

- physical/desired shape occupancy;
- traversal with explicit initial-overlap policy (`block` / `allow-egress`).

Dynamic actors remain excluded from static classification.

### Router semantics

Static route graph connectivity is now decided by **hard-body feasibility**.

Desired clearance remains explicit route-quality evidence:

- every edge retains hard `clear/blocker` truth;
- every edge separately reports `comfortClear/comfortBlocker`;
- route plans expose whether the selected route is clearance-constrained;
- preferred corner nodes remain expanded by desired clearance, preserving nominal obstacle spacing.

A physically fitting route may therefore be reachable but clearance-constrained. A truly too-narrow route remains unreachable.

Bound falsifiers:

- radius `0.65` through the authored 1.4 m doorway: hard reachable, desired clearance constrained;
- radius `0.80`: hard impossible, still unreachable;
- start inside desired pillar clearance with a hard-clear target away: reachable, not planning-deadlocked.

### Local spatial semantics

`R1HardComfortSpatialBrain` is an isolated adapter over existing S3 public stages:

`observe -> build S3 candidates -> hard/comfort reclassification -> existing choose`

It does not fork the full S3 locomotion algorithm.

A candidate rejected by the old enlarged static sweep is rehabilitated only when a separate physical-radius sweep proves it hard-safe. Player-predicted collision rejection remains untouched.

Desired-clearance endpoint occupancy remains a quality signal:

- exiting an existing violation is preferred;
- remaining inside the violation has a cost;
- entering a new violation has a larger cost;
- STOP gains an extra cost only when the actor is already in violation and a hard-safe exit candidate exists.

### R1-0 failures promoted to green regressions

The exact static clearance-prison fixture now produces:

- reachable route;
- explicit desired-clearance violation evidence;
- hard-safe rehabilitated moving candidates;
- available comfort-exit candidates;
- selected non-HOLD / non-stop movement;
- selected endpoint outside desired clearance.

The exact dynamic player push/release fixture now demonstrates:

- ordinary player contact can still push the companion into desired-clearance violation while remaining physically legal;
- after player conflict ends, the same brain resumes without reset;
- movement resumes within the bounded promotion gate;
- desired-clearance violation is exited;
- measurable forward progress occurs.

**R1-2 gate: PASS.**

---

## 2. R1-3 final-command safety — demonstrated

R1-0 also proved a separate temporal authority problem: NATURAL continuity can receive a safe preferred reversal but carry old momentum into a final command that upstream spatial reasoning did not directly authorize.

R1-3 deliberately keeps `MotionContinuityController` geometry-agnostic and adds an independent final hard-command gate.

### Final gate contract

The gate evaluates only the actual next physics step at the physical body radius.

- If the continuity command is hard-safe, it passes unchanged.
- If it would cross hard static geometry, the gate attempts a hard-safe upstream refined/preferred move.
- If no supplied preferred fallback is hard-safe, it emits an explicit one-step STOP.
- Desired/comfort clearance is **not** treated as a hard final-command law.

If a command is constrained, the stored temporal acceleration history is reset because it describes a command World did not execute. Upstream spatial state is not reset.

### Bound falsifiers

Tests demonstrate all three required cases:

1. true hard-boundary carry is constrained to a safe preferred reversal;
2. continuity carry that enters only the desired-clearance band remains unconstrained;
3. no hard-safe preferred fallback produces explicit STOP rather than an unsafe command.

### Integrated R1 NATURAL chain

`R1NaturalSpatialLocomotionBrain` composes:

`R1 hard/comfort preferred -> existing refinement -> existing continuity -> final hard gate -> MotionIntent`

Integrated tests prove:

- a hard-boundary reversal constrains unsafe temporal carry and executes a safe reversal;
- comfort-only carry remains legal and unconstrained;
- NATURAL recovers after the dynamic player push/release class without brain reset;
- nominal pillar routing remains competent without static contact;
- nominal doorway traversal remains competent without wall contact;
- requested-motion continuity remains bounded by the current regression threshold.

**R1-3 gate: AUTOMATED PASS.**

---

## 3. What is not yet proven

R1-2/R1-3 do not establish:

- general progress/stuck/recovery intelligence;
- temporary-unreachable recovery semantics;
- explicit player yielding/right-of-way;
- doorway reversal robustness under repeated player contention;
- cross-front interruption robustness;
- moving-target route revision quality;
- browser feel or absence of visible actuator artifacts;
- whether resetting continuity acceleration on a hard constraint is the best long-term feel policy;
- that original S3 desired-clearance sensor rays are the right long-term observation semantics.

The old S3 ray field still samples the enlarged desired-clearance radius. During current comfort violation this can report near-zero static free distance even though hard egress exists. R1-2 repairs authority separately, but this remains an explicit scoring/debug debt.

---

## 4. Next gate

Proceed to **R1-4 progress / recovery intelligence** on a separate branch.

Required direction:

- rolling progress evidence;
- public semantic classification of intentional hold vs blocked/no-progress vs transient unreachable vs hard unreachable;
- bounded recovery transitions with explicit reason and resume/termination conditions;
- no silent indefinite HOLD away from objective;
- regression coverage for doorway reversal, cross-front interruption, moving relationship target, temporary unreachable and hard unreachable.

Do not resume S5 authority yet.
