# Coordination Authority Re-plan

Status: **PLANNING ONLY · POST-FORENSICS FRESH REPLAN · NO NEW MOVEMENT AUTHORITY**

Clean planning base:

`experiment/ccc-0-shadow-coordination` @ `4318d895f1e83ba921faf1c7f4bd7cefea1c46f2`

Forensics evidence source:

`audit/companion-behavior-forensics` checkpoint @ `345c85172b5cf8b65f656a21b8a627554f089feb`

Primary evidence checkpoint:

`docs/BEHAVIOR_FORENSICS_CHECKPOINT.md` on PR #19

This document deliberately replans the first post-CCC-0 authority work **from current evidence rather than inheriting the old CCC-1 → CCC-2 → CCC-3 sequence**.

It is not a final architecture. It defines the current-best responsibility model, the prerequisites for granting any new behavior authority, the first bounded authority experiment, and the falsifiers that should force another redesign.

---

## 1. Executive verdict

Several ideas from the original CCC skeleton survived contact with evidence:

- useful player-relative space should remain **region-first**, not one legacy point target;
- PACE should be explicit and distinct from physical capability;
- player cooperation should be asymmetric and usually player-prioritizing;
- local spatial reasoning and temporal embodiment are separate valuable responsibilities;
- downstream hard physical authority should remain distinct from upstream cooperation;
- World outcome must remain factual authority.

However, the original stage ordering is no longer defensible.

The old sequence roughly assumed:

1. promote WHERE + PACE under simple/DIRECT realization;
2. add PLAYER COOPERATION later;
3. then integrate temporal realization and final player-agency authority.

Forensics falsified the safety of that decomposition as an implementation order.

Before any new coordination policy receives movement authority, four missing contracts now have to become explicit:

1. **player-state provenance** — owner control intent must not be confused with solver/body motion;
2. **movement capability** — planner, PACE, actuator, final proof and World must reason from compatible speed semantics;
3. **hard feasibility vs comfort** — hard reachable space must not disappear because a desired comfort envelope is blocked;
4. **outcome attribution** — progress/recovery must know whether an outcome was plausibly self-caused, externally caused, downstream-constrained or ambiguous.

The first authority experiment should therefore be a **parallel complete teammate loop**, isolated behind an explicit experimental mode, rather than a mutation of the legacy SPATIAL path.

It should include minimal WHERE + PACE + PLAYER COOPERATION + temporal/final safety composition from the start, while preserving DIRECT and current NATURAL as A/B donors.

---

## 2. What evidence changed the old plan

### 2.1 Player motion is not player intention

Confirmed exact and browser-level counterexample:

- owner input = zero;
- player requested velocity = zero;
- companion contact induces player actual velocity ~1.5 u/s;
- legacy relationship consumes that solver-induced velocity as player heading;
- relationship slot changes;
- semantic objective shifts by ~2.05 units.

Therefore a future coordination layer may not use one generic `actual → requested → previous` fallback chain for every meaning.

A player-relative relationship needs to know whether it is looking at:

- **same-step owner control intent**;
- **requested body motion**;
- **actual body trajectory**;
- **contact/world-forced deviation**;
- **uncertain or stale inferred direction**.

The consumer must choose the signal deliberately and expose the choice in evidence.

### 2.2 Speed is not one end-to-end contract today

Current code contains multiple incompatible assumptions:

- `ActorSpec.speed` lives in the World/scenario layer;
- `ActorSnapshot` does not expose that capability;
- `MotionIntent` carries only a normalized-ish `move: Vec2`;
- the workbench converts `move` back into velocity through hard-coded `S3_EXPERIMENT_MAX_SPEED`;
- NATURAL has its own `maxSpeed` config;
- final static safety proofs depend on the brain-side speed assumption;
- World finally scales by the actor's physical speed.

Forensics produced an exact 3-vs-5 u/s mismatch in both realized velocity and final swept safety distance.

