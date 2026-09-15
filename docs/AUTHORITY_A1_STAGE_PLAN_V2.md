# Authority-A1 — Parallel Teammate Loop Stage Plan v2

Status: **CANONICAL POST-A0 A1 PLAN · CRITICAL REVIEW CORRECTED · NO A1 RUNTIME IMPLEMENTATION YET**

Supersedes for implementation purposes:

- `docs/AUTHORITY_A1_STAGE_PLAN.md` — retained as the first post-A0 draft / research history.

Prerequisites:

- `docs/COORDINATION_AUTHORITY_REPLAN.md`
- `docs/AUTHORITY_A0_EXECUTION_EVIDENCE.md`
- exact qualified A0 runtime `f006e3c4c60d3882482aad98b5807612da076a36`
- validate #713 PASS

This document incorporates the critical review performed after the first A1 draft and before any A1 authority code was allowed to exist.

---

## 1. Stage question

Can we build the first **parallel, complete teammate movement loop** that uses A0 factual contracts to choose useful world-unit companion velocity while preserving player agency, capability truth, causal explainability and all existing comparison baselines?

A1 is the first stage allowed to grant new companion movement authority.

The authority is experimental, isolated and removable.

A1 is not:

- a replacement for current SPATIAL;
- a final companion architecture;
- a polish stage;
- a claim that CCC-0 shadow policy is already correct;
- permission to mutate Foundation baselines until the experiment proves its case.

A1 succeeds only if a **complete new loop** becomes mechanically coherent enough to deserve a deeper adversarial A2 campaign.

---

## 2. Three critical corrections discovered before implementation

The first A1 draft contained three assumptions that could have produced a convincing but fundamentally wrong prototype. They are corrected here before runtime work begins.

### 2.1 Decision-time truth must exist before the companion command

A0 live aggregate evidence is produced at the `LabWorld.step()` boundary:

```text
before snapshot @ t
+ submitted player/companion intents @ t
→ World
→ outcome @ t+1
→ AuthorityA0WorldStepEvidence
```

Therefore `latestAuthorityA0StepEvidence()` available before the next step is **previous-step outcome evidence**, not current same-step player control.

A1 must never read it and pretend it is current decision input.

A1 requires a decision-phase factual adapter, provisionally named:

```text
A1Situation
```

constructed **before companion command selection** from:

- current `before: WorldSnapshot` at tick `t`;
- freshly created current player `MotionIntent` / Owner control for tick `t`;
- player and companion `MovementCapability` from World truth;
- previous A0 post-World outcome/attribution only if it ends exactly at tick `t`;
- explicitly aged A1-owned semantic history where required.

Required temporal invariant:

```text
A1Situation.tick == before.tick == t
currentPlayerControl.sourceTick == t
priorOutcome?.outcomeTick == t
priorOutcome?.observationTick == t - 1
```

A consumer must not receive an A0 aggregate whose `outcomeTick > A1Situation.tick`.

A real same-step Owner reversal must therefore be visible to A1 fast layers **on the decision that immediately follows that input**, not one World step later.

### 2.2 Useful relationship space must move with the player

A region represented only as current world-space points is not enough for velocity selection.

If player and companion both have max speed 3 u/s and the local planner scores companion@`t+h` against where the useful region was at `t`, the companion systematically chases stale space and can lag even when equal-speed maintenance should be possible.

A1 useful-region meaning is therefore primarily **player-relative state**:

- relative direction / orientation;
- radial relationship range;
- utility;
- coherent component / topology role;
- semantic provenance.

World-space points are projections used for:

- static feasibility;
- route/topology qualification;
- debug visualization;
- bounded routing adapters.

Local candidate evaluation uses a **common prediction horizon**:

```text
predicted companion position @ t+h
relative to
predicted player reference frame @ t+h
```

and scores that **predicted relative state** against useful-region utility.

This creates feed-forward relationship maintenance instead of point-chasing lag.

The player and companion prediction used by one candidate evaluation must state the same horizon and temporal provenance.

