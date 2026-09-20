# Authority-A1.2 — Fresh post-A1.1 moving-frame replan

Status: **CANONICAL A1.2 REPLAN · NO NEW MOVEMENT AUTHORITY YET**

Date: 2026-09-15

Parent checkpoint:

- A1.1 planning/runtime line: `experiment/authority-a1-relative-region`
- parent head used for this replan: `61dc17cf534a128cb9c5e1a004305d75a5c3ea97`
- exact live/browser-qualified A1.1 runtime: `1110fd1399f1ab5fc7594ca9ee38454c17fd002b`

Prerequisite evidence:

- `docs/AUTHORITY_A1_1_EXECUTION_EVIDENCE.md`
- `docs/AUTHORITY_A1_1_CRITICAL_REVIEW.md`
- `docs/AUTHORITY_A1_2_RELATIONAL_ROLLOUT_RESEARCH.md`
- `docs/AUTHORITY_A1_STAGE_PLAN_V2.md`
- `docs/BEHAVIOR_FORENSICS_CHECKPOINT.md`

This document deliberately replans A1.2 **after** A1.1 passed. It does not mechanically continue the earlier A1 stage decomposition. Where the older plan says "PACE + world-unit field", this replan asks whether those responsibilities should remain separate authorities at all.

---

## 1. Stage question

Can A1 convert the qualified player-relative objective-space substrate into a **causally legible, physically plausible short-horizon teammate decision** without collapsing back into point chasing, hidden speed hacks, reciprocal-player assumptions, or a cascade of independent corrective modules?

A1.2 remains non-authoritative until the complete shadow teammate loop exists and survives its falsifiers.

The target is not "better following". The target is the first movement decision representation that can later support follow, regroup, lateral positioning, doorway cooperation and other teammate semantics through the same underlying mechanics.

---

## 2. What A1.1 changed

A1.1 established several facts that invalidate a naive continuation of the pre-A1.1 plan:

1. **Direct player-relative utility is the semantic authority.**
   The sampled lattice and its World projections are observation instruments, not movement targets.

2. **Heavy World accessibility evidence may be older than current semantic evidence.**
   Any A1.2 consumer must reason with explicit source ticks/age/coverage rather than pretending all evidence is synchronous.

3. **Multiple accessible fragments may coexist.**
   A1.2 cannot silently turn a debug representative or one fragment member into the meaning of the relationship.

4. **The substrate is objective-agnostic enough to survive a second lateral profile.**
   A1.2 must preserve that property. No downstream logic may assume "follow behind at radius X" as architecture.

5. **A1.1 is live but has zero movement authority.**
   This gives A1.2 a clean boundary: experiments can observe the exact decision-time substrate while baseline movement remains independently comparable.

---

## 3. Main reframe: choose a short joint future, not a target and speed

The old decomposition risks becoming:

```text
WHERE -> PACE -> cooperation correction -> locomotion correction -> temporal correction -> final guard
```

Every module can be locally reasonable while no single layer owns the causal reason for the final movement.

A1.2 should instead test this stronger primitive:

> **Among a small explicit set of companion control/future candidates, which candidate remains admissible and useful across the relevant short player futures, given the current relationship objective and World evidence?**

Provisional flow:

```text
A1Situation @ t
+ current A1 objective-space evidence
        |
        v
explicit player-future hypotheses
+ explicit companion-control candidates
        |
        v
shared-horizon joint rollout
        |
        v
constraint ladder
  1. command/actuation reachability
  2. hard static/body legality
  3. acute player physical safety
  4. asymmetric player-agency / right-of-way
        |
        v
utility among survivors
  - relational objective utility
  - route/topology progress where needed
  - robustness across player hypotheses
  - temporal effort/continuity
        |
        v
selected candidate + decision certificate
        |
        v
DIRECT or TEMPORAL realization model
        |
        v
narrow final physical guard
        |
        v
VelocityCommand -> World
        |
        v
A0 outcome attribution + prediction error
```

The exact ordering between some soft/lexicographic terms remains experimental. Hard constraints must not be purchasable by a large utility term.

---

## 4. PACE is demoted from independent movement authority