Therefore **PACE authority cannot be promoted safely before capability semantics are explicit**.

### 2.3 Local recovery is not general reconsideration

`RETRY_LOCAL` does not repair the observed full-speed relationship deficit because the policy continues requesting ~2.1 u/s against a 3 u/s player.

Recovery also currently interprets externally caused body displacement as `PROGRESSING` when the target metric improves.

Therefore the next system must distinguish failure classes instead of treating local reset as a generic escape hatch.

### 2.4 A representative point is not safe as canonical relationship meaning

CCC-0 demonstrated the value of coherent reachable regions, but also showed discrete representation changes under smooth inputs.

Observed one-observation anchor changes include:

- ~0.211 m for a 0.001 m/s speed perturbation in one sequential case;
- ~0.815 m during heading-memory fade.

This is far better than historical legacy jumps, but still proves that **smooth scalar inputs do not guarantee smooth representative anchors**.

Therefore the first new local authority should consume **region utility directly where practical**, rather than turning the region immediately into one semantic point and then chasing that point.

A route/anchor point may remain an adapter for topology or debugging, not the meaning of the relationship.

### 2.5 PLAYER COOPERATION cannot be postponed until after WHERE/PACE authority

Once the new policy can move the companion, it can physically interfere with the player.

The forensics campaign also showed:

- player-flow extrapolation can reserve phantom space through geometry;
- solver-induced player motion can feed back into semantic intent;
- downstream temporal realization can differ materially from upstream preferred motion.

Therefore the first authority loop needs at least a **minimal, explicit cooperation contract** plus a rare downstream player-agency guard.

A broad comfort corridor still must not become a hard final gate.

### 2.6 DIRECT is useful as a control, not a future default assumption

The old plan proposed evaluating WHERE+PACE under DIRECT first to remove temporal confounders.

That remains useful as an A/B methodology, but forensics independently demonstrated that NATURAL-like temporal realization contributes a real desirable property:

- independent trajectory comes from spatial reasoning;
- reduced local turn/velocity discontinuity comes from temporal realization.

Therefore the first authority prototype should support **DIRECT and TEMPORAL variants in parallel**.

Do not erase temporal embodiment just to make the experiment easier to interpret.

### 2.7 One shared 10 Hz cognition clock is too crude as a future authority model

CCC-0's 6-tick cadence was justified for expensive shadow computation.

Forensics then demonstrated 0–5 tick phase-dependent legacy relationship observation delay and showed why current owner input and acute player conflict can be materially faster signals than region/topology reconsideration.

Future authority should therefore use **explicit freshness budgets and event-triggered invalidation**, not merely put every cognition responsibility on one timer.

---

## 3. Revised responsibility model

The current-best architecture hypothesis is no longer a simple linear `WHERE → PACE → cooperation → motion` stack.

It is better represented as:

`current control + World truth + provenance`

→ **Situated Evidence Frame**

→ **Coordination Objective**

- useful relationship region / role-space
- explicit PACE directive
- player-cooperation constraints/preferences

→ **Admissible Local Velocity Field**

→ **Temporal Command Selection / Realization**

→ **Final Joint Physical Authority**

→ **World**

→ **Outcome Attribution**

→ **Failure-class Reconsideration / Coordination Feedback**

→ back into the next Situated / Coordination decision.

The important change is that **truth/provenance and causal attribution now bracket the entire behavior loop**.

---

## 4. Situated Evidence Frame

This should become the smallest factual input package from which coordination reasoning is allowed to infer meaning.

It should not be a giant blackboard.

### 4.1 Player evidence

At minimum:

- current tick;
- current same-step owner control vector;
- player position/radius;
- player physical movement capability;
- prior World-requested velocity;
- prior/current actual velocity;
- motion error;
- contacts;
- short recent control history;
- short recent body-trajectory history;
- explicit evidence of requested-vs-actual divergence.

