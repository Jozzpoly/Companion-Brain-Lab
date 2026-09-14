# S4 Natural Motion Continuity — qualification state

Status: **MECHANICAL PASS / OWNER BROWSER FEEL GATE OPEN**

Qualified runtime SHA: `fb29fd9a76a01eaa03d08ba8b1455aef6a018db7`

Primary validation run: `34795485628`

## What S4 is testing

S3 established responsive omnidirectional local locomotion. Owner evidence then showed a different failure class: decisions were responsive, but motion still looked digital and vector-driven.

S4 therefore separates two responsibilities that S3 still partially conflated:

1. **preferred local velocity** — what the spatial brain wants now;
2. **motion realization** — how a body accelerates, brakes and turns toward that preference over time.

The cognitive/local-spatial layer remains allowed to change its preferred action immediately. A separate continuity actuator shapes that request without becoming a planner.

## Qualified architecture

`relationship target -> route corridor/lookahead -> coarse 360° velocity field -> local preferred-velocity refinement -> continuity actuator -> MotionIntent -> World/physics truth`

S4 preserves S3 DIRECT actuation as an A/B baseline. The NATURAL actuator can be toggled independently from companion brain mode.

## Natural motion actuator

Current experimental bounds:

- max speed: `3 m/s`;
- max acceleration: `13 m/s²`;
- max braking acceleration: `18 m/s²`;
- max jerk: `160 m/s³`;
- semantic regimes: `ACCELERATE / STEER / BRAKE / HOLD`.

These values are research defaults, not final feel constants.

The actuator consumes current actual velocity and the brain's preferred move, then emits a bounded commanded velocity every physics tick. It does not mutate World state directly.

## Adaptive preferred-velocity refinement

S3's broad spatial search remains deliberately coarse and inspectable: 24 headings over 360°.

S4 does **not** globally increase candidate count. Instead it locally refines only around the winning region:

- considers up to six nearby admissible high-scoring candidates;
- blends them by relative score;
- re-validates the blended short-horizon motion with the same whole-body static traversal contract;
- re-validates predicted player clearance;
- falls back to the coarse selected candidate if refinement violates either safety constraint.

This is an optimization and naturalness experiment, not a replacement for the broad spatial search.

## Automated evidence

Run `34795485628` on exact runtime SHA `fb29fd9a...`:

- strict TypeScript: **PASS**;
- 11/11 test files: **PASS**;
- **59/59 tests: PASS**;
- Vite production build: **PASS**;
- install audit: **0 vulnerabilities**.

The suite includes the previous S0/S1/S2/S3 contracts plus new S4 evidence.

### Motion-continuity contracts

- no instantaneous jump from rest to full preferred speed;
- near-full speed is still reached quickly enough for a responsive companion;
- 90° preference changes turn continuously instead of snapping velocity in one tick;
- reversal remains bounded but completes in useful time;
- braking settles to rest without residual drift.

### Physical competence preservation

Long World+physics trials remain required:

- **pillar: PASS** — reaches far-side target, retains substantial detour, no pillar contact, and frame-scale requested-velocity changes are bounded;
- **doorway: PASS** — traverses the opening, no doorway-wall contact, requested-velocity changes remain bounded.

This matters because a smoother controller that lost S3 competence would not qualify.

### Refinement contracts

- non-axis-aligned preferred motion can be refined between coarse headings;
- a refined motion that would fail whole-body static traversal is never accepted;
- refinement remains deterministic for identical evidence.

## Debug/workbench is a peer system

S4 intentionally expands observability at the same time as movement quality.

The new S4 workbench exposes the causal chain:

`coarse preferred -> refined preferred -> commanded/requested -> actual`

It also exposes:

- continuity regime;
- preferred, commanded and actual speeds;
- acceleration;
- jerk;
- response error;
- refinement source;
- angular refinement delta;
- refinement contributors;
- route state and spatial decision state;
- short rolling player/companion trails;
- full requested/actual velocity vectors in incident trace samples.

QoL controls added for movement analysis:

- `N`: DIRECT / NATURAL actuator A/B;
- `T`: simulation speed `0.25x / 0.5x / 1x / 2x`;
- `L`: trajectory trails;
- existing `P` pause, `O` single-step, `B` debug presets and `I` incident capture remain.

## What is proven

S4 currently proves that the project can add bounded temporal motion continuity and local directional refinement **without losing the S3 pillar/doorway competence in automated trials**.

It also proves that the relevant stages of movement are now independently observable in the research workbench.

## What is NOT proven

S4 does not yet prove that movement feels natural to the Owner.

Open questions include:

- whether current acceleration/braking/jerk envelopes feel appropriately alive rather than floaty;
- whether local refinement reduces visible directional quantization enough;
- whether continuity introduces objectionable lag during rapid player reversals;
- whether discrete S1 relationship slots are now the dominant visible source of snapping;
- whether actor contact itself is too rigid for desired cooperation feel;
- whether future combat locomotion requires facing/orientation-aware movement constraints.

## Next architectural pressure

If Owner browser evidence confirms that S4 improves motion quality while retaining responsiveness, the next high-value reframe should target the **relationship objective**, not add more smoothing.

Current S1 still chooses one of eight discrete point slots around the player. The leading next hypothesis is a continuous relationship field/region whose utility varies over space and can be sampled/debugged independently of local locomotion.

That hypothesis must preserve the eight-slot system as an A/B baseline and should initially be evaluated as a causal field, not immediately accepted as authority.

## Gate

Do not merge S4 as accepted movement quality solely from automated evidence.

**Current state: MECHANICAL PASS / OWNER BROWSER FEEL GATE OPEN.**