The earlier plan treated PACE as an explicit stage that emits a desired speed before local velocity selection.

That representation is useful as **evidence** but dangerous as a separate authority because it can create contradictory cascades:

- PACE asks for max speed;
- cooperation suppresses it;
- local field redirects it;
- temporal realization cannot reach it;
- final safety changes it again.

Fresh A1.2 working rule:

> **Speed should primarily emerge from the selected reachable future.**

A candidate's speed is still explainable through pace-like evidence:

- current relational deficit;
- opening/closing trend;
- player requested speed;
- companion capability;
- whether the deficit is physically closable;
- whether cooperation suppresses otherwise useful progress.

A1.2 may publish a `PaceEvidence` or preferred-speed range for diagnostics and later policy composition, but the first rollout experiment should not require a standalone PACE module to decide velocity before candidate evaluation.

This is explicitly provisional. If experiments show that a separate PACE contract improves causal clarity rather than adding correction layers, it can be restored.

---

## 5. Separate World-command admissibility from temporal realizability

Current `MovementCapability` truth contains:

- `maxSpeed`;
- `radius`.

It does **not** currently claim acceleration, braking or jerk limits.

The existing NATURAL `motion-continuity` donor contains experimental:

- max acceleration;
- max braking acceleration;
- max jerk.

Those are not World capability truth.

Therefore A1.2 must use two different concepts:

### 5.1 DIRECT command-admissible future

A velocity is command-admissible when:

- finite;
- within `MovementCapability.maxSpeed`;
- body/static trajectory is legal for the tested horizon under the chosen approximation.

The current World is kinematic enough that command velocity can change immediately subject to World collision resolution. Do not invent an acceleration limit for DIRECT.

### 5.2 TEMPORAL realizable future

A TEMPORAL candidate must be generated or rolled out through an explicit A1-owned actuation model.

The S4 continuity donor is a candidate model, not truth. Its historical constants must be configuration with provenance and separately falsified.

### 5.3 Required invariant

Do not score one terminal future and then send it through an actuator that produces a materially different trajectory without accounting for that difference.

For TEMPORAL, **the rollout used for selection must model the same realization semantics that will execute the candidate**, or the selected candidate must be re-evaluated after temporal realization before authority.

This is a major A1.2 promotion gate.

---

## 6. Player future: explicit hypothesis set, never one magical velocity

A1 has unusually good evidence:

- same-step Owner request;
- current physical player body state;
- previous World outcome/provenance;
- hard static geometry.

Those facts should remain distinct.

Initial deterministic player-future families:

### H1 — Owner-request continuation

Use the current same-step requested velocity from `A1Situation`, clipped/invalidated by near-term hard static feasibility.

Meaning: current player agency/intention.

### H2 — body-response continuation

Use actual current body motion when it materially differs from Owner request because of contact, residual motion or external displacement.

Meaning: acute physical occupancy, **not** semantic orientation.

### H3 — bounded brake/transition

A short stop/deceleration branch when Owner request disappears, reverses or sharply changes.

Meaning: protect against overcommitting to one continuation during transitions.

Do not average these into one centroid trajectory. Preserve provenance and evaluate candidate robustness across the relevant set.

Do not let H2 refresh semantic relationship orientation.

---

## 7. Companion candidate families

Do not copy the legacy spatial candidate grid as A1 architecture.

The legacy donor is useful evidence because it proved local velocity selection can create an independent trajectory, but it also contains the assumptions A1 exists to replace: fixed speed fractions, fixed max speed, one relationship target and monolithic score weighting.

A1.2 should begin with a **small named candidate family set** so falsification remains causal.

Initial families to compare:

### C0 — hold / brake

A zero or bounded braking candidate. Mandatory control.

### C1 — maintain current motion

Preserve current companion world velocity where command/actuation semantics permit it.

Purpose: distinguish "do nothing useful" from unnecessary retargeting.

### C2 — player feed-forward

Attempt to preserve the current relative state by matching the relevant player future velocity, clipped to companion capability.

Purpose: directly attack the demonstrated equal-speed stale-target failure.

This is a candidate, not privileged policy.

### C3 — feed-forward + bounded relational correction

