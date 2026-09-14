# CCC-0 — Behavior Forensics Audit

Status: **ACTIVE AUDIT · OWNER LIFE SIGNAL PRESENT · NO TUNING · NO AUTHORITY PROMOTION**

Date: 2026-09-14

Primary source evidence:

`docs/CCC_0_OWNER_VIDEO_1_BEHAVIOR_FORENSICS.md`

This is a living audit ledger for the current one-companion movement/coordination stack. It is intentionally not an architecture specification.

---

## 1. Current research question

The Owner has reported the first weak, spontaneous feeling that the companion is beginning to behave "alive" without being able to name a single cause.

The correct question is now:

> Which current temporal/spatial behaviors represent useful embodied continuing intention, and which defects merely look intentional because the downstream motor renders them gracefully?

The audit must preserve both possibilities.

---

## 2. Current behavior stack and temporal rates

Authoritative runtime currently composes approximately:

1. legacy relationship objective — ~10 Hz (`6` World ticks);
2. static route projection — each movement evaluation from current target;
3. local spatial direction+speed choice — ~20 Hz (`3` World ticks);
4. hard-vs-comfort local candidate repair;
5. NATURAL weighted preferred-velocity refinement;
6. motor continuity — ~60 Hz;
7. final one-step static hard command constraint;
8. Rapier World outcome — ~60 Hz;
9. progress/recovery observation — post-World;
10. CCC-0 shadow coordination evidence — ~10 Hz, zero movement-output authority.

This layered time structure itself is now a first-class research object.

---

## 3. Proto-agency candidates

### PA-1 — history-dependent action

**Status: MATERIAL CANDIDATE**

The next action depends on previous relationship state, previous local move, actual body velocity, previous acceleration, recovery episode state and World outcome.

This is qualitatively different from a stateless follower servo.

Preserve the principle:

> an embodied teammate should have temporal continuity of intention and body state.

Do not preserve current constants/representations merely because they implement that principle today.

### PA-2 — multiple decision timescales

**Status: MATERIAL CANDIDATE**

Slower relationship decisions coexist with faster local responses and per-tick physical realization.

Potential benefit:

- intention persists;
- local reactions remain fast;
- body correction is continuous;
- the companion can appear to react without globally re-deciding its identity every frame.

Open falsifier:

> do synchronized 6/3/1 tick clocks create artificial rhythmic pulses that only resemble cognition?

### PA-3 — non-monotonic relationship motion

**Status: OWNER VIDEO SIGNAL · CAUSE MIXED**

The companion can move laterally, temporarily away, slow, stop, then recover. The Owner video suggests this is a major perceptual contributor.

Desired principle:

> useful teammate motion need not monotonically minimize Euclidean player distance.

Current implementation must not be assumed correct merely because it exhibits this property.

### PA-4 — joint direction + speed choice

**Status: MATERIAL CANDIDATE**

Local motion represents stop + multiple speed fractions + omnidirectional directions rather than selecting direction first and applying a fixed speed later.

Likely useful for future cooperation/catch-up/yield semantics.

### PA-5 — temporal body realization

**Status: MATERIAL CANDIDATE WITH KNOWN DANGER**

Acceleration/braking/jerk constraints turn preferred-motion changes into physical arcs rather than instantaneous vector rotation.

This is likely a strong contributor to perceived embodiment.

Danger:

> good temporal realization can make a bad upstream decision look convincingly intentional.

### PA-6 — soft comfort separate from hard geometry

**Status: USEFUL FOUNDATION PRINCIPLE**

Temporary comfort violation can be tolerated while hard body feasibility remains authoritative.

This distinction should survive future redesign, while the present exact penalties/radii remain disposable.

---

## 4. Confirmed or strongly supported living-error classes

### LE-1 — slot-label continuity is not spatial-intention continuity

**Status: CONFIRMED CLASS · HIGH PRIORITY**

Legacy hysteresis retains a symbolic slot label while recomputing that slot in the player's current heading-relative frame.

Exact-equation sweep of the live legacy scoring/hysteresis model across a broad range of companion positions (no obstacle invalidation) shows:

- 45° heading change: same label retained in ~98% of samples; same-label target displacement ≈ `1.11`;
- 90°: same label retained in ~67%; same-label target displacement ≈ `2.05`;
- 135°: same label retained in ~37%; same-label target displacement up to ≈ `2.68`;
- 180°: same label retained in ~23%; same-label target displacement can reach the full `2.90` diameter of the 1.45-radius slot ring.

These percentages characterize the swept synthetic position set; they are not gameplay occurrence probabilities.

Implication:

> the system can report "retain the same relationship slot" while moving the actual world target several body lengths.

NATURAL can then render that discontinuity as a smooth broad arc.

This is the strongest current living-error candidate.

### LE-2 — initial fake heading + deterministic side choice

**Status: CONFIRMED MECHANISM**