### 2.3 Final player protection must respect both intention and physical reality

A final one-step player-agency guard cannot safely choose exactly one trajectory hypothesis whenever requested and actual player motion materially diverge.

Initial A1 hypothesis:

- build an Owner-requested next-step player trajectory from same-step control × player capability when meaningful;
- build an actual/inertial next-step physical trajectory from current body motion when meaningful;
- when they materially disagree, evaluate candidate safety against **both relevant one-step hypotheses**;
- use conservative minimum physical clearance / union of unsafe cases;
- retain only one-physics-step horizon;
- do not convert this into a long predicted comfort corridor.

This protects both:

- current Owner agency / intended motion;
- current physical body reality under contact, inertia or external disturbance.

The final guard still uses physical radii plus only a tiny numerical margin, not broad comfort spacing.

---

## 3. Hard stage boundary

A1 may:

- add an isolated experimental A1 authority selector;
- introduce `A1Situation` and A1-owned factual/semantic evidence;
- introduce player-relative useful-region state;
- create capability-bounded PACE in world units;
- create a new world-unit local velocity field;
- add minimal asymmetric player cooperation from the first authoritative build;
- create A1_DIRECT and A1_TEMPORAL variants of the same semantics;
- selectively recover R1-5A one-step player physical protection;
- use A0 `VelocityCommand` adapter live **inside A1 only**;
- consume A0 outcome attribution for targeted invalidation;
- add deterministic/browser evidence and downloadable A1 incidents.

A1 must not:

- alter MANUAL, CHASE, RELATIONAL or current SPATIAL command semantics;
- alter existing `COMPANION_MODES` cycle merely to expose A1;
- promote legacy eight-slot target authority inside A1;
- treat CCC-0 `representativeAnchor` as relationship meaning;
- use a stale world-space region as the future target of local velocity selection;
- reconstruct current Owner input from prior requested/actual velocity;
- use hard-coded `S3_EXPERIMENT_MAX_SPEED` as A1 capability truth;
- use fixed `[0.35, 0.7, 1]` speed fractions as policy architecture;
- use desired comfort clearance as hard-body reachability truth;
- use broad player comfort as final hard authority;
- increase actor physical max speed to fake successful catch-up;
- add combat, command menus, LLM behavior or multiple companions;
- repin public Pages before independent A1 qualification.

---

## 4. Experimental isolation

Do not add `teammate-a1` to the current mode cycle initially.

Preferred selector:

```text
base mode: existing SPATIAL
experimental authority:
  BASELINE
  A1_DIRECT
  A1_TEMPORAL
```

It is orthogonal to existing mode cycling.

When selector = `BASELINE`, existing command and World outcome sequences must remain exact where deterministic.

Switching A1 on/off may reset only A1-owned history/temporal state.

A1 must be deletable without changing the baseline behavior path.

---

## 5. Corrected A1 loop

```text
current before World snapshot @ t
+ current Owner/player intent @ t
+ MovementCapability truth
+ previous post-World A0 outcome ending @ t
        |
        v
A1Situation @ t
        |
        +--> relationship-orientation evidence
        +--> physical player trajectory hypotheses
        +--> freshness / prior attribution
        |
        v
Player-relative Useful Region Objective
        |
        +--> hard world-space projection / topology
        +--> PACE Directive
        +--> Player Cooperation
        |
        v
World-unit Local Velocity Field
(candidate companion@t+h vs player-frame@t+h)
        |
        +-------------------+
        |                   |
     DIRECT              TEMPORAL
        |                   |
        +---------+---------+
                  |
                  v
Joint Final Physical Authority
(static hard truth + dual player one-step hypotheses)
                  |
                  v
VelocityCommand -> MotionIntent adapter
                  |
                  v
World @ t -> t+1
                  |
                  v
A0 Outcome Attribution
                  |
                  v
A1 targeted invalidation / history update
```

Truth/provenance brackets the full loop. No layer may silently change semantic meaning because its local implementation has a convenient field named `velocity` or `target`.

