# Companion Coordination Core — Pre-Architecture Skeleton

Status: **PLANNING ONLY · NO RUNTIME AUTHORITY · FOUNDATION-PRESERVING REWORK FRAME**

Base foundation:

`681c8fd3c2fd9b460d59a65148fe066dd65ca2cb`

Canonical substrate verdict:

`docs/FOUNDATION_FINAL_READINESS.md` — **FOUNDATION PASS · REWORK-READY**

This document begins the post-foundation Companion Coordination Core (CCC) redesign. It is deliberately a **pre-architecture skeleton**, not a final architecture specification. Its job is to define responsibilities, seams, falsifiers, evidence requirements and a safe rework path before implementation receives authority.

Every implementation stage must be re-planned against current evidence. Nothing here becomes permanent merely because it is written here.

---

## 1. Why CCC exists

The foundation campaign solved a different class of problem than the one CCC now attacks.

The defended substrate can survive ordinary constrained-world states, hard overlap/egress, route failure, candidate exhaustion, bounded local recovery and catastrophic runtime faults without turning ordinary gameplay states into hidden shutdowns or unexplained crashes.

What remains is primarily **coordination quality**:

- the legacy eight-slot relationship objective is too crude;
- the companion lacks a real pace / urgency / catch-up model;
- player right-of-way and predicted movement corridor semantics are not first-class;
- NATURAL temporal realization can invalidate an upstream player-safe movement decision;
- current `MotionIntent` and fixed speed authority are too narrow for the next class of behavior;
- the browser scene currently glues several semantic layers together that CCC should make explicit.

CCC therefore should not be treated as “S6: better slots”. It is a deliberate replacement of the current coordination semantics above the defended World/physics/safety substrate.

---

## 2. Foundation boundary: preserve by default, replace only with evidence

### Defended substrate to preserve unless new evidence falsifies it

- World as factual simulation authority;
- Rapier as current physical/contact/query kernel behind World;
- fixed-step world progression;
- hard physical feasibility distinct from desired/comfort clearance;
- explicit hard-egress semantics;
- static routing/topology contracts and live-start egress behavior;
- ordinary constrained states represented as data rather than exceptions;
- post-World progress/recovery observation;
- causal trace separating decision → command → World outcome → post-outcome interpretation;
- catastrophic fail-stop sentinel;
- MANUAL / deliberately simple baselines where they remain useful for research comparison.

### Explicitly open to aggressive redesign

- eight-slot relationship objective;
- player-relative spatial representation;
- pace / urgency / catch-up authority;
- fixed experiment speed ceiling as behavioral authority;
- `MotionIntent` shape and desired-speed contract;
- player movement corridor / right-of-way / chokepoint cooperation;
- ordering between spatial safety, player cooperation and temporal realization;
- NATURAL continuity implementation;
- scene-level orchestration responsibilities;
- later multi-companion coordination, commands and combat-facing coordination inputs.

---

## 3. Current bottlenecks identified from live authority

### 3.1 Point-target bottleneck

Current relationship reasoning eventually collapses to one `target: Vec2`. The downstream route and local mover therefore receive a single point even when the semantic desire is actually a broad acceptable area around the player.

That makes arbitrary target switching, path crossing and player obstruction too easy to create.

CCC should treat a **good region / field** as the semantic object. A representative point may temporarily remain as an adapter for existing routing, but the point must not become the new canonical meaning.

### 3.2 Normalized-move bottleneck

Current `MotionIntent` contains only a normalized-ish `move: Vec2`, while actor speed remains an external fixed capability. The local mover samples speed fractions but scales all of them against one experiment max speed.

This is insufficient for explicit settle/follow/catch-up/recover behavior.

CCC needs an explicit separation between:

- physical movement capability;
- coordination-preferred pace;
- urgency / catch-up pressure;
- final physically executable velocity.

The exact data type remains open.

### 3.3 Dynamic authority ordering gap

Current spatial selection can reject player-conflicting candidate velocities, but NATURAL continuity runs afterwards. Preserved R1-5A evidence proves that temporal realization can turn a player-safe upstream movement into a final command that produces real player contact.

CCC must make player-cooperation safety part of the **final realized command authority**, not merely an upstream preference.

This does not imply a hard post-continuity clip is the correct solution. Constraint-aware temporal realization, safe fallback families and final dynamic revalidation must be compared experimentally.

### 3.4 Scene orchestration owns too much semantic glue

`R1LabScene` currently composes:

`relationship point → route → local spatial stack → World → route/recovery observation → causal evidence`.

That is acceptable for the completed research stack but too implicit for the next redesign.

CCC should introduce an explicit coordination seam so that browser orchestration does not itself become the architecture.

---

## 4. Donor conclusions

### 4.1 S5 continuous relationship field — selective donor, not authority

