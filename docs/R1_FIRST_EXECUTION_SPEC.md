# R1-0 — First Execution Spec

Status: **EXECUTION-READY RED-TEST PLAN / NO REPAIR SELECTED**

Date: 2026-09-14

This document turns the R1 audit into the first bounded execution campaign. Its purpose is to reproduce/falsify the Owner-discovered shutdown class before changing routing, query flags, clearance constants, recovery logic, or the S4 actuator.

The fixtures should be small enough that a failure can be attributed to one contract.

---

## 1. Shared geometry facts

Current actor radius: `0.30 m`.

Current desired/static planning clearance: `0.08 m`.

Therefore current enlarged route/local query radius is normally:

`0.30 + 0.08 = 0.38 m`.

Example using the existing pillar left face at `x = 5.5`:

- physically legal actor center on the left can approach to `x = 5.20`;
- current enlarged planning envelope requires center `x <= 5.12`;
- therefore `5.12 < x <= 5.20` is a **physically legal but desired-clearance-violating band**.

A deterministic fixture around `x = 5.16` can therefore isolate initial desired-clearance penetration without actual hard-body penetration.

---

## 2. R1-0A — static clearance-egress reproduction

### Question

If the companion begins physically legal but inside the current desired planning margin, can the existing route/local system command motion away from the obstacle?

### Fixture

Prefer a tiny test-only vertical wall fixture for causal clarity, but the existing pillar may be used if it avoids extra apparatus work.

Existing-pillar variant:

- scenario geometry: central pillar with left face `x = 5.5`;
- companion center: approximately `{ x: 5.16, y: 4.0 }`;
- physical radius: `0.30`;
- desired route/static clearance: `0.08`;
- objective/relationship target: safely leftward, e.g. `{ x: 3.5, y: 4.0 }`;
- player: stationary and far enough away to be irrelevant.

### Evidence to record before any repair

At tick zero and for the first bounded steps:

- hard-body occupancy/physical legality;
- desired-clearance violation amount;
- raw `staticCircleTraversal` result with physical radius;
- raw result with enlarged `radius + clearance`;
- blocker label;
- time/distance of impact;
- route status / graph edges from start;
- spatial accepted/rejected candidate counts;
- selected candidate/state;
- requested/actual motion.

### Expected current failure if C1 is correct

- hard body is physically legal;
- enlarged query reports immediate/static blocker for some/all egress trajectories;
- route may report `unreachable`;
- spatial motion may prefer/reduce to STOP/HOLD despite objective lying away from the wall;
- state persists because no recovery exists.

### Falsification outcome

If existing `stopAtPenetration=true` queries already permit the egress direction in deterministic-compat 0.20, C1 is incomplete or wrong. Record that explicitly and move primary attention to route graph construction / scoring / S4 actuator / another mechanism.

Do not change flags until this result is known.

---

## 3. R1-0B — explicit query-semantics probe

### Question

Does the exact Rapier deterministic-compat package behave as public docs suggest for an enlarged shape beginning in overlap and moving outward?

### Fixture

Use the same geometry/start as R1-0A. Query the same outward segment with narrowly scoped variants:

1. current adapter semantics (`stopAtPenetration=true`);
2. experimental egress semantics (`stopAtPenetration=false`) implemented only inside the test/probe first;
3. physical-radius query as hard-feasibility reference.

### Required result

Bind observed deterministic-compat behavior to tests before designing the public World query contract.

This experiment does **not** authorize global replacement of the flag.

---

## 4. R1-0C — player push / release

### Question

Can ordinary dynamic actor contact move the companion into the desired-clearance-invalid band, and if so does autonomy resume after the player leaves?

### Test-only fixture

Use a simple vertical wall rather than the doorway initially.

Suggested geometry:

- world approximately `12 x 8`;
- vertical wall ending at or spanning test region; right face around `x = 6.0`;
- companion starts to the right of wall with safe desired clearance, e.g. center `x ~ 6.7`;
- player starts to the right of companion, e.g. `x ~ 7.5`;
- both radius `0.30`;
- autonomous companion objective lies safely rightward after release.

### Script phases

**Phase 1 — approach/push**

Player requests leftward motion long enough to contact and push/pin the companion toward the wall.

**Phase 2 — release**

Player reverses/moves away or stops outside conflict range.

**Phase 3 — autonomous recovery window**

Player is no longer responsible for blocking. Companion receives ordinary autonomous objective away from wall.

### Evidence

Record per phase:

- minimum physical gap to wall;
- desired-clearance violation;
- static contact labels;
- player contact;
- route status;
- selected local state/candidate;
- requested/actual velocity;
- time from player conflict-clear to resumed meaningful progress;
- whether reset is required.