### 4.2 Provenance vocabulary

Do not overclaim exact force decomposition before World exposes it.

A conservative first provenance model can distinguish:

- `OWNER_DIRECTED` — meaningful same-step control exists and body motion is broadly compatible;
- `OWNER_BLOCKED_OR_CONSTRAINED` — owner control exists but body response is materially suppressed/deflected;
- `EXTERNAL_MOTION_EVIDENT` — owner control is absent/weak while material actual motion/contact exists;
- `MIXED_OR_UNCERTAIN` — both self and external contribution are plausible;
- `STATIONARY`.

Raw evidence must remain available beside the classification.

### 4.3 Consumer-specific direction

Do not publish one magical `playerDirection` field.

Different consumers need different meaning:

- relationship orientation may prefer current owner intent;
- short-horizon cooperation may combine current intent with body trajectory and geometry;
- physical collision prediction needs actual body state;
- animation/readability may care about recent body trajectory.

Every derived direction should report its source and source tick.

---

## 5. Explicit Movement Capability contract

The first useful contract should stay small.

### 5.1 Physical capability

At minimum:

- `maxSpeed` in world units;
- body radius;
- fixed simulation step.

This capability must come from the same authoritative actor definition that World uses.

Do not duplicate `3` as a brain constant.

### 5.2 Temporal actuation limits

Separately expose controller limits such as:

- maximum acceleration;
- maximum braking acceleration;
- maximum jerk / turn-shaping constraints.

These are actuator semantics, not the same thing as physical World max speed.

### 5.3 Policy pace is not capability

Keep distinct:

- physical max speed;
- ordinary preferred follow pace;
- temporary catch-up allowance;
- current desired speed / envelope;
- final executable velocity after constraints.

This distinction is a core post-forensics invariant.

---

## 6. Internal velocity contract

Future coordination should reason in **world velocity units**, not primarily in normalized `MotionIntent.move`.

Provisional internal shape:

- desired/preferred velocity in u/s;
- source tick;
- capability used;
- semantic source/reason;
- optional admissible envelope/candidate provenance.

During the first experiments, existing World can remain unchanged through a final adapter:

`velocityCommand / authoritative maxSpeed → MotionIntent.move`

with explicit clamping and evidence.

This lets the brain stop depending on hidden speed scaling without destabilizing Foundation immediately.

If this adapter cannot preserve exact existing commands in the zero-authority contract stage, stop and fix the contract before adding behavior.

---

## 7. Coordination Objective

The future relationship decision should be a structured objective, not one target point.

### 7.1 WHERE — useful region

Primary meaning:

> a coherent set of reachable player-relative states that are useful enough for the companion's current relationship/role.

Initial donor:

- current CCC-0 coherent region machinery.

Not protected:

- 32×3 sampling;
- radii;
- utility constants;
- shortlist size;
- representative anchor algorithm;
- current topology key.

### 7.2 Local planning should score the region directly

The first authority experiment should avoid this lossy chain where possible:

`region → representative semantic target → local planner → velocity`.

Prefer:

`region / region utility → predicted candidate position utility`.

Route/topological adapters may still provide:

- reachable component identity;
- gateway/lookahead guidance;
- route cost;
- bounded fallback anchor for router APIs.

But a representative anchor must not silently become canonical semantic truth.

### 7.3 PACE — strategic speed authority

PACE should answer:

- how urgently the relationship needs correction;
- what speed range is useful now;
- whether ordinary following is enough;
- whether temporary catch-up reserve is justified;
- whether approaching/overshoot risk requires slowing;
- whether yield/conflict should suppress forward pace.

PACE output should be continuous evidence, not necessarily an FSM mode.

Possible first output:

- `preferredSpeed`;
- `minimumUsefulSpeed` / `maximumUsefulSpeed` when meaningful;
- `urgency`;
- reason/decomposition.

All values must be bounded by the explicit capability contract.