Legacy relationship state initializes last player heading to world `+X`.

When the player begins stationary, this fabricates semantic front/back evidence.

In symmetric side candidates, deterministic string tie-breaking can select one side (for example `left`) solely because of identifier ordering.

Potential perceptual artifact:

> repeatable side preference may look like personality while being only initialization + lexicographic order.

### LE-3 — router symmetry can become apparent route preference

**Status: CONFIRMED MECHANISM · GAMEPLAY IMPACT UNMEASURED**

Static shortest-path ties are resolved deterministically using path/node identifier ordering.

This is correct for reproducibility but not a semantic preference.

Potential perceptual artifact:

> repeatedly taking one side of a symmetric obstacle can look like an agent habit.

The future system may legitimately have persistent route preference, but it should come from continuity/cost/intent evidence rather than lexical node names.

### LE-4 — relationship label doubles as recovery-episode identity

**Status: CONFIRMED COUPLING · HIGH PRIORITY**

Workbench objective identity is currently derived from the selected slot label.

Consequences:

- same label + radically moved world target can remain one recovery episode;
- changed label + spatially continuous relationship can reset progress history as a new episode.

A symbolic slot name is therefore carrying too many responsibilities:

`relationship category + world objective + temporal episode identity`

Future objective identity needs explicit temporal/spatial semantics rather than inheriting identity from a display-like label.

### LE-5 — close-player policy changes discontinuously at the comfort boundary

**Status: CONFIRMED MECHANISM · BEHAVIORAL IMPACT NEEDS ISOLATION**

Current local player interaction uses:

`companion radius 0.30 + player radius 0.30 + buffer 0.18 = 0.78`

When current center distance is greater than ~0.78, a candidate whose short prediction enters that buffered envelope is hard-rejected.

When already at/below the threshold, that hard rejection is suppressed; player interaction is then handled through scoring/physics rather than an explicit player-egress contract.

Potential result:

- sudden change in local policy near the threshold;
- squeeze/side-step behavior;
- lucky near-misses;
- unsafe temporal carry that can look skillful.

The static overlap path has explicit egress semantics. Player overlap currently does not have an equivalent qualified final authority in main.

Historical R1-5A evidence remains relevant donor evidence, not live authority.

---

## 5. Shadow findings before authority

### SH-1 — WHERE heading memory currently has no expiry

**Status: CONFIRMED**

Shadow WHERE correctly avoids fabricating an initial +X heading when no player motion exists.

However, once a meaningful player direction exists, a stationary player can continue using that previous heading indefinitely as `source: previous`.

This can represent either:

- useful short-term intention memory: "we were going that way";
- stale semantic context after a long stop.

Do not invent a timeout yet.

Required falsifier:

> stop for increasing durations and observe when persistent heading stops helping relationship interpretation.

### SH-2 — PLAYER FLOW can compare against a very old pre-stop direction

**Status: CONFIRMED**

Stationary corridor evidence has zero direction/horizon/confidence, which is good.

But its history preserves the previous moving direction. Movement after a long stop can therefore be compared against a direction from arbitrarily long ago and be marked as reversal uncertainty.

The needed concept is likely **memory confidence/age**, not simply "remember" vs "forget".

### SH-3 — PACE has an ordinary-speed floor, not true pace matching

**Status: CONFIRMED**

Current provisional ordinary pace is at least 55% of physical capability.

With max speed `3`, this floor is `1.65`.

Therefore a companion already in a good region beside a player walking at e.g. `0.5` can still expose a provisional desired speed around `1.65` when urgency is low.

This is not yet credible teammate pace matching.

It is acceptable only because PACE has zero authority.

### SH-4 — PACE approximates region motion with player velocity

**Status: CONFIRMED MODEL LIMITATION**

Relative opening/closing currently uses player velocity relative to companion velocity projected toward the current representative anchor.

But the useful region can move for reasons not captured by player translation:

- player heading rotates;
- coherent region changes;
- route/topology changes;
- representative moves within the region.

Therefore PACE may miss that its own useful region is moving away or may misattribute why separation changed.

Existing `anchorDisplacement` / topology evidence should be used during research before deciding the future pace model.

### SH-5 — shadow sampling/router ties remain deterministic, not intentional

**Status: KNOWN BIAS SOURCE**

Sample IDs and route IDs are valid deterministic tie-breaks for reproducible evidence.

They must not later become accidental personality/side-preference authority.

---

## 6. Important unresolved behavior classes

### U-1 — broad arcs

Need to partition each observed arc into:

- moving relationship objective;
- route/topology change;
- local SIDESTEP/BACKOFF;
- refinement angle;
- temporal continuity carry;
- final hard constraint;
- recovery reset.

A broad arc is not itself PASS or FAIL.

### U-2 — speed modulation

Video shows large companion speed variation.

Need to determine contribution from:

- discrete/adaptive local speed fractions;
- unnecessary-motion penalty near relationship target;
- braking/acceleration continuity;
- player-risk avoidance;
- objective/route relocation.

Do not claim current local speed behavior is coherent PACE.

### U-3 — apparent yielding / right-of-way

Current system can avoid predicted player space, but it does not yet have explicit asymmetric right-of-way semantics.

Need adversarial crossing tests that separate:

- geometrically cheap avoidance;
- temporal carry;
- genuine "player goes first" cooperation.

### U-4 — doorway cooperation

The doorway is simultaneously stressing:

- relationship target frame;
- static topology;
- player flow;
- local player avoidance;
- comfort clearance;
- recovery.

Success at "eventually gets through" is no longer enough.

Need to identify who commits, who yields, whether decisions remain legible, and whether the player must babysit the companion.

### U-5 — persistent side/topology preference

A useful companion may benefit from stable choices instead of unnecessary side-flipping.

But future persistence must be distinguished from lexical determinism.

Question:

> what evidence makes "keep this side" a meaningful continuing intention?

Candidates include world-space region overlap, route topology continuity, cooperation episode, explicit command, or role — not slot-name order.

---

## 7. Priority falsifier campaign

### F1 — 90° / 180° relationship-frame turn

Observe at single-step resolution:

- relationship revision + label;
- old/new world target;
- target displacement;
- route change;
- selected local motion;
- refinement delta;
- continuity regime;
- final command;
- World outcome.

Goal:

> distinguish useful continuous regrouping from a smoothly rendered target teleport.

### F2 — stationary-duration sweep

Stop for approximately:

- brief pause;
- ~0.5 s;
- ~2 s;
- long pause;

Then resume same direction and reverse direction.

Inspect:

- legacy heading;
- shadow WHERE heading source;
- corridor reversal confidence;
- region stability;
- perceived intentional continuity.

Goal:

> discover useful memory horizon empirically rather than inventing a timeout.

### F3 — symmetric side test

Create/reuse open and symmetric obstacle situations and repeat from reset.

Goal:

> identify behavior caused by deterministic IDs rather than stateful spatial continuity.

### F4 — 0.78 player-boundary crossing

Approach/cross around the current buffered player distance from multiple angles and velocities.

Inspect preferred candidate set and final motion.

Goal:

> determine whether policy discontinuity produces useful egress or unstable/unsafe close interaction.

### F5 — slow-walk pace test

Move at low sustained player speed while companion is already in a useful region.

Goal:

> compare human-intuitive pace with shadow desired speed and expose oscillatory catch-up pressure before PACE has authority.

### F6 — topology vs heading separation

Around pillar/doorway, create separately:

- heading change without topology change;
- topology change with little heading change.

Goal:

> determine whether region continuity evidence distinguishes semantic turn from geometric/topological reconfiguration.

### F7 — cross-front / pass-behind A/B

Repeat similar crossings with different player approach directions.

Goal:

> separate player-risk geometry from genuine asymmetric cooperation requirements.

---

## 8. Instrumentation policy for this campaign

Use the existing workbench first.

Already live-visible:

- relationship revision/slot/target;
- route pre/post state;
- local state/candidate;
- hard/comfort evidence;
- refinement source/angular delta;
- continuity regime, preferred/final speed, acceleration, jerk;
- final static constraint;
- World requested/actual velocity;
- progress/recovery state;
- CCC-0 WHERE/PACE/PLAYER FLOW.

Incident capture currently preserves much of the chain but not every live-only diagnostic term.

Only extend causal schema when a forensic question cannot be reconstructed from existing incident frames. Highest-value likely additions are:

- relationship target displacement at revision;
- heading angular change at revision;
- same-label / moved-target evidence;
- refinement source/angular delta;
- continuity regime/accel/jerk;
- local safety state;
- explicit local-retry/reset event.

Do not create a second telemetry architecture.

---

## 9. Current overall verdict

### Evidence substrate

**ADEQUATE TO CONTINUE FORENSICS.**

### Companion behavior quality

**MIXED / NOT QUALIFIED.**

### First aliveness signal

**REAL OWNER PERCEPTUAL SIGNAL; CAUSE PARTLY GROUNDED, PARTLY SUSPECT.**

### Most defensible current hypothesis

Perceived aliveness is beginning to emerge from:

- temporal state;
- multiple timescales;
- nontrivial joint direction/speed choice;
- smooth physical realization;
- World-coupled correction;

while several of the strongest visible signatures can also be amplified by:

- heading-frame target discontinuity;
- symbolic identity mismatch;
- deterministic tie bias;
- close-player policy discontinuity;
- stale directional memory.

The goal is not to remove everything suspicious and return to a robotic follower.

The goal is:

> **replace accidental causes with deliberate embodied teammate semantics while retaining the temporal richness that made the Owner notice life at all.**

No CCC-1 authority promotion should occur until this distinction is materially clearer.
