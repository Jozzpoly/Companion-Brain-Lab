# Authority-A1.2 — Relational rollout research

Status: **PRE-A1.2 RESEARCH · WORKING HYPOTHESIS · NO MOVEMENT AUTHORITY**

Date: 2026-09-15

This document is not a frozen architecture or implementation roadmap. It records the current strongest post-A1.1 hypothesis, the reasons for it, and the falsifiers that must attack it before any A1 movement authority is promoted.

## 1. Problem reframe

The legacy stack thinks primarily in a point/path pipeline:

`relationship target -> route -> preferred motion -> temporal realization`.

That pipeline can work for static goals but has already demonstrated an important teammate failure: when the player and companion have similar maximum speed, chasing a world-space point generated from a previous player state can lose an already-correct relative relationship simply because the target itself keeps moving.

A1.1 now provides a different semantic primitive:

> a pure utility over player-relative state, independent of absolute World position and independent of the observation mesh used to inspect it.

The next question should therefore not be "which sampled relationship point becomes the new target?"

The stronger question is:

> **which physically reachable short companion motion produces the best joint future relative state while respecting player agency, World feasibility and temporal embodiment?**

## 2. Minimal mathematical model

Let:

- `p(t)` be a player future hypothesis;
- `c_j(t)` be companion trajectory candidate `j`;
- `r_j(t) = c_j(t) - p(t)` be the predicted player-relative state.

For a simple constant-velocity local model over horizon `h`:

`r' = r + (v_companion - v_player) * h`.

This equation is useful but is **not a planner**. It becomes meaningful only when `v_companion` comes from an actually reachable control/trajectory set and when the candidate motion is checked against World/body constraints.

The direct A1 relationship evaluator can score the predicted `r'` without snapping to a sampled relationship point.

This naturally produces several behaviors without naming them as modes:

- if the current relationship is good and the player is moving, `v_companion ~= v_player` tends to preserve it;
- if separation error is growing, a faster/differently directed reachable candidate can improve the future relationship — the effect historically called catch-up;
- if a lateral objective is active, a candidate that changes relative bearing can become preferable without a special flank state machine;
- if the player is stationary and the relationship is already good, low/zero companion velocity can remain optimal.

These are desired emergent consequences, not yet demonstrated runtime behavior.

## 3. Candidate architecture: evaluate reachable short futures, not target points

Working flow:

`decision-time evidence`

-> current semantic objective

-> small explicit set of player-future hypotheses

-> physically reachable companion control/trajectory candidates

-> short joint rollout in player-relative frame

-> hard World/body admissibility

-> player-agency/cooperation admissibility

-> relational utility + route/topology progress + temporal continuity

-> preferred candidate evidence

-> later temporal/direct realization A/B

-> narrow final physical safety authority

-> World outcome attribution and prediction error

This is conceptually related to velocity-space local planning / short-horizon predictive control, but the project should not prematurely import a generic robotics controller or solver.

## 4. Do not collapse the decision into weight soup

A monolithic expression such as

`score = a*relationship + b*route + c*comfort + d*smoothness + ...`

would make causal interpretation weak and allow one large term to buy its way through something that should have been inadmissible.

The stronger working model is a **constraint ladder**, with utility optimization only inside the surviving set.

Provisional ordering:

1. **kinodynamic admissibility** — candidate is actually reachable from current companion motion/capability;
2. **static/body hard admissibility** — rollout does not require moving through hard World geometry;
3. **joint physical safety** — player/companion future does not contain unacceptable body overlap;
4. **player agency / asymmetric cooperation** — companion should yield rather than expect reciprocal player avoidance when those objectives conflict;
5. **robust relational usefulness** — candidate improves or preserves objective-space utility across relevant player hypotheses;
6. **route/topology progress** — candidate makes useful progress when direct relational improvement is locally blocked;
7. **temporal continuity / effort** — among otherwise useful candidates, prefer physically natural changes rather than oscillatory control.

The exact distinction between hard constraints, lexicographic preferences and bounded costs is deliberately unresolved. Experiments should determine it.

## 5. Player future is a hypothesis set, not one magic velocity vector

The project has unusually strong evidence compared with a real robot:

- same-step Owner input;
- current requested body velocity;
- actual body response;
- contacts and motion-error provenance;
- the immediately preceding World outcome;
- static World geometry.

