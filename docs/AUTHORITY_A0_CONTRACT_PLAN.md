# Authority-A0 — Contract Extraction Plan

Status: **STAGE PLAN · ZERO INTENDED BEHAVIOR CHANGE · NO NEW COORDINATION AUTHORITY**

Parent:

`docs/COORDINATION_AUTHORITY_REPLAN.md`

Clean base lineage:

`experiment/ccc-0-shadow-coordination` @ `4318d895f1e83ba921faf1c7f4bd7cefea1c46f2`

Forensics evidence source:

PR #19 / `docs/BEHAVIOR_FORENSICS_CHECKPOINT.md`

---

## 1. Stage question

Before building the first real teammate authority loop, can the runtime expose the missing factual contracts needed by that loop **without changing existing movement behavior**?

A0 must make these distinctions executable and testable:

1. player owner-control intent vs requested/actual/externally disturbed body motion;
2. actor physical max-speed capability vs policy pace vs normalized World input;
3. hard route connectivity vs desired comfort quality;
4. submitted action vs post-World outcome vs externally influenced outcome;
5. fresh same-tick evidence vs cached/stale evidence.

A0 succeeds only if these contracts become available while current MANUAL / CHASE / RELATIONAL / SPATIAL DIRECT / SPATIAL NATURAL behavior remains a defended baseline.

A0 is **not** a new behavior stage.

---

## 2. Why A0 is necessary now

The broad post-Foundation skeleton originally allowed WHERE/PACE authority before deeper cooperation/temporal integration.

Forensics invalidated that implementation order.

### 2.1 Player semantic contamination is real

A live browser rehearsal proved:

- owner input = `{0,0}`;
- player requested velocity = `{0,0}`;
- companion contact induced actual velocity about `{-1.499,0}`;
- legacy relationship consumed `{-1,0}` as player direction;
- semantic relationship changed because of motion the companion helped cause.

Any authority policy built on one generic player heading before fixing provenance would encode this error into the new architecture.

### 2.2 Capability mismatch can invalidate safety proofs

Forensics demonstrated that a brain reasoning at 3 u/s while World executes an actor configured for 5 u/s produces a different swept endpoint and can invalidate a final static clearance proof.

PACE cannot safely become authoritative until every layer can refer to the same max-speed capability.

### 2.3 Progress can currently misattribute agency

A zero-command companion physically pushed toward its target can be classified as `PROGRESSING`.

That is adequate for some survival diagnostics but not adequate for a future brain that uses outcome history to reconsider policy.

### 2.4 Hard/comfort separation is only partially defended

Current `StaticRouteEdge` already exposes:

- `clear` for hard-body feasibility;
- `comfortClear` for desired clearance.

`shortestPath()` uses hard-clear edges, which is correct.

However, route graph node construction still uses `desiredQueryRadius` for corner placement/filtering.

The forensics synthetic narrow-boundary fixture proves:

- `clearance = 0` → hard route is reachable/routed;
- default desired `+0.08` clearance → the same physical target can become `unreachable`.

Therefore A0 must expose an unambiguous **hard-connectivity truth path** before new region/recovery authority depends on router status.

---

## 3. Hard stage boundary

A0 may:

- add pure evidence types/evaluators;
- add explicit World capability queries;
- add an internal world-unit velocity-command representation;
- add shadow round-trip adapters around existing `MotionIntent`;
- add a `SituatedEvidenceFrame` built from current input + World evidence;
- add conservative motion/outcome provenance classification;
- add separate hard-route truth evidence;
- selectively transplant proven causal instrumentation concepts from PR #19;
- add tests, causal trace fields and minimal workbench evidence;
- refactor internal plumbing only after exact differential evidence proves equivalence.

A0 must not:

- change relationship target authority;
- promote CCC-0 region/PACE/player-flow output;
- change chosen local direction/speed policy;
- change ordinary companion max speed;
- install catch-up behavior;
- change player-cooperation policy;
- change final player physical-agency authority;
- change current recovery actions;
- add a new teammate behavior mode;
- merge PR #19 wholesale;
- repin public Pages behavior.

If a necessary contract cannot be extracted without behavior change, stop and re-plan rather than silently spending the zero-authority budget.

---

## 4. A0 contract vocabulary

Names remain provisional until implementation proves them useful.

### 4.1 `MovementCapability`

Minimum:

```text
actorId
maxSpeed
radius
source
```

`maxSpeed` must come from the same actor/scenario truth used by World execution.

