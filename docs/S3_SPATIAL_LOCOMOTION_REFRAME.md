# S3 — Spatial Locomotion Core Reframe

Status: **ACTIVE REFRAME — supersedes naive waypoint-following as the next movement step**

## Why this reframe exists

Owner browser evidence from S2-C0 shows that the debug workbench is already highly valuable, but also exposes a deeper limitation: the companion is still fundamentally a point-seeking mover. Static route reasoning improved substantially, yet the movement policy remains too raw, too target-centric, and too weakly aware of local space.

The rejected next move was: **give the S2-C0 route immediate waypoint movement authority**.

That would make the companion a better waypoint follower, but would not solve the core problem that local movement currently has almost no independent spatial intelligence.

## New core question

> Can the companion continuously choose a useful 2D velocity from the full local movement space — including advance, strafe, back-off, hold and yield — by combining route corridor, relationship intent, static clearance, player motion, dynamic collision risk and recent movement history, while exposing the full decision surface through the debug workbench?

## Architectural skeleton

```text
relationship objective / tactical intent
                ↓
       route corridor / lookahead
                ↓
       local spatial observation
                ↓
      candidate velocity field
                ↓
       local locomotion choice
                ↓
          MotionIntent
                ↓
       World / physics authority
                ↓
 contacts / actual motion / progress
                ↓
 trace + debug + later recovery/cooperation
```

This is a research skeleton, not a frozen architecture.

### Responsibility rule

- Relationship logic says **what spatial relationship is useful**.
- Route logic says **what static corridor can connect current area to that objective**.
- Local locomotion says **what velocity is useful right now**.
- World/physics says **what actually happens**.
- Progress/cooperation logic later interprets persistent failure, dynamic conflicts and yielding.

No layer may silently become the physical authority.

## Local spatial observation

The first implementation should build an explicit, inspectable 360-degree local picture around the companion.

Initial research representation:

- radial whole-body clearance probes around the full circle;
- static obstacle identity / distance for blocked directions;
- player relative position and relative velocity;
- short-horizon predicted player motion;
- current route lookahead and route corridor direction;
- current relationship target / objective;
- companion current requested and actual velocity;
- recent contact / motion-error evidence.

The representation must be bounded and cheap enough to run frequently. It is not a world model and must not become omniscient.

## Candidate velocity field

Instead of one vector `toward(target)`, generate a bounded lattice of candidate local velocities over the full 360-degree plane.

Working initial probe:

- multiple headings over 360 degrees;
- multiple speed bands plus stop;
- short prediction horizon;
- whole-body static feasibility per candidate;
- dynamic player separation prediction;
- deterministic scoring and tie-breaks.

Candidate terms may include:

- route/corridor progress;
- relationship utility;
- static clearance;
- predicted player collision/interference risk;
- continuity / acceleration cost;
- escape-space value;
- front-of-player obstruction penalty;
- unnecessary motion penalty near a good relationship state.

The exact weights are experimental and must be visible in debug. Hard rejection and soft scoring must be distinguishable.

## Omnidirectional behavior

There is no concept of `forward-only` movement in this stage.

The local planner must be able to choose:

- advance;
- lateral sidestep / strafe;
- diagonal correction;
- back-off;
- stop / hold;
- later: explicit yield / recover.

Facing/animation is a separate future concern. The current circular body is intentionally holonomic so movement intelligence can be studied without animation constraints.

## Static route role after this reframe

S2-C0 remains valuable, but its role changes:

**route = corridor / lookahead guidance, not direct motor command.**

The local locomotion layer may temporarily move away from the mathematically shortest route when local space, player motion or collision risk makes that useful. It should still make measurable progress toward the corridor/objective over time.

## Dynamic-agent policy

For the first one-companion experiment, player avoidance should be deliberately asymmetric:

- the player retains control authority;
- the companion bears most responsibility for not obstructing the player;
- player predicted motion is treated as a dynamic constraint / cost;
- no hidden teleporting or ghosting.

This is intentionally simpler than adopting full ORCA/RVO immediately.

ORCA/RVO remains a serious later baseline for multi-agent local avoidance, not a current architecture commitment.

## Debug Workbench becomes a peer system

Debug is not support tooling for S3. It is one of the two primary products of the stage: **movement intelligence + observability**.

### Required spatial debug

In `SPATIAL` / `ALL` views expose:

- radial clearance field;
- blocker labels/distances where useful;
- player current and predicted movement;
- route lookahead / corridor cue;
- relationship objective;
- full candidate velocity cloud;
- accepted vs hard-rejected candidates;
- selected velocity and short predicted trajectory;
- top candidate alternatives;
- score-term decomposition;
- local locomotion semantic state, e.g. `ADVANCE`, `SIDESTEP`, `BACKOFF`, `HOLD`, later `YIELD` / `RECOVER`;
- reason for the selected candidate and reason for hard rejection of important alternatives.

### Owner QoL direction

Treat these as first-class follow-up work, not polish:

- direct debug layer selection in addition to cycling presets;
- time scale controls;
- auto-pause on selected semantic events / failures;
- bounded trace scrub / replay window;
- richer incident bundles with spatial decision snapshots;
- visual distinction between intent, prediction, chosen action and physical outcome;
- optional persistence/freeze of a spatial decision frame for inspection.

## A/B authority strategy

Do not replace the old behavior in-place.

Keep existing baselines and add a distinct `SPATIAL` companion mode.

Owner can compare:

- `MANUAL`;
- `CHASE`;
- `RELATIONAL` legacy point-seeking baseline;
- `SPATIAL` new local locomotion authority.

This gives the aggressive redesign real movement authority while keeping falsification and rollback cheap.

## Initial implementation campaign

### S3-A — spatial observation + debug

Build radial whole-body local clearance and player-relative/predicted motion representation. Visualize and test it.

### S3-B — candidate velocity lattice

Generate deterministic 360-degree candidate velocities with explicit hard rejection and score decomposition. Run in shadow first only long enough to verify the decision surface is sane.

### S3-C — SPATIAL authority

Allow the selected local velocity to produce `MotionIntent` in the new A/B mode. Keep route/relationship layers unchanged as inputs so causality remains separable.

### S3-D — progress and dynamic cooperation

Only after the local movement layer is visible and credible: add progress classification, contested-passage detection, yield/recovery semantics and player-right-of-way behavior.

## Falsifiers

This reframe fails or requires redesign if:

- candidate velocity choices oscillate rapidly despite hysteresis/continuity cost;
- the companion still behaves like a point follower with decorative extra vectors;
- local avoidance causes long-term route starvation or orbiting;
- player prediction makes the companion excessively timid;
- local scoring cannot be explained quickly through the workbench;
- performance cost becomes material even at one companion;
- the system needs scenario-specific doorway/pillar rules;
- debug complexity grows faster than causal clarity.

## Research grounding

Useful external reference classes, not implementation mandates:

- Dynamic Window Approach: choose admissible motion in velocity space under short-horizon constraints and objective scoring.
- ORCA/RVO: local collision avoidance expressed as permitted velocity regions relative to moving agents.
- Detour Crowd: explicit separation of path corridor, local neighbors, obstacle avoidance, separation and debug data.

The project should borrow the separation of concerns and inspectability, not prematurely import their full machinery.

## Current decision

**Do not implement naive S2-C1 waypoint following as the next milestone.**

Proceed with S3-A/S3-B toward an omnidirectional, inspectable spatial locomotion core, while preserving S2-C0 route reasoning as corridor guidance and the old RELATIONAL mode as an A/B baseline.