Those sources answer different questions and must remain separate.

A small deterministic hypothesis set is currently more attractive than either one guessed trajectory or ML prediction.

Possible initial hypotheses:

### Owner-request continuation

Short continuation of current same-step Owner request, clipped by known physical World feasibility.

Purpose: represent player agency and immediate intention.

### Body-response continuation

Short continuation of actual/body motion when it materially differs from Owner request because of contact, constraint or external motion.

Purpose: acute physical safety and realistic near-future occupancy, not semantic facing.

### Brake / stop branch

A bounded short stop/deceleration possibility when Owner input has just changed, reversed or disappeared.

Purpose: avoid overcommitting to a single continuation during transitions.

These hypotheses should carry explicit provenance and confidence. They must not be averaged into a centroid trajectory that can pass through geometry or erase multimodality.

## 6. Player motion hypotheses must be physically admissible

Existing CCC-0 forensics already demonstrate that a purely kinematic player corridor can predict motion through a solid pillar and therefore report a physically impossible conflict on the far side.

A1 must not promote that failure.

At minimum, future player hypotheses should be hard-traversal-clipped or otherwise constrained by static World geometry over their short horizon.

This creates a useful separation:

- Owner request says what the player is trying to do;
- body response says what the player is currently doing;
- physically admissible future says where the player could plausibly occupy shortly.

## 7. Companion candidate set should be reachable, not arbitrary velocity samples

The simple relative-state equation is dangerous if `v_companion` may jump anywhere in the speed disk instantaneously.

The candidate set should be generated from current motion and the companion's real movement capability.

Potential controls include:

- bounded acceleration/deceleration;
- bounded change of velocity direction over the horizon;
- braking candidates;
- maintain-current-motion candidate;
- player-feed-forward-like candidates;
- a small spatially distributed set of alternatives.

The existing Natural motion-continuity donor may supply useful measured acceleration/jerk semantics, but its current constants are not automatically A1 invariants.

A Dynamic-Window-like reachable set is conceptually useful: evaluate only motion that can actually be reached over the short horizon.

## 8. Routing/topology remains necessary, but changes role

Velocity-space/local rollout does not solve long detours or local minima.

A pillar can make a relationally excellent terminal state unreachable by the short trajectory. A doorway can require temporary movement that makes the relationship utility worse before it becomes better.

Therefore global/static navigation knowledge still matters, but it should not automatically become semantic point authority.

Potential role:

> route/topology supplies a **progress potential, corridor/gateway guidance or admissible directional bias** to local rollout evaluation.

It can answer "which local motions advance toward an accessible useful fragment?" without redefining the relationship objective as a single waypoint.

The exact representation is open. Current A1 sampled accessibility fragments are evidence, not yet topology authority.

## 9. Player cooperation should be upstream; physical agency protection remains downstream

The historical R1-5A result remains valuable:

- broad comfort constraints used as final hard authority destroyed progress;
- a very narrow physical player guard could repair final unsafe commands.

This suggests two distinct layers:

### Upstream cooperation

Reason about likely joint near-future occupancy, right-of-way, yielding and lane/blocking cost while candidate futures are still being selected.

This is where comfort and asymmetric player priority belong.

### Downstream physical guard

At the final command boundary, prevent an acute body-overlap command if upstream reasoning or temporal realization produced an unsafe result.

This should remain a rare safety authority, not the mechanism that teaches the companion how to cooperate.

## 10. Uncertainty should change robustness, not fabricate intelligence

A candidate that is excellent under exactly one brittle player continuation and bad under every nearby alternative should not necessarily win.

Early deterministic experiments can evaluate candidates over the explicit hypothesis set using, for example:

- worst-case acceptable utility floor;
- expected utility with provenance-derived confidence;
- regret relative to the best candidate in each hypothesis;
- number/fraction of plausible futures in which the candidate remains admissible/useful.

Do not choose the final risk aggregation rule before falsification.

## 11. Decision certificates as first-class evidence

Every selected or rejected rollout should be explainable without reading raw solver internals.

A future candidate evidence record should be able to answer:

- which control/trajectory was considered;
- whether it was kinematically reachable;
- where it failed hard feasibility, if anywhere;
- which player hypotheses it conflicted with;
- its minimum/expected relational utility over the horizon;
- whether route guidance considered it useful progress;
- how much control discontinuity it introduced;
- why it lost or won against the selected candidate.

