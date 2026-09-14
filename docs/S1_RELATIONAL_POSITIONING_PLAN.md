# S1 — Relational Positioning Probe

Status: **PLANNED / IMPLEMENTATION AUTHORIZED**  
Base: qualified S0 physical apparatus (`448ca9c86f219d9c18a8898dfa36d0b9a82cdce1`)

## Research question

Can a very small local live-brain policy make one companion maintain a useful spatial relationship to a moving player **without** commands, combat, pathfinding or higher cognition — and can we make its failures causal and obvious enough to guide the next stage?

This is not a companion architecture selection. It is a bounded probe into the smallest useful unit of autonomous cooperation: **where should I be relative to you right now?**

## Why this follows S0

S0 is qualified only as a research apparatus. Owner/browser evidence judged it extremely raw but found collision behavior stable enough for research. The hard-contact model is therefore retained unchanged as the S1 baseline.

The Owner's soft-contact idea (hard core + compressible envelope / possible visual squash) remains a separate A/B hypothesis. S1 must not depend on it. Otherwise soft overlap could hide poor positioning and contaminate the first brain evidence.

## Comparison, not demonstration

S1 must expose three companion-control modes in the same runtime:

1. **MANUAL** — arrow-key control from S0. Physical baseline and human reference.
2. **CHASE** — deliberately naive point-following: move directly toward the player outside a small stop radius.
3. **RELATIONAL** — bounded local positioning probe described below.

The research claim is not that RELATIONAL is good. The useful outcome is a clear comparison showing which failures disappear, which remain and which new ones appear.

## Relational probe

The probe should reason over public world snapshots only and output a normal `MotionIntent`. It must never mutate physics/world state directly.

At a modest tactical cadence independent of the 60 Hz physical step, evaluate a small deterministic set of candidate relationship positions around the player. A first useful candidate set is a ring of eight angular slots at one preferred radius.

Each candidate receives explicit score terms rather than hidden logic. Initial terms:

- **front obstruction penalty** — when the player is meaningfully moving, positions in the player's near-forward corridor are undesirable;
- **travel cost** — avoid unnecessary long repositioning by the companion;
- **switch/hysteresis cost** — prefer the previously selected relationship slot unless another is materially better;
- **static occupancy/clearance penalty** — do not intentionally choose a point inside authored static geometry or outside the world;
- **relationship distance term** — candidates remain near the intended player-companion spacing.

This is deliberately not declared a Utility AI architecture. Candidate scoring is just the simplest inspectable instrument for this question.

### Player direction

Use observable player motion, not hidden input state if avoidable. When actual/requested velocity has sufficient magnitude, derive a forward direction from it. When the player is effectively stationary, preserve the last meaningful player direction rather than allowing the candidate frame to spin arbitrarily.

### Hysteresis

The probe should not swap left/right/back slots every tactical update because scores are nearly tied. A current-slot retention margin is required. Thrashing is a first-class failure signal.

### Motor layer

The motor remains intentionally simple: move toward the selected relationship point, slow/stop within a tolerance, and let the qualified S0 physical World resolve contacts.

No obstacle pathfinding is added in S1. If a pillar or doorway blocks the direct motor path, that failure should remain visible. This is useful evidence for the later competence/navigation stage.

## Brain cadence

Do not run expensive decision selection every physics tick merely because the World ticks at 60 Hz.

Initial probe cadence: **10 Hz tactical reconsideration**, with the currently selected target/intention reused by the 60 Hz motor loop between reconsiderations.

This is a test value, not a future architecture contract. It exists to expose the distinction between continuous movement execution and slower local tactical reconsideration.

## Public debug state

S1 should expose enough causal state to answer "why is the companion going there?" without private chain-of-thought.

Minimum debug state:

- mode: MANUAL / CHASE / RELATIONAL;
- current selected relationship slot;
- selected world-space target;
- player direction used by the probe;
- candidate positions;
- per-candidate total score and key score terms;
- tactical reconsideration count/tick;
- compact reason-for-selection / reason-for-change;
- normal S0 requested-vs-actual velocity and contact evidence.

Rendering should make the selected target and candidate ring visible when debug is enabled, but the World must not depend on Phaser/render state.

## Controls

Preserve S0 controls. Add one low-attention comparison control:

- `M` — cycle companion mode: MANUAL → CHASE → RELATIONAL → MANUAL.

Arrow keys continue to control the companion only in MANUAL mode.

Default S1 mode should be RELATIONAL so an Owner run immediately exercises the new question. The HUD must make the active mode unambiguous.

## Scenarios and falsifiers

### Open field

Expected useful behavior:

- companion converges to a stable side/back relationship instead of occupying the player's exact point;
- when the player reverses direction, the companion adapts without high-frequency side swapping;
- when the player stops, the companion settles rather than orbiting forever.

FAIL signals:

- oscillation between equivalent slots;
- blocking the player's forward line despite free alternatives;
- constant micro-motion with no meaningful world change;
- pathological lag caused by 10 Hz reconsideration.

### Head-on

Use this to compare CHASE and RELATIONAL physically.

Expected result: CHASE should often create direct player-companion contention; RELATIONAL should reduce it when space exists.

If RELATIONAL only looks better because collision pushes the bodies apart, the debug target/slot should expose that.

### Pillar

No pathfinding is present. We expect direct steering to become blocked in some layouts.

This is a **diagnostic scenario**, not necessarily an S1 failure. The important question is whether debug evidence clearly distinguishes "positioning target is sensible but motor/navigation cannot reach it" from "brain selected a bad relationship target".

### Doorway

The probe should avoid needless player obstruction if a side/back slot is available, but narrow passage will reveal whether local relationship maintenance fights necessary traversal.

Useful failure evidence includes stale side preference, trying to maintain formation through geometry, or companion/player contention while both need the same narrow space.

## Automated evidence to require

At minimum:

- deterministic candidate scoring for identical snapshot + brain state;
- front positions score worse than side/back alternatives while player is moving;
- hysteresis retains the current slot for near-ties;
- clearly superior candidates can still break hysteresis;
- candidates inside static obstacles/outside world are rejected or strongly dominated;
- CHASE produces a normal companion `MotionIntent` without mutating World state;
- RELATIONAL produces a bounded normalized motion intent toward its selected target;
- tactical reconsideration does not advance World time;
- existing S0 physical tests remain green.

## Qualification boundary

S1 PASS means only:

> The first autonomous local positioning probe produces a visibly and causally different player-companion relationship from naive point-chasing, remains stable enough to inspect, and its failures tell us what competence is missing next.

S1 PASS does **not** mean the companion is intelligent, combat-ready, navigation-capable or architecturally settled.

A useful S1 can PASS even while failing at pillar/doorway navigation if those failures are cleanly attributable and the relational policy itself demonstrates value in open/shared space.

## Next decision after Owner evidence

Do not pre-commit.

Depending on observed failures, the next stage may be:

- locomotion/navigation competence;
- better dynamic yielding / reciprocal avoidance;
- perception limitations;
- richer local relationship goals;
- a soft-contact A/B spike if rigid-disc contact is now materially contaminating cooperation;
- or rejection/replacement of this positioning probe.