Preserve these findings:

- broad cheap field sampling can precede expensive route qualification;
- useful relationship state can be represented as a spatial utility field rather than eight slots;
- route-aware shortlist evaluation is practical;
- the semantic object should be a coherent good region;
- **centroid collapse** is a real failure mode when disconnected near-best regions are averaged globally;
- connected-component topology around the best sample is a strong bounded repair;
- representative anchors can be useful adapters without becoming the semantic model.

Do not automatically preserve:

- 32×3 sampling as final resolution;
- current utility weights;
- current polar topology;
- shortlist size 12;
- current representative-point interface;
- any assumption that combat or multi-companion utility belongs directly inside this first field.

### 4.2 S3/R1 local velocity field — mechanical donor, semantics require rework

Useful preserved mechanics:

- omnidirectional candidate velocity sampling;
- multiple speed fractions;
- route-lookahead guidance;
- predicted player-relative clearance;
- explicit hard reject vs soft score terms;
- deterministic, inspectable candidate selection;
- hard-vs-comfort repair layer.

Open redesign questions:

- candidate speed authority must no longer be anchored to one fixed global behavioral max speed;
- player prediction must become part of a richer corridor/cooperation model;
- desired region utility should replace distance to one relationship point;
- temporal realization must not invalidate the dynamic cooperation contract;
- current semantic labels HOLD/ADVANCE/SIDESTEP/BACKOFF are useful debug descriptions, not a coordination architecture.

---

## 5. Proposed responsibility skeleton

This is a responsibility map, not a module list.

### 5.1 Coordination observation / situated frame

Build the smallest factual frame needed to reason about the player-companion relationship at active-play timescales.

Likely evidence:

- player position, requested/actual velocity and short recent motion history;
- companion position, actual/requested velocity and physical capability;
- current separation and relative velocity;
- static route/topology state;
- current relationship-region evidence;
- local hard/comfort feasibility;
- recent coordination outcome / progress state;
- current command or higher-level intent modifiers later.

Do not silently grant omniscience beyond the laboratory’s intended situated evidence.

### 5.2 WHERE — relationship region / spatial utility field

Output should describe **where it is useful to be**, not command a motor target directly.

Candidate utility dimensions for research:

- desired distance band rather than one radius;
- interference with the player’s likely movement corridor;
- companion travel cost;
- route/topology cost;
- static comfort/clearance;
- continuity of the current coherent region;
- player-facing obstruction / front-crossing cost;
- future role/command/combat modifiers through explicit inputs rather than hidden coupling.

Primary semantic object:

> one or more coherent acceptable regions with utility/evidence, plus continuity identity.

A representative anchor may be generated only as an adapter where the existing static router still requires a point target.

### 5.3 PACE — temporal relationship and desired speed authority

PACE should answer **how urgently and how quickly the companion should change the relationship**, independently from exact steering direction.

Research variables should include:

- separation from the current useful region;
- whether the region itself is moving;
- player speed and persistence of motion;
- route remaining distance;
- recent loss/recovery of proximity;
- obstruction/yield state;
- overshoot risk near settle;
- bounded catch-up reserve above ordinary follow pace.

Do not canonize discrete `settle/follow/catch-up/recover` states prematurely. They are useful diagnostic labels, but the underlying authority may work better as continuous pressure/envelopes with explicit thresholds only where needed.

Critical distinction:

> actor physical speed capability ≠ ordinary preferred pace ≠ temporary catch-up allowance ≠ final executable command.

### 5.4 PLAYER COOPERATION — predicted corridor and right-of-way

The player is not just another circular dynamic obstacle.

CCC should reason about a short-horizon **player movement corridor**: a swept, uncertainty-aware region representing likely near-future player occupancy.

Questions to research:

- when should the companion strongly avoid entering that corridor?
- when is brief crossing acceptable?
- when should it yield, hold, sidestep or back off?
- how should chokepoint contention be detected from route/corridor interaction?
- how quickly should yielding be released when the player clears?
- how should deliberate physical contact or future combat proximity differ from accidental obstruction?

Do not freeze “player always has hard right-of-way” as a universal rule. The initial non-combat follow context can strongly prefer player priority while preserving an explicit path for later intentional close-contact semantics.

### 5.5 LOCAL COORDINATION REALIZATION — joint direction + speed selection

This layer translates WHERE + PACE + PLAYER COOPERATION + route/static feasibility into a local preferred velocity family.

Current S3 velocity sampling is a strong donor because it already evaluates direction and speed together. The redesign should replace target-point distance with region utility and replace fixed-speed semantics with explicit pace authority.

Hard constraints should remain distinguishable from soft utility.

Candidate hard reasons may include:

- hard static illegality;
- no valid egress from true hard overlap;
- dynamic player-conflict contract where the current cooperation policy marks the conflict forbidden.