Do not copy `S3_EXPERIMENT_MAX_SPEED` into a second contract.

Preferred source shape:

- explicit `LabWorld.actorMovementCapability(actorId)` or equivalent;
- sourced from authoritative actor configuration/physical state;
- no additive change to `ActorSnapshot` required unless evidence later justifies it.

Reason for preferring a query over snapshot expansion in A0:

- preserves existing snapshot schema;
- makes differential comparison easier;
- separates dynamic body outcome from relatively static capability truth.

### 4.2 `PlayerControlEvidence`

Minimum:

```text
sourceTick
move
active
```

This must be the **same-step input** that will be submitted to World, not reconstructed from prior requested/actual velocity.

### 4.3 `PlayerMotionEvidence`

Keep raw channels separate:

```text
requestedVelocity
actualVelocity
motionError
contacts
```

Do not publish one canonical heading here.

### 4.4 `PlayerMotionProvenance`

Conservative first classification:

```text
OWNER_DIRECTED
OWNER_CONSTRAINED
EXTERNAL_MOTION_EVIDENT
MIXED_OR_UNCERTAIN
STATIONARY
```

Every classification carries raw evidence and reason.

It is an inference, not World truth.

### 4.5 `SituatedEvidenceFrame`

Minimum first-stage shape:

```text
tick
playerControl
playerBody
playerMotionProvenance
playerCapability
companionBody
companionCapability
freshness/provenance fields
```

It may later include route/region/cooperation state, but A0 should keep it factual and small.

### 4.6 `VelocityCommand`

Internal command in world units:

```text
actorId
velocity
capabilityMaxSpeed
sourceTick
source/reason
```

A0 does not require existing brains to emit this natively on day one.

First derive it from current authoritative `MotionIntent` in shadow, then prove round-trip equivalence.

### 4.7 `OutcomeAttributionEvidence`

Conservative classes:

```text
SELF_ACTION_SUPPORTED
SELF_ACTION_CONSTRAINED
EXTERNAL_DISPLACEMENT_EVIDENT
MIXED_OR_AMBIGUOUS
NO_MEANINGFUL_MOTION
```

Inputs:

- before snapshot;
- submitted command/intended velocity;
- final constraint evidence when available;
- after snapshot;
- contacts;
- displacement / motion error.

Do not infer exact force ownership.

### 4.8 `HardRouteTruth`

A0 needs a route-connectivity result that answers only:

> can the companion body physically reach this target/component under current static geometry and hard egress semantics?

Desired comfort quality should be separate evidence.

This may reuse most of `StaticRoutePlan`, but must not allow desired clearance to erase hard graph nodes/connectivity.

---

## 5. Work package A0.1 — capability truth

### Goal

Make physical max speed available to decision code from one authoritative source.

### Preferred implementation direction

Add a World capability query rather than extending every snapshot immediately.

Possible API:

```text
LabWorld.actorMovementCapability(actorId)
```

Return a defensive value containing at least:

- actor id;
- max speed;
- radius if useful for cross-checking.

### Required proofs

1. Open scenario returns player and companion capability matching scenario spec.
2. A synthetic actor configured for speed 5 reports exactly 5.
3. World still executes the same normalized `MotionIntent` at that same reported speed.
4. No current scenario behavior changes.

### Falsifier

If capability must be duplicated or inferred from a brain constant to make tests pass, A0.1 FAILS.

---

## 6. Work package A0.2 — same-step situated player evidence

### Goal

Give coordination code access to current owner control intent without treating body response as intention.

### Placement

Current input is created in `R1LabScene.computeIntents()` before `World.step()`.

A0 can build the first `SituatedEvidenceFrame` there or in a small pure adapter called from there.

Do not yet relocate all scene orchestration.

### Required evidence

For every decision tick:

- same-step control move;
- prior/current World body requested velocity;
- actual velocity;
- motion error;
- contacts;
- capability;
- source tick.

### Required counterexample

Recreate the forensics player-push case on the clean A0 branch:

- same-step owner control remains zero;
- requested body velocity remains zero;
- actual body velocity becomes material due to contact;
- provenance reports external/mixed evidence rather than `OWNER_DIRECTED`;
- raw actual velocity remains available for physical prediction.

### Important non-goal

Do not decide final future player-facing orientation policy in A0.

A0 only makes the evidence separable.

---

## 7. Work package A0.3 — world-unit command contract

### Goal

Remove hidden speed semantics from the future brain without changing current submitted motion.

### Phase 1 — shadow derivation

For the current authoritative intent:

```text
velocity = MotionIntent.move * authoritative actor maxSpeed
```

Record this as `VelocityCommand` evidence.

Do not change the actual World input yet.

### Phase 2 — round-trip proof

Define one adapter:

```text
VelocityCommand -> MotionIntent
```

using the same capability:

```text
move = velocity / maxSpeed
```

with deterministic finite/clamp rules.

Prove for all current authoritative commands that:

```text
existing MotionIntent
== roundTrip(existing MotionIntent -> VelocityCommand -> MotionIntent)
```

within exact representation where possible; if float representation prevents literal equality, first explain and bound it before adoption.

### Phase 3 — authority-neutral adoption

Only after Phase 2 passes may existing movement submission route through the adapter.

Then run differential World execution against the pre-adoption path.

### Required synthetic speed proof

Repeat the 3-vs-5 case:

- same normalized move yields different world velocity by capability as expected;
- the derived `VelocityCommand` records that exact velocity;
- any final swept proof uses the same velocity/capability, not hard-coded 3.

### Falsifier

If the adapter changes current command selection or World outcome, stop before adoption.

---

## 8. Work package A0.4 — hard-route truth extraction

### Goal

Expose hard physical connectivity independently from comfort graph construction.

### Current state

Good existing pieces:

- edge `clear` is hard-body evidence;
- edge `comfortClear` is separate;
- shortest path uses hard-clear edges;
- route reports constrained comfort edges.

Remaining problem:

- corner node placement/filtering is based on `desiredQueryRadius`;
- a hard-only narrow boundary route can therefore disappear before hard edge search.

### A0 approach

Do not rewrite the authoritative router immediately.

First add a pure/parallel hard-truth route evaluation or a parameterization that constructs hard connectivity from hard radius only.

For each current authoritative route observation, expose:

- legacy/default route status;
- hard-truth route status;
- whether desired clearance is available;
- whether the two disagree;
- reason / blocker / path.

### Required regression

Synthetic narrow-boundary fixture must show:

- hard route reachable;
- desired comfort route unavailable/constrained;
- evidence does not flatten this into hard `unreachable`.

### Zero-authority rule

Existing movement/recovery still consumes the current route in A0.

A1 may later choose hard truth as authority after stage re-plan.

---

## 9. Work package A0.5 — conservative outcome attribution

### Goal

Stop equating target-metric improvement with proof that the chosen action worked.

### Pure evaluator first

Build attribution from existing pre/post facts.

Suggested evidence terms:

- submitted speed/direction;
- requested speed after World;
- actual speed/direction;
- body displacement;
- motion error;
- player/static contacts;
- final-constraint intervention;
- optional alignment of displacement with submitted command.

### Required fixtures

#### A. Healthy self motion

- nonzero command;
- low motion error;
- displacement aligned with command;
- no material contact.

Expected: `SELF_ACTION_SUPPORTED`.

#### B. Static suppression

- nonzero command;
- body response materially suppressed/deflected;
- static contact or hard constraint evidence.

Expected: `SELF_ACTION_CONSTRAINED` or conservative mixed result.

#### C. External push with zero command

- command near zero;
- material displacement;
- player contact;
- target metric may improve.

Expected: `EXTERNAL_DISPLACEMENT_EVIDENT`.

This exact case must not become self-action-supported.

#### D. Mixed contact

- nonzero command;
- material player contact;
- actual motion differs significantly from requested.

Expected: `MIXED_OR_AMBIGUOUS`, not false precision.

### Zero-authority rule

Current `ProgressRecoveryMonitor` remains authoritative in A0.

Attribution runs beside it and records disagreements.

A1/recovery re-plan will decide how attribution should affect action.

---

## 10. Work package A0.6 — freshness and evidence age

### Goal

Prevent future consumers from silently depending on unlucky clock phase.

Every A0-derived object should carry enough timing evidence to answer:

- which World tick produced this fact?
- is it same-step control or prior-step body outcome?
- if cached, how old is it?

Minimum:

```text
sourceTick
ageTicks
```

where caching exists.

Do not invent a universal allowed age yet.

A1 will set consumer-specific freshness budgets.

---

## 11. Work package A0.7 — causal trace transport

### Goal

Make the new contracts inspectable without importing the whole PR #19 forensics branch.

Selectively promote only instrumentation required to prove A0:

- same-step owner input;
- player requested/actual velocity;
- player contacts/motion error;
- player provenance classification + reason;
- player/companion capability max speed;
- derived world-unit velocity command;
- hard-route truth vs legacy/default route disagreement;
- outcome attribution + reason.