### 7.4 PLAYER COOPERATION — asymmetric normal policy

Normal cooperation should shape the velocity field before any emergency guard.

First authority semantics should include only what current evidence justifies:

- current same-step owner-directed flow when available;
- short body-trajectory evidence when trustworthy;
- asymmetric cost for obstructing/crossing likely player motion;
- stronger player priority in constrained/chokepoint situations;
- explicit release when player intent changes or conflict clears;
- geometry-aware shortening/clipping/reasoning so flow does not project blindly through walls.

Do not freeze universal `player always wins` semantics for all future combat/interaction cases.

---

## 8. Admissible Local Velocity Field

This is the key composition seam between semantics and embodiment.

The current spatial sampler is a strong donor because it already reasons over direction + speed candidates and separates hard rejection from soft scoring.

The future interface should expose a **family of candidate velocities in world units**, each with evidence:

- predicted position;
- hard static legality;
- hard player-physical legality where relevant;
- hard egress status;
- relationship-region utility;
- pace error;
- route/topology guidance;
- player-cooperation cost;
- comfort cost;
- continuity cost or metadata;
- total utility/ranking.

### 8.1 Hard vs soft

Hard reasons should stay narrow:

- physical static illegality;
- impossible egress / true hard overlap constraints;
- explicit next-step player physical-agency violation when final authority requires it.

Soft/normal policy includes:

- comfort spacing;
- likely player corridor intrusion;
- route deviation;
- region utility;
- pace mismatch;
- unnecessary motion;
- temporal discontinuity.

### 8.2 Hard connectivity must not be erased by comfort

Route authority needs explicit hard-feasible connectivity.

Comfort can rank or discourage routes, but a narrow hard-feasible passage should not become semantically `unreachable` merely because desired clearance is impossible.

Represent separately:

- hard route reachable/unreachable;
- desired comfort route available/unavailable;
- transient comfort intrusion;
- comfort-violating endpoint;
- comfort egress.

---

## 9. Temporal realization

The responsibility is now strongly supported; the current implementation is not protected.

### 9.1 Desired property

Preserve:

- acceleration/braking continuity;
- bounded local turn change;
- short meaningful bodily commitment;
- reduced frame-scale command snapping.

Do not preserve:

- policy drift that invalidates upstream cooperation;
- stale state that survives semantic changes without meaning;
- hidden speed constants;
- smoothing that forces emergency guards to steer constantly.

### 9.2 Two implementation families worth A/B testing

#### Family A — select within an admissible velocity field

The local layer exposes multiple hard-valid candidates.

Temporal state/preferences choose the candidate nearest to a smooth continuation while respecting current semantic utility.

Benefit:

- temporal realization cannot silently leave the admissible set.

Risk:

- discrete candidate representation may still create quantization artifacts.

#### Family B — shape a preferred velocity, then revalidate

Use NATURAL-like continuous shaping, then validate the shaped result against current hard/cooperation constraints and choose a bounded fallback if necessary.

Benefit:

- preserves current smooth continuous actuator donor.

Risk:

- repeated revalidation/fallback can become a hidden second steering system.

The first authority experiment should compare these families or, at minimum, retain DIRECT as a control beside the temporal candidate.

---

## 10. Final physical authority

Upstream cooperation is not enough to protect player agency under all downstream/physics conditions.

The recovered R1-5A result remains a strong donor:

- next-step physical horizon;
- body radii plus tiny numerical margin;
- explicit egress semantics;
- rare intervention;
- avoid using broad comfort policy as a final hard envelope.

### 10.1 Composition question

The old `static gate → player guard` sequence risks one repair invalidating the other.

The fresh experiment should prefer a **joint final feasibility decision** over the final candidate/fallback family where possible:

- static hard-safe;
- player physical-agency-safe;
- egress-compatible;
- closest useful command to the temporally preferred one.

If sequential guards remain simpler initially, explicitly revalidate both properties after every repair.

