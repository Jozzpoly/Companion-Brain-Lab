# R1-0 — Reproduction Evidence

Status: **REPRODUCTION PASS / PRODUCTION BEHAVIOR INTENTIONALLY STILL FAILING**

Date: 2026-09-14

R1-0 existed to determine whether the S4 Owner/browser shutdown-like behavior could be reduced to a deterministic causal mechanism before selecting a repair.

It can.

No production movement/query/route/actuator code was changed in this stage.

---

## 1. Finding: clearance prison is reproduced deterministically

Commit introducing the red fixture:

`bd4e4b2cf596ef9714babb2f0478a502b9b00379`

CI run:

`34798076215`

The test intentionally places a radius-0.30 companion at `x ~= 5.16` next to a wall whose left face is `x = 5.5`.

This state is physically legal:

- hard physical radius: `0.30`;
- hard-body egress sweep away from the wall: **CLEAR**.

But the current route/local locomotion contract uses:

`0.30 physical radius + 0.08 desired static clearance = 0.38 query radius`.

The enlarged query shape begins overlapping the wall-clearance envelope.

Exact CI diagnostic:

```text
hard.clear = true
desired.radius = 0.38
desired.clear = false
desired.blocker = r1.wall
desired.distance = 0
route.status = unreachable
route.path = []
spatial.state = HOLD
spatial.selectedCandidate = stop
spatial.accepted = 1
spatial.rejected = 72
spatial.acceptedMoving = 0
```

Therefore the current movement stack can transform a **physically legal state with a clear hard-body egress** into an autonomous planning dead-end solely because the desired-clearance envelope starts in overlap.

**Classification: DEMONSTRATED MECHANISM.**

---

## 2. Finding: exact Rapier compat build supports outward egress semantics

Probe commit:

`fce5afab51489b1f4231c0cd1906c9262a0b955f`

Probe:

`src/physics/r1-shape-cast-egress-semantics.test.ts`

The exact installed `@dimforge/rapier2d-deterministic-compat` 0.20 behavior matches the relevant public Rapier documentation:

- enlarged circle starts overlapping the wall-clearance envelope;
- cast moves directly away from the overlap;
- `stopAtPenetration=true` returns an immediate hit at TOI approximately zero;
- the same cast with `stopAtPenetration=false` returns no blocking hit in this fixture.

The probe itself passes even while the intentionally red production-invariant test fails.

**Classification: DEMONSTRATED LIBRARY CAPABILITY.**

Important boundary:

This does **not** select `stopAtPenetration=false` globally as the repair. It proves only that a scoped egress-capable query is mechanically expressible in the exact dependency build.

---

## 3. Finding: ordinary player contact can create the clearance prison

Dynamic reproduction commit:

`15f95feeb43ad62ae60352348954d25733b7a988`

CI run:

`34798250259`

The fixture uses the actual dynamic Rapier bodies and velocity-driven physical step.

Phases:

1. player moves into a passive companion and pushes it toward a wall;
2. player then moves clearly away and contact ends;
3. ordinary SPATIAL autonomy receives a clean target directly away from the wall.

Observed diagnostic:

```text
hard wall minimum center x = 6.3000
desired-clearance minimum center x = 6.3800

companion after push/release x = 6.3770847
player after release x = 8.7728920

hard egress = CLEAR
desired egress = BLOCKED
initial desired hit distance = 0

first autonomous route = unreachable
first autonomous state = HOLD
first candidate = stop
moving decision seen = false
progress over 90 autonomous ticks = 0
```

The companion was only approximately `0.0029 m` inside the desired-clearance boundary. It did not need to be visibly or deeply pinned.

The player was already far away and no longer in contact when autonomy was evaluated.

**Classification: DEMONSTRATED DYNAMIC-PLAY ENTRY PATH.**

This is the strongest bridge so far between the minimal clearance-prison mechanism and the Owner recording.

---

## 4. Finding: S4 temporal continuity can independently enter the same invalid band

Probe commit:

`e554187b61679d22a1ef60446da6c661916bc209`

Probe:

`src/brain/r1-actuator-boundary.probe.test.ts`

