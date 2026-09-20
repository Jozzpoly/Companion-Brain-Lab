# Authority-A1 — Parallel Teammate Loop Stage Plan

Status: **FRESH POST-A0 STAGE PLAN · FIRST NEW COORDINATION AUTHORITY · NO IMPLEMENTATION YET**

Parent architecture hypothesis:

`docs/COORDINATION_AUTHORITY_REPLAN.md`

Qualified prerequisite:

`docs/AUTHORITY_A0_EXECUTION_EVIDENCE.md`

Exact A0 runtime prerequisite:

`f006e3c4c60d3882482aad98b5807612da076a36` — validate #713 PASS

---

## 1. Stage question

Can we build the first **parallel, complete teammate movement loop** that uses the factual contracts extracted in A0 and behaves coherently enough to justify a deeper cooperation/continuity stress campaign — without mutating or hiding the existing comparison baselines?

A1 is the first stage allowed to grant new companion movement authority.

That authority must be isolated behind an explicit experimental path.

A1 is not a replacement of SPATIAL, a final companion architecture, or a polish stage.

The goal is to make one complete alternative loop mechanically real and aggressively falsifiable.

---

## 2. What A0 changes about A1

A1 must be designed around facts that were not available when the original CCC sequence was proposed.

### 2.1 Intention and body trajectory are different signals

A1 may not publish or consume one magical `playerDirection`.

Relationship orientation, physical prediction and cooperation may legitimately use different sources.

At minimum:

- relationship semantics can consume current Owner control when meaningful;
- physical collision prediction can consume body trajectory;
- cooperation can combine current control with recent body evidence;
- externally induced body motion must not silently become Owner intention.

### 2.2 Speed policy must be in world units

A1 may not build its new behavior around `S3_EXPERIMENT_MAX_SPEED = 3` or a hidden normalized speed scale.

Use `MovementCapability.maxSpeed` as physical capability truth.

PACE produces desired policy speed in world units.

Local candidate velocities are represented in world units.

A final adapter may still convert the selected velocity into existing `MotionIntent` for World submission.

### 2.3 Hard reachability and comfort are different facts

A1 must use hard-body feasibility for hard connectivity.

Comfort may shape utility, but it may not erase a physically reachable component and turn it into semantic `unreachable`.

### 2.4 Outcome improvement is not proof of self action

A1 may use `OutcomeAttributionEvidence` when deciding whether to keep, invalidate or reconsider a prior decision.

It may not credit externally caused displacement as proof that the chosen action succeeded.

### 2.5 Clock phase is now an explicit contract

Every cached product used by A1 must carry source tick / age.

Fast player control and final physical authority must not wait for an unlucky expensive-region cadence.

---

## 3. Hard stage boundary

A1 may:

- add a new experimental teammate-authority selector/path;
- create new A1-only evidence/objective/candidate types;
- reuse A0 factual contracts;
- reuse CCC-0 sampling/scoring ideas as donors;
- reuse current spatial sensing/candidate geometry as donors;
- reuse NATURAL temporal properties as donors;
- selectively recover the R1-5A physical player-agency guard concept;
- add new deterministic and browser test scenarios;
- add A1-specific causal/debug transport;
- use world-unit velocity internally;
- allow new behavior only while the explicit A1 path is selected.

A1 must not:

- replace or mutate MANUAL, CHASE, RELATIONAL or current SPATIAL behavior;
- change existing mode-cycle semantics merely to insert A1;
- promote the legacy eight-slot target into A1 semantic authority;
- directly chase CCC-0 `representativeAnchor` as the meaning of the relationship;
- use broad comfort spacing as a final hard player gate;
- claim exact causal force attribution;
- raise actor physical max speed to make PACE appear successful;
- add combat, command UI, LLM behavior or multiple companions;
- rewrite global navigation unless a bounded A1 falsifier proves it necessary;
- repin public Pages before A1 has its own mechanical qualification.