### 10.2 Health signal

A high final-guard intervention rate is not success.

It indicates failure upstream in:

- cooperation;
- temporal realization;
- local candidate generation;
- or capability semantics.

Intervention frequency/magnitude must be first-class evidence.

---

## 11. World outcome attribution

World remains factual authority, but the brain needs a conservative interpretation of **why** an outcome happened.

Do not pretend exact force attribution exists when it does not.

A first `OutcomeAttributionEvidence` can use:

- submitted command;
- requested velocity;
- actual velocity;
- actual displacement;
- motion error;
- contacts;
- final-guard intervention;
- target/region metric change.

Useful conservative classes:

- `SELF_ACTION_SUPPORTED`;
- `SELF_ACTION_CONSTRAINED`;
- `EXTERNAL_DISPLACEMENT_EVIDENT`;
- `MIXED_OR_AMBIGUOUS`;
- `NO_MEANINGFUL_MOTION`.

The raw measurements remain authoritative; the class is an inference.

### 11.1 Progress must not equal metric improvement alone

Do not credit the companion with successful progress when:

- command is effectively zero;
- body is moved materially by player/world contact;
- the target metric happens to improve.

That can still be useful environmental change, but it is not evidence that the selected action worked.

---

## 12. Reconsideration / recovery by failure class

The current generic local retry remains a donor for true local transient state failures, not a universal supervisor.

Future outcomes should be able to ask for different levels of reconsideration:

- **continue** — action is working;
- **local reselect** — local candidate/temporal state was bad;
- **cooperation reconsideration** — player conflict/yield state changed;
- **PACE reconsideration** — structural inability to maintain relationship;
- **region/objective reconsideration** — current useful region became invalid/unreachable;
- **report hard unreachable** — no hard-feasible relationship state/route exists;
- **wait intentional conflict** — temporary player priority state.

Do not hard-code these as final enum names yet; the responsibility split is what matters.

---

## 13. Multi-rate cognition with explicit freshness

Do not make one cadence a hidden semantic boundary.

Current starting hypotheses:

| Responsibility | Initial cadence hypothesis | Immediate refresh triggers |
| --- | --- | --- |
| World / body truth | 60 Hz | every physics step |
| owner control evidence | 60 Hz | every input step |
| final hard authority | 60 Hz | every command |
| temporal realization | 60 Hz | every command |
| player cooperation | 30–60 Hz cheap path | control reversal, acute conflict, topology invalidation |
| local velocity field | 30–60 Hz initially | invalid selected velocity, region/cooperation change |
| PACE | 20–60 Hz | separation trend change, catch-up threshold, conflict state change |
| region/topology | ~10 Hz expensive path | region invalidation, hard route loss, major player intent change |

These are test hypotheses, not architecture constants.

Every cached product used by another layer should expose:

- `sourceTick`;
- `ageTicks`;
- relevant provenance/confidence;
- reason it was reused rather than recomputed.

A consumer should be able to reject stale evidence instead of silently accepting whatever the clock phase produced.

---

## 14. Revised experimental sequence

The old fixed `CCC-1 → CCC-2 → CCC-3` sequence is retired as the default implementation plan.

Use evidence gates instead.

### Authority-A0 — contract extraction, still zero behavior authority

Purpose:

> make the factual seams required by future authority explicit while mechanically preserving current movement.

Candidate work:

1. expose authoritative actor `maxSpeed`/capability to brain-side decision code;
2. add same-step player control evidence to a `SituatedEvidenceFrame`;
3. keep requested velocity, actual velocity, contacts and motion error distinct;
4. add conservative player-motion provenance evidence;
5. introduce an internal world-unit `VelocityCommand` + adapter to existing `MotionIntent`;
6. make final safety calculations consume the same capability/velocity contract;
7. add conservative post-World outcome attribution evidence;
8. split hard route reachability evidence from comfort desirability where current interfaces conflate them;
9. extend causal trace only as needed to prove the contracts.