---

## 6. `A1Situation` — the first implementation seam

A1.0 must build and qualify this seam before any new behavior policy receives authority.

Provisional content:

```text
tick
before World snapshot
current player control MotionIntent
player MovementCapability
companion MovementCapability
prior A0 outcome ending at this tick? 
recent A1 semantic orientation history?
```

Derived factual convenience values may include:

- current requested player velocity = control.move × player maxSpeed;
- current player body actual/requested velocities from `before` snapshot;
- player contacts/motion error;
- companion body state;
- previous outcome attribution state and reason.

### 6.1 Alignment gates

Tests must reject/flag:

- current player control whose source tick differs from situation tick;
- prior outcome whose `outcomeTick != situation.tick`;
- future evidence;
- actor/capability id mismatch;
- scenario mismatch.

### 6.2 Same-step reversal gate

Create the player input first, construct `A1Situation`, then ask A1 for companion command.

A reversal entered at tick `t` must appear in A1Situation at `t` before the companion command for tick `t` is selected.

Do not use the browser/UI to prove this first; write a deterministic decision-boundary contract test, then verify real keyboard input later.

---

## 7. Consumer-specific player meaning

A1 does not publish one canonical `playerDirection`.

### 7.1 Relationship orientation

Initial semantic source order:

1. meaningful same-step Owner control direction;
2. otherwise recent, explicitly aged **Owner-directed semantic** direction;
3. otherwise no directional preference.

Externally induced actual body motion must not become relationship orientation merely because it is large.

### 7.2 Requested motion hypothesis

When Owner control is meaningful:

```text
requestedPlayerVelocity = currentControl.move × playerCapability.maxSpeed
```

This is intention-aware physical prediction evidence, not body outcome.

### 7.3 Actual physical hypothesis

Current actual body velocity remains available for collision/physical reasoning, especially under:

- residual motion;
- contact;
- constrained Owner input;
- externally induced motion.

### 7.4 Semantic memory

If relationship direction memory is needed, store:

- direction;
- original source;
- source tick;
- age ticks;
- strength/confidence.

Do not let external/mixed body motion refresh an Owner-directed semantic memory.

---

## 8. Useful Region Objective v2 — relative first, world projection second

Primary meaning:

> coherent hard-reachable **player-relative states** that are useful enough for the current relationship.

A useful state should be representable independently of the player’s absolute world position.

Example conceptual state:

```text
relative angle / orientation class
relative radius
utility terms
hard-feasible projection state
component/topology identity
comfort evidence
```

Exact representation remains experimental.

### 8.1 CCC-0 donor material

Useful donors:

- radial/angular sampling;
- hard local validity;
- route-aware qualification;
- decomposed utility;
- coherent near-best region;
- connected-component lesson;
- continuity/topology evidence.

Do not inherit unchanged:

- actual→requested→previous semantic heading;
- current 32×3 grid as invariant;
- current radii/weights;
- comfort-coupled hard route truth;
- representative anchor as semantic authority.

### 8.2 World projection

For each relative state/sample, world projection at an observation tick can be used to ask:

- does the companion body fit there?
- is the state hard reachable?
- what topology/component/gateway applies?
- what comfort quality exists?

This projection is factual support, not the permanent meaning of the relationship state.

### 8.3 Moving-frame prediction

For local candidate horizon `h`:

```text
playerFuture = predictPlayerReferenceFrame(A1Situation, h)
companionFuture = companion.position + candidateVelocity * h
relativeFuture = companionFuture - playerFuture.position
```

Score `relativeFuture` against useful-region semantics in the **future player frame**.

If orientation itself changes during the horizon, initial A1 may hold the current semantic orientation for the short horizon, but must state that approximation. Do not silently mix orientation timestamps.

### 8.4 Shared horizon

Candidate-region utility, player cooperation prediction and relevant local collision evidence should expose their prediction horizon.

Avoid scoring one candidate simultaneously against player@0.55s, region@0s and collision@1.2s without explicit reason.