### Incident schema

Do not bump a schema merely for naming aesthetics.

If the clean CCC-0 causal incident cannot carry the new evidence unambiguously, create the next explicit schema version and qualify it through a real Chromium download.

Do not wholesale transplant incident v5 implementation from PR #19.

Promote concepts and minimal proven fields only.

---

## 12. A0 differential test contract

This is the core stage gate.

### 12.1 Baseline capture

For deterministic scenarios/modes capture current clean-base authoritative sequences:

- submitted `MotionIntent`;
- requested/actual velocities;
- positions;
- contacts;
- recovery decisions;
- route statuses;
- key DIRECT/NATURAL debug outputs.

### 12.2 After A0 extraction

Require exact equality for behavior-bearing outputs wherever deterministic.

Additive evidence fields are excluded from literal object equality only when they did not exist before.

The behavioral projection must remain equal.

### 12.3 Matrix

At minimum:

- Open DIRECT/NATURAL;
- Pillar DIRECT/NATURAL;
- Doorway DIRECT/NATURAL;
- Head-on DIRECT/NATURAL;
- moving-player script;
- reversal script;
- known recovery fixture.

Keep the existing CCC-0 zero-authority torture as a donor and strengthen it rather than building an unrelated comparison framework.

---

## 13. Browser qualification

A0 is mostly structural, but real-browser qualification still matters because same-step control evidence originates in the live input path.

Required Chromium rehearsal:

1. boot workbench cleanly;
2. press/release real WASD input;
3. causal evidence reports same-step owner control separately from body motion;
4. run bounded head-on/manual push counterexample;
5. owner input remains zero during forced body motion;
6. provenance does not call it owner-directed;
7. capture and parse a real incident download if incident schema was extended;
8. no page/console/request faults;
9. existing CCC-0 panel/disclosure behavior remains functional.

No Owner feel gate is required for A0 because A0 intentionally changes no behavior.

---

## 14. Recommended implementation order

1. **Capability query/type** — pure and directly verifiable.
2. **Situated evidence types + same-step control adapter** — no behavior consumer yet.
3. **Player provenance evaluator + exact solver-push regression**.
4. **VelocityCommand shadow derivation + round-trip adapter tests**.
5. **Hard-route truth parallel evaluator + narrow passage regression**.
6. **Outcome attribution pure evaluator + external-push regressions**.
7. **Aggregate A0 evidence frame** if composition is useful; avoid a giant blackboard.
8. **Causal trace transport** of only the required fields.
9. **Workbench/browser evidence**.
10. **Full differential campaign**.
11. Only if all gates pass, consider routing existing submission through the proven velocity adapter.
12. Re-run the full differential campaign after any such authority-neutral plumbing adoption.
13. Close A0 with a compact evidence document and re-plan A1 from the actual resulting seams.

---

## 15. Promotion blockers

A0 is FAIL / not complete if any are true:

- capability still depends on a duplicated brain constant;
- same-step owner input cannot be distinguished from prior body motion;
- forced zero-input player motion is classified as owner-directed;
- a 5 u/s actor can still execute farther than the final proof assumes;
- hard-only connectivity can only be learned by setting comfort clearance to zero manually with no explicit evidence contract;
- zero-command external companion displacement is classified as self-action-supported;
- velocity round-trip changes current commands materially;
- existing SPATIAL behavior changes before A1;
- browser input evidence is stale/ambiguous enough to reproduce the previous provenance leak;
- new causal evidence becomes another opaque state blob instead of exposing raw facts.

---

## 16. Explicit non-goals

A0 does not decide:

- final useful-region representation;
- final PACE formula;
- catch-up thresholds;
- final cooperation corridor model;
- route-side continuity policy;
- future NATURAL replacement;
- final player-agency guard composition;
- final recovery state machine;
- command UI;
- combat;
- multi-companion coordination.

It only creates the factual seams required to study those things without known semantic contamination.

---

## 17. A0 completion evidence

Close the stage only with an evidence checkpoint containing:

- exact branch/head;
- CI run;
- behavioral differential result;
- capability consistency result including non-3 speed case;
- solver-push player provenance result;
- hard-only narrow-route result;
- external-push outcome attribution result;
- real-browser same-step input/provenance result;
- remaining limitations/non-claims;
- explicit statement that no new coordination authority was promoted.

Then create a **fresh A1 stage plan**.

Do not begin A1 merely because the A0 implementation compiles.