A0 must produce **zero intended behavior change**.

It is not another open-ended forensic campaign. It is structural extraction of already-proven missing contracts.

#### A0 gate

- existing clean SPATIAL DIRECT/NATURAL command sequences remain exact where deterministic;
- World outcomes remain exact;
- capability value used by brain and World is demonstrably the same source;
- same-step owner input is available without pretending it equals body trajectory;
- solver-induced player motion is explicitly distinguishable from zero owner input;
- external zero-command body motion does not become self-action-supported progress evidence;
- hard-vs-comfort route evidence is separately inspectable;
- Foundation / CCC-0 browser/runtime gates remain clean.

### Authority-A1 — parallel teammate-loop prototype

Do **not** replace the existing SPATIAL mode.

Add an explicitly experimental alternate authority path in the workbench.

Minimum complete loop:

1. Situated Evidence Frame;
2. region-first relationship objective;
3. explicit PACE speed authority in world units;
4. minimal asymmetric player cooperation;
5. region-aware local velocity field using current spatial machinery only as donor;
6. DIRECT control path plus one temporal-realization candidate;
7. final static + player physical-agency protection;
8. World;
9. outcome attribution;
10. failure-class reconsideration.

The legacy eight-slot target should not be semantic authority inside this new path.

The new path may reuse its results as comparison evidence only.

### Authority-A2 — cooperation / continuity stress campaign

Only after A1 has a mechanically coherent complete loop.

Expand representative interactions:

- cross-front movement;
- player reversal;
- same-direction doorway;
- opposite-direction doorway;
- player stationary in path;
- companion already ahead of player flow;
- temporary separation / catch-up;
- pillar side choice under motion;
- externally disturbed player and companion bodies;
- repeated owner input changes at unfavorable clock phases.

The purpose is to falsify normal teammate coordination, not polish animation.

### Authority-A3 — Owner integrated behavior gate

The Owner test should judge actual authority behavior, not only debug substrate legibility.

Questions:

- does the companion keep up without rubber-banding or blindly sprinting?
- does it yield without becoming timid/useless?
- does it stop physically taking control away from the player?
- does it still feel like it has its own path and body?
- do reversals/change-of-mind look responsive without frame-snapping?
- do doorway/pillar decisions make spatial sense?
- when behavior is wrong, can incident evidence explain the exact chain?

A material Owner FAIL should trigger redesign of representation/responsibility, not weight tuning by default.

---

## 15. First falsifier matrix for A1

These are starting falsifiers; thresholds should be chosen from baseline evidence before implementation tuning.

### Player provenance

- stationary owner + companion pushes player;
- relationship/cooperation must not reinterpret forced actual motion as owner-directed intent;
- body motion remains available for physical prediction.

### Full-speed tracking

- player sustained at physical max speed;
- companion should not remain structurally capped at an accidental 70% local speed fraction;
- catch-up reserve must remain capability-bounded and settle again when relationship recovers.

### Capability consistency

- run actor max speed at 3 and a deliberately different value such as 5;
- planner, temporal realization, final swept proof and World requested velocity must agree about the same physical command.

### External-motion attribution

- zero companion command + player/world pushes companion toward objective;
- outcome may report useful displacement but must not claim self-action-supported progress.

### Hard/comfort passage

- hard-feasible but comfort-tight doorway;
- route remains hard reachable;
- comfort pressure is exposed as policy evidence, not false hard unreachable.

### Occluded player flow

- player velocity points through static geometry;
- cooperation prediction must not reserve a long phantom corridor through the obstacle as authoritative normal policy.

### Smooth input / discrete region representation

- slow heading/speed change across known representation boundaries;
- no one-frame semantic target teleport should directly become a command discontinuity merely because a representative sample/component changed.

### Temporal embodiment

Compare DIRECT vs temporal candidate under:

- smooth 90° turn;
- 180° reversal;
- route-side change;
- catch-up → settle transition.

The temporal path should reduce local command discontinuity without materially increasing final hard-guard intervention.

### Player physical authority

- healthy open-field following should produce near-zero final player-guard interventions;
- acute unsafe final command should be corrected;
- correction must remain static hard-safe;
- repeated interventions are an upstream FAIL signal.

### Clock phase

- identical same-step owner reversal presented at different region/PACE cadence phases;
- fast player-cooperation response should not vary by 0–5 ticks solely because the expensive region clock was unlucky.

---

## 16. Baselines that must survive

Keep these available during the authority campaign:

- MANUAL;
- CHASE;
- legacy RELATIONAL;
- current SPATIAL DIRECT;
- current SPATIAL NATURAL;
- clean CCC-0 shadow evidence where useful;
- forensics fixtures as research tests, without merging PR #19 wholesale.

The new teammate path is an **additional experimental mode**, not a rewrite that destroys comparison.

This is essential because many future claims are comparative:

- more/less player disturbance;
- better/worse tracking;
- smoother/rougher turns;
- fewer/more hard interventions;
- better/worse causal attribution;
- different Owner feel.

---

## 17. What should not be built yet

Do not add now:

- combat tactics;
- multi-companion group coordination;
- Mount & Blade-style command UI;
- LLM integration;
- learned player-motion prediction;
- broad ORCA/RVO middleware adoption;
- final public data model;
- generic game architecture abstraction;
- animation systems;
- global navigation rewrite unless current router proves a blocking falsifier;
- generalized faction/social-role semantics.

The current task is still one embodied companion learning to coordinate reliably with one player.

---

## 18. Stop / redesign triggers

Stop instead of tuning if any of these occur:

1. A0 cannot expose capability/provenance while preserving baseline authority exactly.
2. Region-first authority still requires repeatedly chasing a discontinuous representative point.
3. Hard-vs-comfort connectivity remains ambiguous enough to manufacture false unreachable states.
4. Temporal realization requires frequent final hard correction in ordinary open-field play.
5. Player cooperation needs large hidden state/timers to stop flicker rather than explicit episode semantics.
6. PACE only works by pushing actor physical max speed higher instead of using a coherent capability contract.
7. Outcome attribution labels external displacement as own successful action in qualified counterexamples.
8. A1 becomes impossible to explain from causal evidence in one bounded incident.
9. The new stack feels smoother only because it became less responsive or less spatially competent.
10. Existing comparison baselines are accidentally changed by the experimental path.

---

## 19. Research invariants carried forward

These are current strongest invariants unless later evidence falsifies them:

1. **owner control intent ≠ requested body motion ≠ actual body motion ≠ forced/contact-induced motion**;
2. **physical capability ≠ preferred pace ≠ catch-up policy ≠ final command**;
3. **hard physical feasibility ≠ comfort desirability**;
4. **relationship region ≠ representative route/debug anchor**;
5. **semantic objective authority ≠ temporal realization authority**;
6. **normal cooperation ≠ rare emergency player physical-agency protection**;
7. **metric improvement ≠ self-caused progress**;
8. **cached cognition needs explicit age/provenance**;
9. **final hard intervention frequency is a health metric, not merely a safety success**;
10. **preserve useful embodied irregularity only when its cause is semantically defensible**.

---

## 20. Immediate next stage

The next implementation work should **not** begin A1 directly.

First create and execute a bounded **Authority-A0 contract plan** on this clean planning line.

That stage should extract:

- capability truth;
- same-step player control provenance;
- internal velocity command semantics;
- hard-vs-comfort route truth;
- outcome attribution;
- zero-authority differential evidence.

Only after A0 passes should A1 be re-planned again against the real resulting contracts.

This keeps the project aligned with the Owner's rule:

> first planning builds a flexible skeleton; every serious implementation stage is planned again from fresh evidence.