Setup:

- companion begins outside desired clearance near a wall;
- current body velocity points toward the wall at full experimental speed;
- new preferred motion is a full reversal directly away from the wall;
- preferred motion itself is valid under desired-clearance traversal.

S4 continuity deliberately preserves part of the old motion on the first tick.

The probe demonstrates:

- preferred velocity points away from wall;
- preferred desired-clearance sweep is **CLEAR**;
- final commanded velocity still points toward wall on that tick;
- final commanded position crosses the desired-clearance boundary;
- final commanded hard-body sweep remains **CLEAR**;
- real physical step accepts the command;
- resulting position is physically legal but desired-clearance-invalid;
- no wall contact is required.

**Classification: DEMONSTRATED S4 ENTRY PATH / FINAL-COMMAND SAFETY GAP.**

S4 did not create the underlying clearance-prison mechanism, but it adds another legitimate path into it.

---

## 5. Finding: cached HOLD is not the root cause

Probe commit:

`2da96be67207068bb032170361f1d9e713e43005`

Probe:

`src/brain/r1-clearance-external-release.probe.test.ts`

The same SpatialLocomotionBrain first observes the desired-clearance-invalid state and enters:

`unreachable -> HOLD -> stop`.

A temporary external/manual motion then moves the physical companion back outside the desired-clearance-invalid band.

Without resetting the brain, the next normal decision after cadence sees a valid direct route and produces non-HOLD movement toward the target.

**Classification: ALTERNATIVE HYPOTHESIS FALSIFIED.**

The persistent shutdown is not primarily a stale/corrupt cached HOLD decision. The brain can recover when the evidence becomes legal again.

The autonomy fails because it has no admissible autonomous action that can restore that evidence.

---

## 6. Causal model after R1-0

The strongest current model is now:

```text
entry path A: player/body contact
                    \
                     -> physically legal state inside desired-clearance envelope
                    /
entry path B: S4 temporal carry

                     ↓

current enlarged static cast starts in penetration
(stopAtPenetration=true)

                     ↓

outward/egress movement is classified blocked at distance 0

                     ↓

route from current start can become unreachable

                     ↓

local moving velocity candidates are hard-rejected

                     ↓

STOP remains admissible

                     ↓

SPATIAL HOLD

                     ↓

no autonomous mechanism changes the state

                     ↓

persistent apparent companion shutdown
```

This does not prove that every shutdown in the Owner video has exactly this cause, but it reproduces the same observable failure class through ordinary physical interaction and demonstrates all critical links in the mechanism.

---

## 7. What R1-0 did NOT select

No decision has yet been made to:

- globally set `stopAtPenetration=false`;
- remove the 0.08 m desired clearance;
- make route connectivity use physical radius only;
- introduce post-actuator clipping/projection;
- change dynamic bodies to Rapier KCC;
- add recovery heuristics;
- soften/disable player-companion collision.

Those remain candidate interventions to compare against R1 invariants.

---

## 8. R1-0 gate result

The R1-0 research gate is **PASS** because:

1. the Owner failure class has a deterministic minimal reproduction;
2. ordinary dynamic player contact reproduces an equivalent persistent autonomous shutdown;
3. exact library semantics relevant to egress are bound by a passing probe;
4. S4 final-command carry is independently shown to create the prerequisite boundary state;
5. stale brain cache has been falsified as the primary cause;
6. no production repair was introduced during reproduction.

The intentionally red tests should remain preserved as failure evidence until a later repair branch turns their desired invariants green.

---

## 9. Next stage

Proceed to **R1-1 Causal Workbench v2** before production repair.

The known failure should initially remain reproducible.

R1-1 must make the following simultaneously visible without covering the world:

- hard-body legality;
- desired-clearance violation;
- route state/revision/reason;
- spatial accepted/rejected motion;
- preferred/refined/commanded/actual movement;
- entry into HOLD;
- progress/recovery classification placeholder;
- causal phase identity from observation through World outcome.

Once the known failure is easier to inspect in the new workbench, R1-2 can compare repair semantics with substantially better evidence.