A1 may use different horizons for different responsibilities only when evidence names them and composition remains meaningful.

### 8.5 Representative anchor

Allowed uses:

- debug display;
- bounded route API adapter;
- component/gateway visualization.

Forbidden semantic shortcut:

```text
anchor moved 0.8m -> therefore command should chase the new anchor
```

---

## 9. PACE v2 — capability honest and moving-frame aware

PACE answers how much speed is useful, not how much speed exists.

Required inputs:

- companion capability max speed;
- player capability and same-step requested motion;
- relative useful-region error in the moving frame;
- relative opening/closing trend;
- hard-route/topology feasibility;
- cooperation suppression/yield evidence;
- relevant prior outcome attribution.

Provisional output:

```text
sourceTick
preferredSpeed [u/s]
optional useful speed range
urgency
feasibility state
reason / decomposition
```

### 9.1 Equal-speed maintenance

If player and companion are both moving 3 u/s and companion already occupies a good relative trailing state, A1 should be able to choose ~3 u/s feed-forward motion and **maintain** the relationship.

It must not interpret this as perpetual catch-up toward a region that remains one horizon behind.

### 9.2 Equal-speed deficit honesty

If companion begins materially behind while player sustains the same max speed:

- PACE may request max capability;
- evidence must say the deficit is not closable while player maintains equal max speed;
- do not invent hidden >maxSpeed reserve;
- recovery can become possible when player slows, path shortens or geometry changes.

### 9.3 Settle

When future-relative state enters useful region and relative opening pressure disappears, preferred speed should converge toward maintenance/settling rather than oscillate between catch-up and braking.

---

## 10. Player Cooperation v2

Cooperation is normal policy from A1’s first authoritative build.

### 10.1 Normal policy

Represent at least:

- clear;
- likely interference;
- acute physical conflict;
- temporary yield preference;
- released conflict.

Likely-flow intrusion is mostly a soft/asymmetric policy cost.

### 10.2 Geometry-aware Owner-requested trajectory

Same-step requested player motion should be clipped/bounded by near-term static feasibility before producing a cooperation reservation.

Do not reserve a phantom corridor through a wall simply because the player currently holds a key toward it.

### 10.3 Actual body trajectory

Actual motion remains relevant when body dynamics disagree with intent.

Cooperation may use both requested and actual hypotheses with provenance rather than selecting one magical replacement velocity.

### 10.4 Minimal continuity

Do not introduce a large hidden yield FSM.

If continuity is necessary, make an observable episode with:

- reason;
- start/source tick;
- evidence currently sustaining it;
- release condition.

Arbitrary long timers required solely to stop flicker are evidence against the representation.

---

## 11. World-unit Local Velocity Field v2

A1 creates a new contract. Do not mutate `SpatialLocomotionInput` until/if the new design proves that unification is useful.

Current SpatialLocomotion is donor code only because its current authority contract contains exactly the assumptions A1 is replacing:

- one point relationship target;
- actual→requested player fallback;
- hard-coded max speed 3;
- fixed speed fractions;
- comfort-inflated static radius as local hard rejection.

### 11.1 Candidate evidence

Each A1 candidate should expose at least:

```text
velocity [u/s]
predictionHorizon
predictedCompanionWorldPosition
predictedPlayerReference
predictedRelativeState
hard static legality
hard player physical legality
hard topology compatibility
useful-region utility
PACE mismatch
cooperation cost
comfort cost
temporal metadata / cost
aggregate semantic utility
```

### 11.2 Candidate speeds

Generate from current facts rather than fixed normalized fractions. Candidate family can include:

- 0;
- PACE preferred speed;
- a small bounded neighborhood around preferred speed;
- current speed / braking-relevant speed;
- max capability when PACE justifies it.

Discrete candidates are acceptable initially if discretization is visible and falsifiable.

### 11.3 Hard static legality

Use physical body radius / egress truth.

Desired extra static clearance is soft quality evidence.