Add a bounded correction chosen from the gradient/direction of direct objective-space utility at predicted relative state.

Possible correction directions should include radial and lateral alternatives rather than one vector hardcoded toward a representative point.

Purpose: improve a poor relationship while retaining moving-frame maintenance.

### C4 — small distributed local alternatives

A compact set of alternative admissible world velocities/control changes around current motion/feed-forward.

Purpose: permit sidestep/yield/obstacle adaptation when the obvious relational vector is bad.

Do not recreate a dense 24 x speed-grid without evidence that it is required.

### C5 — route/topology-guided alternative

Not required in the first pure slice. Introduce only when local rollout is demonstrably trapped by obstacle topology.

Routing should supply a progress direction/potential or gateway/corridor evidence. It must not redefine relationship meaning as a route waypoint.

---

## 8. Candidate comparison: constraint ladder before utility

A1.2 must not begin with another weighted soup.

Each candidate receives a decision certificate through successive gates.

### Gate G0 — evidence alignment

Reject/unknown if required situation/objective evidence belongs to incompatible tick/scenario/objective regime.

Stale heavy accessibility evidence may still be usable as aged guidance when explicitly allowed. It cannot masquerade as current hard truth.

### Gate G1 — command / actuation reachability

- DIRECT: command magnitude/capability bounds;
- TEMPORAL: candidate is reachable under the selected actuation model over the horizon.

### Gate G2 — static/body hard legality

Reject predicted body trajectories that cross known hard World geometry under the tested approximation.

Comfort never changes hard feasibility.

### Gate G3 — acute joint body safety

Reject unacceptable player/companion body overlap across the relevant near-term player hypotheses.

This is physical safety, not broad comfort.

### Gate G4 — asymmetric player cooperation

Player agency has priority. A companion candidate that needlessly claims the player's likely lane/doorway should lose to an otherwise useful yielding candidate.

This may be lexicographic or a bounded policy cost depending on evidence. It must not assume reciprocal player avoidance like ORCA-style equal responsibility.

### Utility U1 — relational usefulness

Score predicted player-relative state directly through A1.1 objective utility.

No sampled-point snap.

### Utility U2 — robustness over player hypotheses

Prefer futures that remain useful/admissible across plausible H1/H2/H3 branches over brittle candidates that work under only one precise guess.

Exact risk aggregation remains experimental.

### Utility U3 — route/topology progress

Used only where needed to escape local minima or blocked objectives. Route evidence guides progress without becoming semantic authority.

### Utility U4 — temporal effort/continuity

Among candidates of similar usefulness, prefer lower unnecessary control discontinuity and physically coherent movement.

This is where meaningful NATURAL donor behavior belongs.

---

## 9. Cooperation versus final safety authority

A1.2 must keep two responsibilities separate.

### Normal cooperation

Lives upstream in candidate evaluation:

- likely player lane intrusion;
- doorway/right-of-way contention;
- yielding;
- unnecessary crossover;
- release when conflict clears.

This is teammate policy.

### Final guard

Lives at the final command boundary:

- one-step / very short hard physical collision safety;
- static hard legality;
- relevant requested/actual player body hypotheses when they materially diverge.

This is not teammate intelligence.

Promotion rule:

> If the final guard frequently changes A1 commands in ordinary scenarios, the upstream rollout/cooperation model is failing and must be redesigned rather than allowing the guard to become hidden steering authority.

The existing legacy `final-command-constraint` is a static-hard donor. A1 should receive a new isolated final physical contract rather than silently mutating legacy behavior.

---

## 10. Prediction horizon policy

Do not freeze one horizon as architecture.

The first pure experiment should use a small explicit horizon set or one bounded working horizon with the horizon carried in every evidence record.

Potential initial values should be derived from scenario/body scale and 60 Hz timing, not copied from legacy `0.55s` by inertia.

Experiments must attack horizon sensitivity:

- too short -> cannot anticipate crossover/doorway conflict;
- too long -> player prediction becomes brittle and local rollout can overreact;
- different responsibilities may need different horizons, but hidden mixed-horizon scoring is forbidden.

When two terms use different horizons, the decision certificate must expose that fact.