Candidate soft costs may include:

- region utility loss;
- player corridor intrusion where avoidance is preferred but not absolute;
- comfort clearance;
- route deviation;
- temporal discontinuity;
- unnecessary motion;
- pace error / failure to catch up.

### 5.6 TEMPORAL REALIZATION — motion quality without authority violation

NATURAL motion quality remains valuable, but temporal smoothing must no longer be allowed to silently invalidate the same constraints that justified the preferred velocity.

Families to compare experimentally:

1. constraint-aware temporal controller that shapes motion inside the currently feasible velocity set;
2. ordinary temporal shaping followed by dynamic/static revalidation and safe fallback;
3. bounded hybrid where urgency/right-of-way can deliberately relax continuity before a hard fallback becomes necessary.

Preserve R1-5A as the canonical falsifier.

Do not choose the family from aesthetics alone. Measure cooperation correctness and motion-quality cost.

### 5.7 WORLD OUTCOME + coordination feedback

World remains authoritative for what physically happened.

Post-World feedback should update coordination evidence using facts such as:

- actual displacement/velocity;
- contact and player disturbance;
- progress toward/inside the selected region;
- route state changes;
- whether a yield/conflict episode resolved;
- whether catch-up pressure actually reduced separation;
- whether local retry/reconsideration was productive.

Existing progress/recovery is a donor and defended substrate, but its target-point assumptions may need adapters when region semantics receive authority.

---

## 6. Cadence model to investigate

Do not force every layer onto one update cadence.

Current evidence suggests a useful separation:

- **World / temporal realization:** 60 Hz fixed step;
- **local coordination realization:** approximately 20 Hz is already mechanically viable as a starting point;
- **expensive relationship-region/topology reconsideration:** approximately 10 Hz is already mechanically viable as a starting point;
- **event-driven immediate reconsideration:** may be needed when region validity, hard egress or acute player conflict changes materially.

These are starting hypotheses, not final constants.

The key architectural rule is that slow strategic reconsideration must not make fast player-cooperation safety stale.

---

## 7. First debug contract

CCC must be explainable from its first authoritative experiment.

### WHERE

Expose:

- broad field samples / validity;
- utility terms;
- route-qualified shortlist;
- coherent region membership;
- selected region identity and continuity;
- representative adapter anchor when one exists;
- reason for region switch / loss.

### PACE

Expose:

- current separation from useful region;
- ordinary preferred pace;
- catch-up/urgency pressure;
- allowed speed envelope/capability;
- reason for acceleration, settling or slowing.

### PLAYER COOPERATION

Expose:

- predicted player corridor;
- prediction horizon/uncertainty;
- candidate corridor conflicts;
- current right-of-way/cooperation reason;
- yield/conflict episode state and release reason.

### REALIZATION

Expose:

- candidate direction + speed field;
- hard rejects vs soft costs;
- preferred velocity;
- temporally shaped command;
- final revalidation/fallback if any;
- actual velocity after World.

### OUTCOME

Expose:

- progress toward/in selected region;
- player displacement/contact consequence;
- catch-up effectiveness;
- recovery/reconsideration action;
- causal chain for the current frame.

Player-facing behavior readability and Owner/debug readability remain separate concerns.

---

## 8. Experimental campaign skeleton

Implementation should be bounded, but the design question is integrated. Each stage is re-planned before execution.

### CCC-0 — contract and shadow-frame instrumentation

Goal: establish the new causal vocabulary without changing public movement authority.

Build/validate shadow evidence for:

- region field/coherent components;
- pace pressure;
- predicted player corridor;
- candidate coordination conflicts.

Keep legacy movement authoritative.

Gate: evidence must be stable, deterministic where expected, visually legible and capable of representing known failures.

### CCC-1 — region + pace authority under simplest realization

Promote new WHERE and PACE while minimizing temporal confounders.

Prefer DIRECT or otherwise deliberately simple realization first so region/pace quality can be judged independently from NATURAL smoothing.

Compare against eight-slot baseline.

### CCC-2 — explicit player cooperation / right-of-way authority

Introduce corridor-aware cooperation in representative situations:

- cross-front movement;
- same-direction doorway following;
- opposite-direction chokepoint contention;
- player stop/reverse;
- companion slightly ahead of player;
- player pressure/push/release near static geometry.

Qualification must measure player disturbance, not merely companion survival.

### CCC-3 — temporal realization redesign and R1-5A closure

Reintroduce/replace NATURAL motion quality only after the upstream coordination contract is credible.

Exact R1-5A red fixture becomes a required promotion test.

Goal: temporal smoothness must preserve final coordination legality or expose an explicit constrained fallback with bounded motion-quality cost.