A physically narrow but valid passage must remain in the admissible space even when comfort is poor.

### 11.4 Future-relative region utility

Do not score primarily:

```text
distance(candidateFuture, currentWorldAnchor)
```

Score candidate’s predicted relative state against the moving useful region.

This is a mandatory A1 property, not an optimization.

---

## 12. DIRECT vs TEMPORAL

Both variants consume the same semantics and admissible field.

### A1_DIRECT

Choose semantic best admissible candidate directly.

Purpose: control condition for region/PACE/cooperation quality.

### A1_TEMPORAL

Preferred family:

1. semantic field identifies best/near-best admissible candidates;
2. capability-aware temporal donor computes a smooth velocity preference;
3. choose an admissible candidate nearest temporal preference while bounding semantic regret;
4. never emit arbitrary smoothed motion outside the current admissible set.

Current NATURAL acceleration/braking/jerk behavior is donor evidence, not protected implementation.

All temporal speed limits come from `MovementCapability`, not its current default `maxSpeed: 3`.

Reset/invalidate temporal state on material semantic/physical discontinuity, not every ordinary region refresh.

---

## 13. Joint Final Physical Authority v2

Final authority operates every command and remains narrow.

It validates/falls back across candidate family for:

- physical static safety;
- hard egress semantics;
- player physical agency;
- closest useful result to the desired semantic/temporal command.

### 13.1 Dual player trajectory hypothesis

For next-step player physical safety construct relevant hypotheses:

**Owner-requested hypothesis**

```text
current same-step control × player capability
```

when meaningful.

**Actual-body hypothesis**

```text
current actual body velocity
```

when meaningful.

If requested and actual materially diverge, candidate is physically safe only if the next-step body separation is safe under **both relevant hypotheses**.

Use conservative minimum physical clearance.

### 13.2 One-step only

The final hard player guard horizon is exactly the next physics step for the initial experiment.

Do not turn requested/actual hypotheses into a long social corridor.

Longer-horizon cooperation remains upstream soft policy.

### 13.3 Geometry and static safety

Every final fallback must remain statically hard-safe under the same next-step command.

If implementation uses sequential static/player repair temporarily, it must revalidate both properties after every repair.

### 13.4 Health metric

Record intervention:

- source/reason;
- velocity delta;
- unsafe hypothesis: requested / actual / both;
- chosen fallback;
- static and player clearances.

Healthy open-field A1 representative run target: **zero player-final interventions**.

Repeated final intervention is upstream FAIL, not a successful safety strategy.

---

## 14. MotionIntent adapter

A1 internal output is a capability-bounded world-unit velocity.

Inside isolated A1 only:

```text
selected/final VelocityCommand
→ qualified A0 adapter
→ existing MotionIntent
→ World
```

Require:

- actor/capability identity match;
- finite capability-bounded velocity;
- bounded adapter reconstruction error;
- post-World requested velocity agrees with selected A1 command under current World semantics.

Baseline modes continue using their existing submission path.

---

## 15. Outcome attribution and targeted invalidation

After World, consume A0 attribution for the completed A1 command.

Do not use a generic retry budget as the first A1 supervisor.

Possible invalidations:

- local field reselect;
- cooperation refresh;
- PACE refresh;
- useful-region/topology refresh;
- temporal-state reset.

Interpret conservatively:

- `SELF_ACTION_SUPPORTED` → ordinary continuation allowed;
- `SELF_ACTION_CONSTRAINED` → invalidate responsible execution layers;
- `EXTERNAL_DISPLACEMENT_EVIDENT` → refresh from new body truth; never credit prior action;
- `MIXED_OR_AMBIGUOUS` → avoid precise causal blame;
- `NO_MEANINGFUL_MOTION` → combine with intended command/region context before calling failure.

---

## 16. Multi-rate and freshness

No semantic responsibility is allowed to inherit a clock merely because its donor used one.

Initial hypotheses:

| Layer | Cadence hypothesis | Must refresh immediately on |
| --- | --- | --- |
| `A1Situation` | every World decision | every current input/snapshot |
| final physical authority | every command | always |
| temporal selection | every command | always |
| fast cooperation rescoring | every command | Owner change / acute conflict |
| candidate dynamic rescoring | every command | current state / PACE / cooperation change |
| static candidate geometry | ~30 Hz | selected invalid / topology change |
| PACE | 30–60 Hz | relative trend / conflict / feasibility change |
| useful region/topology | ~10 Hz | semantic orientation change / hard invalidation |

Every cached product carries:

- `sourceTick`;
- `ageTicks`;
- relevant semantic provenance;
- reason for reuse if meaningful.

### 16.1 Region clock cannot delay player safety

An Owner reversal must affect:

- requested physical hypothesis;
- fast cooperation;
- final player safety

without waiting for useful-region recomputation.

The region may remain cached only if its semantic orientation remains admissible and its age is explicit.

---

## 17. A1 causal incident

One bounded incident must explain:

```text
A1Situation
→ relationship orientation
→ relative useful region / world hard projection
→ PACE
→ cooperation hypotheses
→ candidate field
→ DIRECT/TEMPORAL selection
→ final static/player authority
→ VelocityCommand / MotionIntent
→ World outcome
→ A0 attribution
→ invalidations/history update
```

Default per-frame evidence should contain:

- selected candidate;
- top-N candidate summary;
- rejection/source counts;
- source ticks/ages;
- requested and actual player physical hypotheses;
- final intervention reason/magnitude;
- attribution.

Full candidate fields should be captured only on requested incident windows or material transitions if normal traces become unreadable.

If one bad moment cannot be explained end-to-end from a bounded incident, A1 causal design fails.

---

## 18. Implementation packages

This sequence is deliberately bounded and can be replanned after each material finding.

### A1.0 — authority shell + decision-time factual seam

- create a new A1 implementation branch/PR;
- add orthogonal `BASELINE | A1_DIRECT | A1_TEMPORAL` selector without changing mode cycle;
- introduce `A1Situation` before companion command selection;
- enforce tick/scenario/capability alignment;
- prove same-step Owner reversal reaches situation immediately;
- initially keep A1 selector behavior-equivalent or authority-disabled until factual shell is qualified;
- run exact baseline differential.

### A1.1 — relative useful-region semantics

- create Owner-intent-safe relationship orientation;
- convert/rebuild region donor as player-relative states;
- use hard-route truth for hard world projections;
- keep comfort separate;
- expose moving-frame future projection helpers;
- do not grant authority through representative anchor.

### A1.2 — PACE + world-unit field

- add capability-bounded PACE;
- generate world-unit candidate speeds;
- score future companion relative state against future player reference;
- separate hard static legality from comfort;
- qualify equal-speed maintenance and equal-speed uncatchable deficit.

### A1.3 — player cooperation

- add same-step requested trajectory;
- add actual physical trajectory evidence;
- geometry-bound normal player-flow prediction;
- asymmetric interference cost;
- qualify occluded flow, stop, reversal and cross-front.

### A1.4 — DIRECT/TEMPORAL + final joint safety

- enable A1_DIRECT authority first only once loop is complete enough to be safe/diagnosable;
- add A1_TEMPORAL selection inside admissible field;
- add dual-hypothesis next-step player physical guard plus static safety;
- quantify intervention health.

### A1.5 — attribution-driven invalidation

- consume completed-step A0 attribution;
- refresh only responsible layers;
- prove external displacement never becomes self-progress evidence.

### A1.6 — integrated deterministic + Chromium qualification

- run full falsifier matrix;
- compare DIRECT/TEMPORAL/baselines;
- download+parse A1 incident;
- no Owner feel claim yet.

---

## 19. Required falsifiers

### 19.1 Decision-time same-step reversal

At tick `t` change player control from +X to -X immediately before companion selection.

Require:

- `A1Situation.playerControl.sourceTick == t`;
- relationship semantic input and fast cooperation see -X at `t`;
- no reliance on previous A0 aggregate for current control;
- final requested-trajectory guard sees -X at `t`.

### 19.2 Solver-push semantic isolation

Owner control zero; companion physically pushes player.

Require:

- actual body trajectory remains visible physically;
- relationship orientation does not become externally induced heading;
- requested hypothesis remains zero;
- final safety may still react to actual body motion.

### 19.3 Equal-speed moving-frame maintenance

Start companion in a valid trailing relative state. Player and companion capability both 3 u/s. Player sustains 3 u/s straight motion.

Require:

- A1 requests/executed speed near maintenance requirement;
- predicted future relative state remains useful;
- no systematic horizon-sized lag accumulates;
- debug anchor/world projection movement cannot be mistaken for catch-up error.

This is a mandatory moving-frame proof.

### 19.4 Equal-speed uncatchable deficit

Start companion materially behind while player sustains equal max speed.

Require:

- PACE can request max speed;
- evidence reports deficit not closable under current capability;
- no >capability command;
- no fake success until conditions change.

### 19.5 Capability 3 vs 5

Require planner, temporal donor, final swept proof and World requested velocity to use the same capability scale.

No hidden `3` in A1 authority reasoning.

### 19.6 Hard-only passage

Require hard route remains reachable while comfort remains poor/unavailable.

No false hard-unreachable recovery.

### 19.7 Occluded requested player flow

Player holds input through a nearby wall.

Require cooperation reservation clipped/bounded by geometry rather than extended through obstacle.

### 19.8 Cross-front

Require normal upstream yield/reselection with no representative player contact.

Final hard player guard should not be the normal steering mechanism.

### 19.9 Stationary player in path

No fabricated heading. Find hard-safe useful alternative or intentional hold.

### 19.10 Requested/actual divergence in final guard

Create a case where current Owner requested velocity and actual body velocity materially disagree.

Require:

- both one-step hypotheses are visible;
- a command unsafe under either relevant hypothesis is rejected/corrected;
- no long comfort corridor is introduced;
- fallback remains static hard-safe.

### 19.11 Region representation boundary

Slowly cross known CCC-0 anchor/component discontinuities.

Require semantic candidate utility/command not to teleport merely because debug representative changed.

### 19.12 External companion displacement

Near-zero companion command + external push toward useful region.

Require attribution external/mixed; refresh body truth but do not credit prior action.

### 19.13 Clock phase

Repeat equivalent Owner reversal across every phase of region cadence.

Fast cooperation/final response may differ by at most one World step solely because of cadence phase; region evidence may be older only with explicit valid provenance.

---

## 20. DIRECT vs TEMPORAL gates

Compare under identical semantic situation:

- straight moving-frame maintenance;
- smooth 90° turn;
- 180° reversal;
- pillar/topology transition;
- deficit → recoverable → settle;
- doorway egress.

TEMPORAL should reduce local command discontinuity without:

- increasing player/static contact;
- materially degrading useful-relative-state tracking;
- becoming sluggish under reversal;
- increasing final hard intervention materially.

Smaller velocity change alone is not a success criterion.

---

## 21. Final-guard health gates

Healthy open-field representative run:

- player final interventions: target **0**;
- static final intervention: near-zero absent deliberate boundary fixture.

Acute unsafe fixture:

- unsafe command corrected;
- both requested/actual player hypotheses accounted for when relevant;
- final command static hard-safe;
- intervention source explainable.

If ordinary behavior repeatedly depends on final correction, redesign upstream A1 logic.

---

## 22. Baseline preservation

A1 cannot pass if A1-disabled behavior changes.

Defend:

- MANUAL;
- CHASE;
- RELATIONAL;
- SPATIAL DIRECT;
- SPATIAL NATURAL;
- CCC-0 shadow cadence/evidence;
- Foundation survival;
- existing CCC-0 browser audit;
- A0 browser/contract tests where applicable.

Where deterministic, use exact command/outcome comparisons.