---

## 11. Outcome closure

A teammate loop is incomplete until predicted action meets World outcome.

For every authoritative-candidate rehearsal, preserve:

- selected command/future prediction;
- submitted `VelocityCommand` / `MotionIntent`;
- actual companion body outcome;
- relevant player body outcome;
- contacts;
- A0 attribution;
- prediction error.

Distinguish at least:

- prediction succeeded;
- static/contact constrained;
- player interaction changed outcome;
- temporal actuator did not realize the selected candidate;
- stale/invalid supporting evidence;
- unexplained mismatch.

This evidence should drive **targeted invalidation**, not generic "planner failed -> retry everything" behavior.

---

## 12. Decision certificate contract

A1.2 should make causality legible from the first pure experiment.

Each candidate should be able to report:

- id/family;
- source tick and horizon;
- proposed control / velocity;
- predicted companion trajectory/terminal state;
- player hypotheses considered;
- G0–G4 pass/fail/unknown evidence;
- predicted relative states;
- objective utility per relevant hypothesis;
- robustness summary;
- topology/progress evidence if used;
- temporal effort/continuity evidence;
- selected/rejected reason.

The winner must have a compact causal reason such as:

> `selected: preserves objective under H1/H2, yields doorway lane, direct-command admissible; feed-forward+radial alternative loses on player-agency conflict`

Do not require the Owner to reverse-engineer a scalar score.

---

## 13. Fresh bounded execution sequence

This sequence supersedes the old assumption that A1.2 begins by implementing a standalone PACE module.

### A1.2a — pure moving-frame rollout evaluator

**No World authority. No routing. No cooperation yet.**

Given:

- current player-relative state;
- explicit player future velocity/hypothesis;
- explicit candidate companion velocity;
- horizon;
- A1 objective profile/orientation;

compute:

- future player-relative state;
- direct A1.1 utility now/future;
- utility delta;
- exact temporal provenance.

Required falsifiers:

1. equal-speed preservation from a good relative state;
2. equal-speed deficit honesty — matching max speed cannot magically close a pre-existing same-direction gap;
3. stop after full-speed motion;
4. same-step reversal;
5. lateral objective changes preferred relative future without role-name branches;
6. translation invariance;
7. rotation covariance under comparable semantic orientation;
8. no sampled-mesh dependence.

This slice answers only whether A1.1 semantics compose correctly with moving-frame futures.

### A1.2b — candidate family generator + reachability truth

Add C0–C4 candidate families.

Separate DIRECT command-admissibility from TEMPORAL actuation reachability.

Do not introduce World authority.

Required falsifiers:

- no candidate exceeds World max speed;
- DIRECT and TEMPORAL reachability are not conflated;
- feed-forward is one candidate family, not privileged winner;
- impossible temporal velocity jump absent when temporal envelope is active;
- candidate set remains compact and deterministic.

### A1.2c — explicit player future hypothesis set

Build H1/H2/H3 with provenance and hard-static clipping/invalidity.

Required falsifiers:

- Owner request into a wall does not reserve phantom occupancy through the wall;
- external player push affects physical occupancy reasoning but not semantic orientation;
- same-step reversal is visible immediately;
- hypothesis disagreement remains explicit rather than averaged away.

### A1.2d — hard local World legality + asymmetric cooperation

Add G2/G3/G4.

Focus scenarios:

- pillar;
- head-on;
- doorway;
- narrow hard-only passage.

Required falsifiers:

- comfort cannot erase hard-feasible passage;
- companion yields rather than assuming reciprocal player avoidance;
- acute physical conflict is distinguished from comfort/likely-flow conflict;
- final guard remains unnecessary in normal shadow selection.

### A1.2e — robust selector + decision certificates

Compare surviving candidates across explicit player hypotheses.

Experiment with robustness rules without freezing one weighted score.

Required falsifiers:

- brittle one-hypothesis optimum can lose to robust near-optimum;
- winner/loser cause remains explainable;
- changing one hard constraint cannot be compensated by unrelated high utility.

### A1.2f — topology progress + local-minimum attack

Only now integrate route/topology progress guidance.