### CCC-4 — integrated one-companion Owner campaign

Stress unscripted play across open space, pillars, doorways and repeated reversals.

Primary questions:

- does the companion feel less arbitrary?
- can it actually catch up without rubber-banding?
- does it stay out of the player’s way without becoming timid/useless?
- are its region changes understandable?
- does it recover naturally after separation/contention?
- does motion remain stable under long free play?

Only after this should the project decide what becomes the next durable foundation for commands/combat/few-companion work.

---

## 9. Required falsifiers / scenarios

At minimum preserve or add deterministic/controlled cases for:

- open-space sustained player travel where equal ordinary pace creates separation;
- large initial separation and bounded catch-up;
- arrival/settle without jitter around the useful region;
- abrupt player reversal;
- repeated left-right reversals;
- player crossing directly in front of companion;
- companion positioned ahead of player and forced to vacate flow;
- same-direction doorway entry;
- opposite-direction doorway contention;
- doorway stop/release;
- pillar-induced region split / topology change;
- region invalidation while moving;
- push toward wall then release;
- true hard-overlap egress;
- exact R1-5A dynamic final-command conflict reproduction;
- long free-running torture without freeze/shutdown/recovery thrash.

Later combat/contact semantics should add new scenarios rather than weakening these non-combat cooperation falsifiers silently.

---

## 10. Metrics worth collecting

No single scalar should define companion quality.

Mechanical/causal metrics:

- time outside useful relationship region;
- recovery time after separation;
- maximum/mean separation during sustained player travel;
- time spent in catch-up pressure;
- player-corridor conflict count/duration;
- player contact frames caused by companion command;
- measurable player displacement / motion error from unwanted contact;
- region switch frequency and disconnected-region thrash;
- hold/yield duration and successful resume;
- route invalid/unreachable duration;
- command vs actual velocity divergence;
- acceleration/jerk/discontinuity around dynamic fallback;
- local retry/reconsideration frequency;
- catastrophic fault / freeze / permanent shutdown count.

Owner judgement remains essential for:

- trust;
- apparent intention;
- obstruction annoyance;
- rubber-band feel;
- naturalness/readability;
- whether initiative feels useful rather than random.

Automated PASS cannot substitute for the Owner gate on those questions.

---

## 11. Stop / escalation conditions

Pause the current approach instead of weight-tuning around it if evidence shows any of the following:

- coherent regions cannot remain stable enough under ordinary player motion;
- representative-point routing repeatedly destroys region semantics;
- current static router cannot support region/topology queries without pathological churn;
- current local velocity lattice cannot express needed pace/cooperation behavior without combinatorial or responsiveness problems;
- constraint-aware temporal realization becomes more complex/fragile than replacing the current continuity controller;
- player-corridor prediction produces systematic false yielding or obstruction that cannot be bounded by reasonable horizons/uncertainty;
- progress/recovery cannot be adapted cleanly from point targets to region objectives;
- CCC responsibilities leak so heavily into `R1LabScene` that the workbench becomes architecture again.

Any such finding can justify changing a previously defended seam, but the burden is explicit evidence.

---

## 12. Explicit non-goals for this redesign phase

Do not let CCC planning silently expand into:

- full combat AI;
- weapon selection;
- threat planner architecture;
- final command grammar;
- multi-companion squad hierarchy;
- LLM integration;
- generic Utility AI / BT / GOAP framework selection;
- navmesh/crowd middleware adoption by default;
- shared package extraction with `Llm-Live-NPC`;
- production/shipping character controller design.

The design should leave clean future inputs for those systems without implementing them now.

---

## 13. Current-best architectural hypothesis

The strongest current hypothesis is:

`World/situated evidence`

→ **Coordination observation**

→ **WHERE: coherent useful region**

+ **PACE: temporal relationship / desired speed authority**

+ **PLAYER COOPERATION: predicted corridor / right-of-way semantics**

→ **route/topological projection where required**

→ **local joint direction+speed realization**

→ **constraint-aware temporal realization / final coordination validation**

→ **World/Rapier truth**

→ **progress/recovery + coordination outcome**

→ **causal evidence**.

This is intentionally a skeleton, not a class diagram.

The most important design principle is that **space, pace and cooperation must meet before the final movement command**, while World remains the authority on what actually happened.

---

## 14. Immediate next research move

Before behavior authority changes:

1. recover the S5 field implementation as a donor against current `main` rather than merging the old branch;
2. design a shadow `CoordinationFrame` capable of carrying region, pace and player-corridor evidence without forcing a final public API;
3. build exact falsifiers for sustained catch-up and player-corridor contention alongside the preserved R1-5A case;
4. expose the new evidence in the causal workbench;
5. only then decide the first authority promotion slice.

This keeps the next implementation aggressive in direction but bounded in evidence.