---

## 23. Browser qualification

Use actual runtime controls, not only synthetic evaluators.

Minimum integrated run:

1. prove baseline SPATIAL unchanged;
2. explicitly select A1_DIRECT;
3. ordinary movement / stop / resume;
4. sustained equal-speed maintenance;
5. immediate reversal;
6. cross-front interaction;
7. Head-on/stationary obstruction;
8. Doorway motion/reversal;
9. switch A1_DIRECT ↔ A1_TEMPORAL;
10. capture/download A1 incident;
11. parse incident and verify full causal chain.

Require:

- no page errors;
- no console errors;
- no failed requests;
- no >1s rendering stall;
- explicit timing report;
- real input provenance in incident.

Browser mechanical PASS is not Owner feel PASS.

---

## 24. A1 promotion gate to A2

A1 passes mechanically only when all are true:

- isolated selector exists and baseline paths remain exact when off;
- `A1Situation` proves true same-step decision input alignment;
- externally induced player motion cannot become relationship intention;
- useful relationship meaning is relative/player-frame first;
- equal-speed moving-frame maintenance works without point-chasing lag;
- uncatchable equal-speed deficit is represented honestly;
- no hidden max-speed 3 in A1 authority reasoning;
- hard/comfort passage remains semantically separated;
- fast cooperation responds independently of region cadence;
- occluded flow is geometry bounded;
- A1_DIRECT and A1_TEMPORAL share semantics;
- temporal selection stays inside admissible field;
- final player protection is rare and handles requested/actual divergence;
- external displacement is not credited as self success;
- one bounded incident explains final command and outcome end-to-end;
- deterministic and real Chromium gates pass.

A1 PASS means only:

> the first complete new teammate-authority loop is coherent enough to deserve a larger A2 falsification/stress campaign.

It does not mean final behavior or Owner approval.

---

## 25. Stop / redesign triggers

Stop instead of tuning when:

1. current A0 world-step aggregate is used as if it contained current same-step input;
2. candidate utility chases a stale current-world region instead of future relative state;
3. useful region collapses back into one semantic anchor;
4. externally induced player body motion changes relationship meaning as Owner intent;
5. hard-feasible space disappears because comfort is embedded in hard logic;
6. full-speed following requires hidden >capability speed;
7. cooperation needs broad hard comfort envelopes;
8. final player guard chooses only requested or only actual trajectory when the two materially diverge;
9. temporal realization needs a second steering system after leaving admissible space;
10. ordinary open following produces repeated final guard interventions;
11. Owner reversal response depends materially on 10 Hz region clock phase;
12. attribution must be ignored to keep behavior stable;
13. A1-disabled baseline sequences change;
14. causal incident cannot explain a bad final command;
15. performance is dominated by repeatedly rebuilding static geometry that could be cached and dynamically rescored.

---

## 26. First implementation decision

The next runtime work is **A1.0 only**.

Start a separate A1 implementation branch/PR from the reviewed planning checkpoint.

A1.0 should contain:

- isolated authority selector;
- A1-owned state reset boundary;
- decision-time `A1Situation` adapter;
- temporal alignment assertions/tests;
- baseline differential proving selector-off equivalence;
- causal evidence proving same-step input reaches A1 before companion command selection.

Do **not** implement region/PACE/cooperation weights in A1.0.

A1.0 exists to make the new authority boundary and factual timing seam real before policy complexity is added.

Only after A1.0 passes should A1.1 relative-region implementation begin.

---

## 27. Current-best thesis

The first useful teammate authority is not:

> choose a better point near the player and chase it smoothly.

It is:

> at the current decision tick, combine fresh Owner intent, current body truth, capability and prior causal outcome; reason about useful **future relative relationship state** in a moving player frame; choose a capability-honest admissible world velocity that cooperates with the player; preserve bounded bodily continuity; then protect both static feasibility and the player’s requested/actual next-step physical trajectories before World execution.

A1 exists to try to falsify that thesis with implementation evidence.