### Current failure definition

After the player conflict has clearly ended, companion remains in zero/near-zero autonomous motion for a long bounded window while objective remains unsatisfied and hard egress exists.

This should become the closest automated analogue to the Owner recording.

---

## 5. R1-0D — S4 final-command boundary

### Question

Can the NATURAL continuity actuator turn a spatially validated preferred motion into a final command that enters the desired-clearance-invalid band?

### Isolated setup

Use simple wall geometry and a companion moving quickly approximately toward/tangential to the wall.

Establish:

1. current actual velocity from prior ticks;
2. a newly selected preferred/refined velocity that is itself valid under the current spatial query;
3. a sharp turn/reversal so the continuity actuator retains part of prior velocity.

### Required instrumentation

For each tick record:

`coarse preferred -> refined preferred -> commanded -> actual`

plus:

- hard-body sweep result for preferred;
- desired-clearance sweep result for preferred;
- hard-body sweep result for final commanded motion;
- desired-clearance sweep result for final commanded motion;
- clearance before/after step.

### Red condition

Preferred/refined motion is valid, but final NATURAL command crosses the desired-clearance boundary or creates a subsequent state in which normal planning becomes unreachable/HOLD.

### Important alternative

If the final command never violates either safety envelope, C2 is weakened. Do not add post-actuator projection just because it sounds architecturally neat.

---

## 6. R1-0E — temporary unreachable / recovery semantics

### Question

What does the current stack do when a route is temporarily unavailable and later becomes available without reset?

The first version may use a controlled state transition rather than dynamic obstacles, because the current lab has static authored geometry.

Candidate methods:

- player occupancy/conflict creates temporary local inability while static route remains valid;
- test harness temporarily changes/chooses a relationship target that is unreachable, then restores a reachable target;
- start inside desired-clearance violation, then manually/test-fixture move to valid clearance only if needed to isolate route-state memory.

### Evidence

Track whether:

- `unreachable` is represented distinctly from `arrived`;
- route status transition causes immediate useful reconsideration;
- prior STOP/HOLD state survives after reachability returns;
- spatial brain cadence/state must be reset manually to recover.

### Red condition

Reachability returns but the autonomous system remains in a stale HOLD/zero-motion state longer than its normal decision cadence without a valid intentional-wait reason.

---

## 7. R1-0F — browser-faithful rehearsal script

After isolated red fixtures exist, add one broader deterministic scripted trial approximating the Owner behavior rather than replacing the isolated tests.

Suggested sequence in doorway or pillar scene:

1. player crosses companion's path;
2. reverses direction;
3. pushes/contacts companion near static geometry;
4. disengages;
5. changes travel direction again;
6. leaves enough room/time for autonomous resume.

This trial is expected to be less diagnostic than R1-0A–E but more representative of real play.

It should log a compact incident summary automatically on failure.

---

## 8. Harness requirements before repair

Do not require Phaser for R1-0A–E.

Headless harness should be able to:

- construct exact actor/static geometry fixture;
- step player and companion intents through the real World/physics substrate;
- run route + spatial + optional NATURAL layers;
- capture pre-decision and post-World evidence explicitly;
- report route/status/candidate/clearance transitions;
- fail with a compact diagnostic summary rather than thousands of per-tick lines.

If current `LabWorld.create(id)` prevents precise test fixtures, prefer the smallest test-oriented World/scenario construction seam rather than adding permanent gameplay scenarios solely for regression tests.

Do not let test convenience leak Rapier objects into brain code.

---

## 9. Promotion rule for R1-0

R1-0 is successful even if every new test is red.

It passes as a research phase when:

1. at least one deterministic fixture reproduces the Owner failure class or a tightly equivalent causal mechanism;
2. the failing layer is localized enough to discriminate among C1/C2/C3/C4 or expose a better hypothesis;
3. diagnostics distinguish hard physical legality, desired-clearance legality, route state, spatial choice, actuator output and World outcome;
4. no repair has been smuggled into the fixture just to make it pass.

Only then begin R1-1/R1-2 implementation work.

---

## 10. First coding order

When R1 execution begins, use this order unless new evidence invalidates it:

1. smallest exact test-fixture construction seam;
2. R1-0A clearance-egress red test;
3. R1-0B query semantics probe;
4. R1-0C push/release trial;
5. R1-0D actuator-boundary trial;
6. R1-0E temporary-unreachable trial;
7. browser-faithful composite rehearsal;
8. causal summary of which hypothesis survived.

**No production repair before step 8.**