If a required A1 responsibility cannot be expressed without changing the existing comparison paths, stop and split the seam rather than accepting baseline drift.

---

## 4. Experimental isolation

Do **not** add `teammate-a1` to the current `COMPANION_MODES` cycle as the first implementation.

That would alter an existing user/browser control contract: current SPATIAL cycles back to MANUAL.

Preferred first isolation:

```text
base companion mode: existing SPATIAL
experimental authority path:
  BASELINE
  A1_DIRECT
  A1_TEMPORAL
```

The selector is orthogonal to existing mode cycling and only takes movement authority when explicitly enabled.

Alternative implementation shapes are allowed if they preserve the same property:

> existing mode selection and all baseline command streams remain unchanged unless A1 is explicitly selected.

Required baseline differential:

- all existing baseline modes preserve their prior command/outcome behavior;
- existing CCC-0 browser audit remains green;
- selecting/deselecting A1 resets only A1-owned temporal/history state.

---

## 5. A1 responsibility loop

Current-best A1 loop:

```text
A0 situated World/control truth
        |
        v
A1 relationship-orientation evidence
        |
        v
Useful Region Objective -----------+
        |                           |
        +--> PACE Directive         |
        |                           |
        +--> Player Cooperation ----+
                                    |
                                    v
                    World-unit Local Velocity Field
                                    |
                         +----------+----------+
                         |                     |
                     DIRECT               TEMPORAL
                         |                     |
                         +----------+----------+
                                    |
                                    v
                    Joint Final Physical Authority
                                    |
                                    v
                             MotionIntent adapter
                                    |
                                    v
                                  World
                                    |
                                    v
                         Outcome Attribution
                                    |
                                    v
                     Reconsideration / invalidation
```

This is a responsibility skeleton, not a frozen class graph.

---

## 6. Situated evidence consumption

A1 starts from A0 facts rather than rebuilding them inside the brain.

### 6.1 Relationship-orientation source

A1 relationship semantics should use a consumer-specific orientation signal.

Initial policy hypothesis:

1. meaningful same-step Owner control direction;
2. otherwise a short, explicitly aged recent Owner-directed semantic direction;
3. otherwise no directional preference.

Do **not** fall back automatically to externally disturbed actual body velocity for relationship meaning.

Requested/actual body velocity remain available for physical prediction and evidence.

The exact memory duration is not protected. It must be visible as age/provenance and falsified under stop/reversal tests.

### 6.2 Physical player trajectory

For short-horizon physical prediction, A1 may use:

- same-step requested player velocity implied by Owner control/capability when control is active;
- actual body trajectory as evidence of current physical motion;
- requested-vs-actual divergence/contact provenance;
- a bounded horizon appropriate to the consumer.

Do not extend this trajectory blindly through static geometry.

### 6.3 No universal direction

Any A1 evidence named `direction` or `velocity` must state its semantic role/source.

Examples:

- relationship orientation;
- owner requested velocity;
- current physical velocity;
- cooperation prediction velocity.

---

## 7. Useful Region Objective v1

A1 WHERE is a **set-valued objective**.

Primary meaning:

> coherent hard-reachable player-relative states that are sufficiently useful for the current companion relationship.

### 7.1 Donor material

CCC-0 provides useful donor ideas:

- radial/angular player-relative sampling;
- local hard validity;
- route-aware qualification;
- score decomposition;
- connected/coherent near-best region;
- region continuity evidence;
- topology/component identity.

### 7.2 Explicitly rejected donor assumptions

Do not inherit unchanged:

- `actual → requested → previous` relationship heading;
- current fixed 32×3 sampling as an invariant;
- current radii/weights;
- current comfort-coupled route truth;
- `representativeAnchor` as semantic authority.

### 7.3 A1 region output

Minimum useful evidence should contain:

- source tick / age;
- player position;
- relationship-orientation source/provenance;
- hard-valid samples/states;
- hard-route reachability/component information;
- utility terms;
- coherent useful-set membership;
- whether desired comfort is available;
- optional representative/debug anchor explicitly marked as adapter evidence.

### 7.4 Local planner interface

The local velocity field should score **predicted candidate positions against region utility directly** where practical.

Avoid:

```text
region -> representative target -> point chase -> velocity
```

Prefer:

```text
candidate predicted position -> utility relative to useful region
```

A route/gateway point can still guide topology traversal without becoming relationship meaning.

### 7.5 Region freshness

Initial cadence hypothesis:

- expensive region/topology recomputation around 10 Hz;
- immediate invalidation on material relationship-orientation change, hard-region loss or other proven invalidator.

This is a performance hypothesis, not a semantic clock.

Every use of cached region evidence must expose `sourceTick` and `ageTicks`.

---

## 8. PACE Directive v1

PACE is strategic desired motion magnitude, not physical capability.

### 8.1 Required inputs

At minimum:

- companion capability max speed;
- player capability / current requested motion;
- current separation from useful region;
- whether companion is inside useful region;
- opening/closing trend;
- hard route distance/component when relevant;
- player-cooperation suppression/yield evidence;
- prior outcome attribution where it invalidates apparent progress.

### 8.2 Required output

Provisional output:

```text
sourceTick
preferredSpeed
minimumUsefulSpeed? / maximumUsefulSpeed?
urgency
feasibility state
reason / decomposed evidence
```

All speeds are world units and capability bounded.

### 8.3 Full-speed truth

A1 must remove the accidental structural `0.70 × maxSpeed` ceiling from the new path.

If the player is sustaining physical max speed and the companion can maintain a valid relationship only by also traveling near max speed, PACE must be able to request that.

If the companion is already behind while player and companion have equal max speed, A1 must **not pretend catch-up is physically possible**.

Represent the structural deficit honestly, e.g. as a feasibility/urgency condition, and track as well as capability allows until player/world conditions permit recovery.

Do not solve this by raising max speed.

### 8.4 Settling / overshoot

PACE must be able to lower preferred speed as the useful region is approached or entered.

Catch-up pressure must disappear when no longer justified.

The first implementation should prefer continuous terms over a large mode FSM.

---

## 9. Player Cooperation v1

Cooperation is part of normal A1 policy from the first authoritative step.

It is asymmetric and player-prioritizing by default, but not a universal future rule for all gameplay contexts.

### 9.1 Minimum semantics

A1 cooperation must represent at least:

- clear/no meaningful conflict;
- likely player-flow interference;
- acute physical conflict;
- temporary yielding preference;
- release when conflict/intent changes.

Names are provisional.

### 9.2 Inputs

Use consumer-specific evidence:

- same-step Owner control/requested velocity;
- current body position/actual velocity;
- provenance/contact divergence;
- static geometry;
- companion candidate velocity;
- body radii;
- bounded prediction horizon.

### 9.3 Geometry-aware prediction

Do not reserve a long corridor through walls.

At minimum, clip/shorten player-flow prediction against static geometry or otherwise bound cooperation reasoning to physically plausible near-term space.

### 9.4 Hard vs soft cooperation

Normal likely-flow intrusion is primarily a policy cost/preference.

Hard rejection is reserved for near-term physical player-agency violation or other explicit physical illegality.

A broad comfort envelope must not become the final hard gate.

### 9.5 Minimal continuity state

Do not introduce a large hidden yield FSM preemptively.

If flicker requires continuity, use a small explicit episode with observable:

- reason;
- start/source tick;
- current conflict evidence;
- release condition.

If stable cooperation requires arbitrary long timers without causal meaning, treat that as an A1 representation FAIL.

---

## 10. World-unit Local Velocity Field v1

A1 should create a new contract rather than mutating `SpatialLocomotionInput`.

The current spatial implementation is a donor, not authority architecture.