A selected command should therefore carry a compact **decision certificate**, not just a score.

This directly supports the project's Owner goal: understand the cause of companion behavior rather than stare at opaque debug numbers.

## 12. Red-team scenarios that must attack the model

Before authority, pure/shadow experiments should cover at least:

### Equal-speed preservation

Start in a good relative state. Player and companion have equal capability. Sustained player motion should permit a candidate that preserves relationship utility without lag-chasing.

### Sudden Owner reversal

Same-step semantic orientation changes immediately. Candidate selection must not chase stale heading or stale heavy accessibility evidence.

### Stop after full-speed motion

The companion should not blindly copy the previous player velocity through the new relationship state.

### Pillar occlusion

A kinematically attractive relative future behind a hard obstacle must not be treated as locally realizable.

### Doorway contention

Both actors want the same constrained passage. Companion should have mechanisms to yield / avoid blocking rather than rely on reciprocal player cooperation.

### Narrow hard-only passage

Comfort infeasibility must not erase a physically feasible route. Upstream comfort can influence behavior; it cannot redefine hard reachability.

### External push / collision response

Actual player body velocity may disagree strongly with Owner intent. Semantic objective remains Owner-derived while acute occupancy/safety respects actual motion.

### Long detour / local minimum

Short-horizon relational utility may prefer standing near a blocked side of an obstacle forever. Route/topology guidance must supply progress without turning a route point into semantic meaning.

### Partial/stale heavy evidence

Local selection must know whether accessibility/topology evidence is current, stale or incomplete. Old heavy evidence must not masquerade as current truth.

### Impossible acceleration

A mathematically excellent terminal relative state that requires an instantaneous velocity jump must be absent from the candidate set.

### Objective switch

Changing from follow-like to lateral/regroup semantics must change the objective contract cleanly without being misdiagnosed as World accessibility churn.

## 13. What not to import prematurely

### ORCA / reciprocal avoidance

Useful conceptual donor: collision constraints in velocity space.

Poor direct assumption for the player relationship: reciprocity. The human player should not be expected to share half the avoidance burden with the companion.

### Full nonlinear MPC solver

Useful conceptual donor: short predictive rollout under dynamics and constraints.

Not justified yet as middleware. Our 2D sandbox can first test a small deterministic candidate set with explicit evidence and far better debuggability.

### Human-motion ML prediction

Not needed initially. The game provides Owner input and exact World state that real robots do not have.

### Social-force models

Potential later donor for crowds, not required for one player + one/few trusted companions.

## 14. Provisional bounded experiments

These are research slices, not a frozen roadmap.

### A1.2a — pure moving-frame transition evaluator

No World authority. Given current relative state, player future hypothesis and candidate companion velocity/control, predict future relative state and evaluate direct objective utility.

Falsify equal-speed preservation, catch-up emergence, stop/reversal behavior and objective switching.

### A1.2b — reachable companion candidate set

Generate a small deterministic set bounded by real capability and explicit acceleration/deceleration assumptions. Prove no impossible instantaneous velocity jumps enter evaluation.

### A1.2c — physically admissible player hypothesis set

Construct explicit Owner/body/brake hypotheses with provenance; clip or invalidate them against hard World geometry.

### A1.2d — local World and route-progress coupling

Reject locally hard-invalid companion trajectories and experiment with route/topology progress potential for blocked objectives.

### A1.2e — joint robust selector + decision certificates

Evaluate surviving candidates across player hypotheses with explicit constraint outcomes and causal winner/loser evidence.

### A1.2f — complete shadow teammate loop

Run the full candidate pipeline beside legacy authority. Compare predicted/selected A1 control with actual legacy movement and World outcomes while preserving exact baseline commands.

Only after this loop is falsified, measured and browser-legible should a first bounded authoritative A1 experiment be considered.

## 15. Current north-star interpretation

The desired companion is not a follower that continuously computes where to stand.

It should increasingly behave like a teammate that understands a useful relationship to the player, anticipates a short shared future, chooses a physically plausible action that preserves or improves that relationship, yields when player agency deserves priority, and can explain why that action was preferable.

The objective-space substrate from A1.1 and a short-horizon relational rollout layer appear compatible with that goal.

They remain hypotheses until the falsifiers above survive evidence.