Required falsifiers:

- blocked side of pillar does not become permanent local optimum;
- long detour can temporarily worsen relational utility while making honest topological progress;
- route waypoint/gateway never becomes semantic relationship authority;
- stale/partial A1.1 accessibility evidence stays qualified.

### A1.2g — complete zero-authority shadow teammate loop

Run the whole loop live beside baseline authority:

- A1Situation;
- A1.1 semantic substrate;
- player futures;
- companion candidates;
- cooperation;
- topology guidance;
- decision certificate;
- DIRECT/TEMPORAL predicted realization;
- outcome comparison against actual baseline World run where meaningful.

A1 selected command remains shadow only.

Required browser evidence:

- real same-step Owner reversal;
- stop/start;
- sustained equal-speed travel;
- pillar;
- doorway/head-on;
- no runtime faults;
- bounded cost;
- legible selected/rejected causes.

Only after A1.2g is defensible should the first **bounded authoritative A1 activation** be designed. Authority activation is a separate promotion gate, not automatically A1.2h.

---

## 14. What is explicitly deferred

A1.2 does not need to solve:

- combat role selection;
- command menu semantics;
- multi-companion coordination;
- crowd ORCA;
- long-horizon human-motion prediction;
- generic behavior planner;
- LLM decisions;
- teleport/catch-up cheats;
- final production tuning.

Those should not contaminate the first teammate movement authority question.

---

## 15. Red-team matrix for the complete shadow loop

The complete loop is not ready for authority unless it can be attacked by at least:

1. good relative state + sustained equal-speed player motion;
2. companion starts materially behind while both capabilities are equal;
3. player hard stop from max speed;
4. same-step reversal;
5. smooth turn / arc;
6. pillar blocks the relationally obvious direction;
7. doorway contention;
8. head-on crossover;
9. narrow hard-feasible / comfort-poor passage;
10. external player push with zero Owner request;
11. objective switch follow-like -> lateral;
12. stale heavy accessibility evidence;
13. partial accessibility coverage;
14. local minimum requiring temporary relational worsening;
15. DIRECT versus TEMPORAL divergence;
16. scenario reset / A1 epoch reset.

The expected behavior need not be final-quality in every case. The evidence must be causally honest and architecture-breaking failures must be visible rather than patched by constants.

---

## 16. Promotion criteria

A1.2 can be considered mechanically complete only when:

- moving-frame semantics are mesh-independent and evidence-aligned;
- companion candidates obey explicit capability/actuation contracts;
- player future uncertainty remains explicit;
- hard constraints are not weighted costs;
- asymmetric cooperation acts upstream;
- route/topology guides progress without becoming relationship meaning;
- DIRECT and TEMPORAL predictions match their realization contracts closely enough for useful selection;
- selected/rejected candidates have decision certificates;
- outcome attribution closes the loop;
- complete shadow loop survives deterministic and real-browser adversarial evidence;
- baseline command remains authoritative throughout A1.2 qualification.

Owner gameplay feel is deliberately **not** judged until a bounded authoritative activation exists. Shadow quality can justify or kill the architecture, but it cannot prove teammate feel by itself.

---

## 17. First implementation decision

Begin with **A1.2a only**.

Do not:

- add a new movement selector behavior;
- create a target point from A1.1 fragments;
- implement standalone PACE first;
- copy legacy spatial candidate scoring;
- add routing/cooperation before the pure moving-frame semantic composition is proven.

Preferred first module shape is a small pure coordination file, provisionally:

`src/coordination/a1-moving-frame-rollout.ts`

It should reuse the existing A1.1 direct objective utility seam rather than duplicate relationship semantics.

The first tests should be mathematical/contract tests. Runtime integration follows only after this pure seam survives falsification.

---

## 18. North-star

A useful companion should not look smart because several corrective systems happen to cancel one another.

It should increasingly have one understandable causal story:

> **I understood the relationship that mattered, considered what the player may do next, considered what I can actually do next, yielded where the player's agency deserved priority, chose a physically plausible action whose future relationship was useful, then learned from what the World actually allowed to happen.**

A1.2 exists to find the smallest movement representation capable of supporting that story.