### 10.1 Why the existing contract cannot be promoted directly

Current spatial donor still assumes:

- one `relationshipTarget: Vec2`;
- `actual → requested` player velocity fallback;
- hard-coded `S3_EXPERIMENT_MAX_SPEED = 3`;
- fixed `[0.35, 0.7, 1]` speed fractions;
- desired static clearance inside hard local rejection.

A1 must not preserve those assumptions accidentally.

### 10.2 Candidate representation

Each A1 candidate should be in world units and expose enough evidence to explain selection:

```text
velocity
predicted position
source tick / age
hard static legality
hard player physical legality
hard-route/topology compatibility
region utility
PACE mismatch
player-cooperation cost
static comfort cost
continuity / temporal cost or metadata
aggregate semantic utility
```

Exact field names are provisional.

### 10.3 Hard static legality

Hard local rejection uses physical body feasibility / egress semantics.

Desired extra clearance is soft policy evidence, not hard-body truth.

### 10.4 Speed candidates

Do not freeze `[0.35,0.7,1]`.

Candidate speed generation should be driven by world-unit facts such as:

- zero;
- PACE preferred speed;
- nearby speeds around the preferred value when useful;
- current speed / braking-relevant values;
- capability max speed when PACE justifies it.

The first implementation can remain discrete if evidence is good enough, but discretization must remain visible and falsifiable.

### 10.5 Region scoring

Score candidate predicted positions against the useful set/component, not primarily distance to one representative point.

A candidate already inside a useful region should be able to receive low correction pressure even if far from a debug anchor.

---

## 11. DIRECT and TEMPORAL A/B inside A1

A1 keeps two actuation variants of the **same coordination semantics**.

### 11.1 A1_DIRECT

Select the semantic best admissible candidate directly.

Purpose:

- control condition;
- expose region/PACE/cooperation quality without temporal smoothing confounders.

### 11.2 A1_TEMPORAL

Preferred first family:

> temporal realization creates a velocity preference, but final selection stays inside the current admissible candidate field.

One plausible implementation:

1. semantic field identifies best/near-best candidate family;
2. a capability-aware temporal donor computes a smooth preferred velocity toward the semantic best;
3. choose the admissible candidate nearest that temporal preference while bounding semantic regret;
4. do not emit an arbitrary smoothed velocity outside the admissible field.

This uses the good property of current NATURAL continuity without making post-smoothing revalidation a hidden second steering system.

### 11.3 Capability correction

Current `MotionContinuityConfig.maxSpeed = 3` is a donor default, not A1 truth.

Any temporal donor used by A1 receives max speed from A0 `MovementCapability`.

### 11.4 Temporal state reset/invalidation

Reset or materially reconsider A1 temporal state when evidence proves semantic discontinuity, e.g.:

- A1 path toggled;
- scenario reset;
- selected region becomes invalid;
- acute physical conflict forces a materially different command;
- outcome attribution shows strong external disturbance where retaining prior acceleration would be misleading.

Do not reset on every ordinary region sample revision.

---

## 12. Joint Final Physical Authority v1

A1 must protect both static physical legality and player physical agency after temporal selection.

### 12.1 Desired composition

Prefer one final decision over a candidate/fallback family that can answer simultaneously:

- next-step static hard-safe?
- egress-compatible?
- next-step player physical-agency-safe?
- which safe candidate is closest to the desired semantic/temporal command?

### 12.2 R1-5A donor

Recover conceptually useful R1-5A findings:

- next-physics-step horizon;
- body radii;
- tiny numerical margin only;
- explicit egress semantics;
- rare intervention;
- projection/fallback toward a safe useful command.

Do not recover broad comfort-as-hard-policy behavior that forensics already falsified.

### 12.3 Player prediction for final authority

Final player physical prediction should be consumer-specific and short-horizon.

Starting hypothesis:

- if same-step Owner control is meaningful, predict the requested player velocity from control × player capability;
- otherwise account for current actual body motion as physical trajectory evidence;
- remain conservative under mixed/external provenance;
- use only the next-step horizon so geometry/intent uncertainty does not explode.

### 12.4 Intervention as a health signal

Record:

- intervention count;
- source/reason;
- velocity delta magnitude;
- chosen fallback;
- whether static or player safety forced intervention.

Healthy open-field A1 should approach **zero final interventions**.

Frequent final correction is an upstream FAIL, not evidence that the guard is working well.

---

## 13. MotionIntent adapter

A1 internal authority ends in a selected world-unit velocity.

World may continue receiving existing `MotionIntent` during A1 through the qualified A0 adapter.

Before enabling A1 authority:

- selected velocity must be capability bounded;
- adapter actor id must match capability actor id;
- round-trip error remains bounded;
- post-World requested velocity must match the selected world-unit command to the existing World semantics.

This is the first place where A0's shadow `VelocityCommand` may become live plumbing **inside the isolated A1 path only**.

Do not rewrite baseline submission through it merely for symmetry.

---

## 14. Outcome Attribution and reconsideration

A1 should use A0 attribution to invalidate the correct layer rather than inventing one universal retry.

### 14.1 First reconsideration contract

Prefer explicit cache/state invalidation requests over a complex behavior FSM.

Provisional levels:

- `NONE`
- local velocity reselect;
- cooperation refresh;
- PACE refresh;
- region refresh;
- temporal-state reset.

Multiple invalidations may coexist.

Names are provisional.

### 14.2 Attribution semantics

Examples:

- `SELF_ACTION_SUPPORTED` → ordinary continuation is allowed;
- `SELF_ACTION_CONSTRAINED` → local/final/temporal reconsideration depending on cause;
- `EXTERNAL_DISPLACEMENT_EVIDENT` → do not count as proof selected action worked; refresh facts from new body location;
- `MIXED_OR_AMBIGUOUS` → avoid aggressive causal conclusions;
- `NO_MEANINGFUL_MOTION` → interpret using command/region context, not automatically as failure.

### 14.3 No generic retry budget in first A1

Do not transplant legacy `RETRY_LOCAL` counters as the new supervisor.

A1 should recompute from current truth and explicitly invalidate stale layers.

Persistent failure classes can be added only when evidence shows they are needed.

---

## 15. Multi-rate / freshness plan

A1 should not put every responsibility on one 10 Hz clock.

Initial implementation hypothesis:

| Layer | Initial cadence | Immediate invalidators |
| --- | --- | --- |
| World / A0 situated truth | every World step | always fresh |
| final physical authority | every command | always |
| temporal selection | every command | always |
| player cooperation scoring | every command or cheap near-equivalent | Owner reversal, acute conflict |
| dynamic candidate scoring | every command | cooperation/PACE/current position change |
| candidate geometry/static probes | ~30 Hz initially | selected candidate invalid, major position/topology change |
| PACE | 30–60 Hz initially | separation trend / capability / conflict change |
| useful region/topology | ~10 Hz initially | semantic orientation change, region hard invalidation, topology loss |

These cadences are experiments, not architecture constants.

### Important decomposition

Prefer separating expensive **candidate generation/static qualification** from cheap **dynamic rescoring** where that makes same-step cooperation possible without rebuilding all geometry every tick.

A1 must record source tick/age for every cached layer and permit a consumer to reject stale data.

---

## 16. A1 causal/debug contract

A1 needs one bounded incident that can explain:

```text
situated evidence
→ relationship orientation
→ useful region / hard topology
→ PACE
→ cooperation
→ candidate field
→ DIRECT/TEMPORAL choice
→ final physical authority
→ submitted velocity
→ World outcome
→ outcome attribution
→ invalidations/reconsideration
```

Do not dump every candidate every frame into the default incident if that makes evidence unusable.

Recommended split:

- selected candidate and decomposed terms every frame;
- top-N / rejected-reason summary every frame;
- full candidate field only on requested incident windows or material transitions.

Required provenance:

- source tick / age for region/PACE/cooperation/candidate field;
- Owner control and physical player velocity separately;
- capability used;
- final intervention reason/magnitude;
- attribution phase ticks.

If one bad moment cannot be explained from a bounded incident, A1 causal design FAILS.

---

## 17. Implementation work packages

The sequence below is a working order, not a frozen architecture roadmap.

### A1.0 — isolated authority shell

- add explicit A1 authority selector without changing existing mode cycle;
- route A1 through its own state/history object;
- establish baseline differential proving A1-disabled behavior remains exact;
- add A1 DIRECT/TEMPORAL selector but initially emit no new behavior until the loop is complete enough for a bounded gate.

### A1.1 — situated semantics + useful region v1

- consume A0 current control/body/capability truth;
- create relationship-orientation evidence that cannot treat external body motion as Owner intent;
- re-express CCC-0 region donor against that semantic input;
- use hard-route truth for hard connectivity;
- retain comfort separately;
- expose region utility directly rather than semantic anchor chasing.

### A1.2 — PACE + world-unit candidate field

- create capability-bounded PACE;
- remove structural 0.70 speed ceiling from A1;
- generate candidate velocities in world units;
- separate hard static legality from comfort;
- score candidate predicted positions against useful-region utility.

### A1.3 — minimal player cooperation

- add geometry-aware same-step player-flow policy;
- add asymmetric interference cost;
- keep physical collision as hard only where justified;
- qualify stop/reversal/cross-front and wall-occluded flow.

### A1.4 — DIRECT/TEMPORAL + final joint authority

- A1_DIRECT selects semantic best candidate;
- A1_TEMPORAL selects inside admissible field using capability-aware temporal preference;
- add final next-step static + player-agency verifier/fallback;
- record intervention health metrics.

### A1.5 — outcome-driven invalidation

- consume A0 outcome attribution;
- invalidate/recompute the appropriate layer;
- avoid generic retry-budget logic;
- prove external displacement does not become self-progress success.

### A1.6 — integrated deterministic + Chromium gate

- bounded scenarios and falsifiers below;
- downloadable A1 incident;
- comparison against existing SPATIAL DIRECT/NATURAL;
- no Owner feel claim yet.

After every material finding, re-evaluate later packages rather than completing them mechanically.

---

## 18. Required A1 deterministic falsifiers

### 18.1 Solver-push semantic isolation

Scenario:

- Owner control zero;
- companion contact forces player body motion.

Require:

- relationship orientation does not reinterpret the forced motion as Owner intent;
- physical prediction still sees body motion;
- no semantic region flip solely because the companion moved the player.

### 18.2 Full-speed tracking

Scenario:

- player sustains physical max speed;
- companion begins in or near a useful trailing relationship.

Require:

- A1 can request/execute near-capability speed when necessary;
- no accidental 70% cruise ceiling;
- when already structurally behind at equal max speed, evidence says deficit is not closable under current capability rather than faking catch-up;
- PACE settles when player slows / useful relationship becomes recoverable.

### 18.3 Capability perturbation

Repeat representative A1 movement with capability 3 and synthetic capability 5.

Require:

- candidate speeds scale from capability;
- temporal preference uses the same capability;
- final next-step proof uses the same capability;
- submitted World requested velocity matches selected command semantics.

### 18.4 Hard-only narrow passage

Require:

- hard relationship route remains reachable;
- comfort violation remains explicit;
- A1 does not enter false hard-unreachable recovery.

### 18.5 Occluded player flow

Player control/velocity points into or through static geometry.

Require:

- cooperation prediction is geometry-bounded;
- candidate field does not reserve a long phantom player corridor beyond the obstacle.

### 18.6 Cross-front cooperation

Player cuts across companion path.

Require:

- A1 normally yields/reselects upstream;
- no player contact in the healthy representative case;
- final physical guard intervention should be zero or exceptional, not continuous.

### 18.7 Stationary player in path

Require:

- stationary player remains physically real;
- companion does not infer a fabricated travel direction;
- A1 finds a useful hard-safe alternative or intentional hold.

### 18.8 Owner reversal / clock phase

Present identical immediate Owner reversal at each phase relative to cached region cadence.

Require:

- fast cooperation/final response differs by at most one World step due solely to region clock phase;
- no 0–5 tick unsafe/stale player-priority response;
- expensive region may remain cached only if its age/provenance is explicit and it remains semantically admissible.

### 18.9 Region representation boundary

Drive slow heading/speed changes across known CCC-0 representative discontinuities.

Require:

- a debug/adapter anchor jump does not directly create equivalent command teleport;
- candidate utility against the region remains explainable;
- if command discontinuity remains large, stop and redesign region/local coupling rather than tune anchor weights.

### 18.10 External companion displacement

Zero/near-zero companion command while player/world contact displaces companion toward useful region.

Require:

- attribution is external/mixed, not self-action-supported;
- A1 refreshes from new body truth without crediting the previous policy;
- no false success counter/retry reset based only on metric improvement.

---

## 19. DIRECT vs TEMPORAL gates

Compare both A1 variants under identical semantic inputs.

Representative probes:

- open straight follow;
- smooth 90° turn;
- 180° Owner reversal;
- pillar side transition;
- catch-up/deficit → settle transition;
- doorway egress.

TEMPORAL should show lower local command discontinuity than DIRECT without:

- increasing hard contact;
- materially worsening useful-region tracking;
- becoming visibly laggy under reversal;
- requiring frequent final guard correction.

Do not declare TEMPORAL better merely because velocity changes are smaller.

Responsiveness and spatial competence remain part of the gate.

---

## 20. Final physical-authority gates

### Healthy open field

Target expectation for the representative deterministic run:

- **zero player-physical final interventions**;
- static final intervention near zero unless a deliberate hard-boundary case is present.

### Acute unsafe command fixture

Require:

- unsafe next-step player command is corrected;
- corrected command remains static hard-safe;
- correction respects egress semantics;
- evidence identifies the exact intervention source.

### Health threshold

If ordinary A1 behavior repeatedly depends on final physical correction, stop and treat upstream region/PACE/cooperation/temporal composition as failed.

Do not tune the final guard into a second steering brain.

---

## 21. Browser qualification

A1 browser gate must use actual UI/input/runtime execution, not synthetic evaluator calls only.

Minimum run:

1. baseline SPATIAL remains usable;
2. explicitly enable A1_DIRECT;
3. ordinary movement / stop / resume;
4. sustained max-speed player movement;
5. cross-front movement;
6. Head-on / stationary obstruction;
7. Doorway same-direction and reversal interaction;
8. switch A1_DIRECT ↔ A1_TEMPORAL;
9. capture/download A1 incident;
10. parse the downloaded incident and validate provenance/selected-command/final-authority/outcome chain.

Timing/fault evidence:

- no page errors;
- no console errors;
- no failed requests;
- no gross >1 s stall;
- separately report frame timing rather than assuming observer work is free.

A1 browser PASS is mechanical/runtime evidence, not Owner feel PASS.

---

## 22. Baseline preservation gate

A1 cannot pass if adding the experimental path changes existing baselines while A1 is disabled.

Defend at least:

- MANUAL;
- CHASE;
- RELATIONAL;
- SPATIAL DIRECT;
- SPATIAL NATURAL;
- CCC-0 shadow cadence/evidence behavior;
- Foundation survival tests;
- existing CCC-0 browser audit.

Where deterministic, compare command/outcome sequences exactly.

---

## 23. A1 promotion gate

A1 is mechanically ready for the deeper A2 stress campaign only when all are true:

### Isolation

- explicit A1 path exists;
- baselines remain unchanged when A1 is off.

### Complete authority loop

- situated evidence → region → PACE → cooperation → velocity field → DIRECT/TEMPORAL → final authority → World → attribution → invalidation is executable and inspectable.

### Provenance

- solver-induced player motion cannot become Owner-directed relationship intent in qualified cases;
- source tick / age are visible for cached layers.

### Capability

- no hidden `3` is needed by A1 semantic/temporal/final speed reasoning;
- synthetic non-default capability qualification passes.

### Region

- A1 local policy consumes useful-region utility rather than semantically chasing one anchor;
- hard/comfort narrow-passage falsifier passes.

### PACE

- no structural 70% speed ceiling;
- equal-capability uncatchable deficit is represented honestly;
- settle behavior is bounded and does not oscillate materially.

### Cooperation

- same-step player changes influence fast cooperation without waiting for region cadence;
- occluded-flow and cross-front falsifiers pass.

### Temporal/final

- A1_TEMPORAL improves continuity without becoming materially less responsive/competent;
- normal open-field final player-guard intervention is zero in the representative run;
- acute unsafe fixture is corrected.

### Attribution

- externally caused companion displacement is not self-action-supported;
- invalidation uses attribution without inventing force certainty.

### Causal/browser

- one bounded incident explains a bad/interesting moment end-to-end;
- deterministic suite and real Chromium gate pass.

A1 PASS does **not** mean final teammate behavior.

It means the first new authority loop is coherent enough to deserve a dedicated adversarial A2 cooperation/continuity campaign.

---

## 24. Stop / redesign triggers

Stop A1 instead of weight tuning when any of these occurs:

1. A1 only works by turning a representative region anchor back into the semantic target.
2. Externally induced player motion still changes relationship meaning as if it were Owner intent.
3. Hard-feasible space is still lost because comfort is embedded in hard local/router rejection.
4. Full-speed following only works by increasing actor capability or inserting hidden speed multipliers.
5. Cooperation requires broad hard comfort envelopes to avoid the player.
6. Temporal realization routinely exits the semantically admissible set and needs a second steering layer to repair it.
7. Final player guard intervenes frequently in ordinary open-space following.
8. A1 response to Owner reversal materially depends on the phase of a 10 Hz region clock.
9. Outcome attribution must be ignored to keep recovery stable.
10. A1-disabled baseline sequences change.
11. Browser incident cannot explain why the final command was chosen.
12. Performance cost becomes dominated by repeatedly rebuilding geometry that could be separated from dynamic rescoring.

Any of these is evidence for responsibility/representation redesign before more tuning.

---

## 25. Explicit non-goals

A1 does not need:

- combat;
- weapon positioning;
- command menus;
- multiple companions;
- formations;
- LLM calls;
- learned prediction;
- ORCA/RVO middleware;
- animation polish;
- final map/navigation architecture;
- final data model;
- final public API;
- perfect Owner feel.

The whole stage is still about one embodied companion learning to move **with** one player rather than merely toward a point near them.

---

## 26. First implementation decision

The next implementation step, if/when A1 begins, should be **A1.0 isolated authority shell + baseline differential**, followed by the smallest factual `A1Situation` adapter over A0 evidence.

Do not begin by tuning region weights, PACE constants or cooperation penalties.

First make the alternate authority boundary real, provably isolated and causally inspectable.

Then implement region/PACE/cooperation against that seam and re-plan each material substage from evidence.

---

## 27. Current-best A1 thesis

The first useful teammate authority should not be:

> choose a better target point and move toward it more smoothly.

It should be:

> continuously choose a physically admissible world velocity that keeps the companion in useful relationship space, at a capability-honest pace, while respecting current player agency; realize that choice with bounded temporal continuity; then use actual World outcome and causal attribution to decide what needs reconsideration.

A1 exists to test whether that thesis survives implementation.
