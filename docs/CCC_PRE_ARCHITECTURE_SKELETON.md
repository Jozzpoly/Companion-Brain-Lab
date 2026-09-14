# Companion Coordination Core — Pre-Architecture Skeleton

Status: **PLANNING ONLY · NO RUNTIME AUTHORITY · FOUNDATION-PRESERVING REWORK FRAME**

Base foundation:

`681c8fd3c2fd9b460d59a65148fe066dd65ca2cb`

Canonical substrate verdict:

`docs/FOUNDATION_FINAL_READINESS.md` — **FOUNDATION PASS · REWORK-READY**

This document begins the post-foundation Companion Coordination Core (CCC) redesign. It is deliberately a **pre-architecture skeleton**, not a final architecture specification. It defines responsibilities, evidence boundaries, donor findings, falsifiers and a safe rework path before new behavior receives authority.

Every implementation stage must be re-planned against current evidence. Nothing below earns permanent authority merely by being written here.

---

## 1. Why CCC exists

The foundation campaign solved substrate survival and causal reliability. CCC attacks a different class of problem: **coordination quality**.

The current foundation can survive hard overlap/egress, route loss, candidate exhaustion, bounded recovery and catastrophic runtime faults without turning ordinary gameplay states into silent shutdowns. That does **not** make the current companion good.

Material limitations intentionally promoted into CCC:

- the legacy eight-slot relationship objective is too crude;
- relationship semantics collapse too early into one point target;
- the companion lacks explicit pace / urgency / catch-up authority;
- player right-of-way, predicted movement corridor and chokepoint cooperation are not first-class;
- NATURAL temporal realization can invalidate an upstream player-safe movement decision;
- `MotionIntent { move: Vec2 }` and one fixed experiment speed are too narrow for the next behavior class;
- `R1LabScene` currently owns too much semantic glue between relationship, route, motion, World and recovery.

CCC is therefore **not** “S6: better slots”. It is a deliberate replacement of coordination semantics above the defended World/physics/safety substrate.

---

## 2. Foundation boundary

### Preserve by default unless new evidence falsifies it

- World as factual simulation authority;
- Rapier as the current physical/contact/query kernel behind World;
- fixed-step world progression;
- hard physical feasibility distinct from desired/comfort clearance;
- explicit hard-egress semantics;
- static routing/topology contracts and live-start egress behavior;
- ordinary constrained states represented as data rather than exceptions;
- post-World progress/recovery observation;
- causal trace separating decision → command → World outcome → post-outcome interpretation;
- catastrophic fail-stop sentinel;
- MANUAL / deliberately simple baselines where they remain useful for comparison.

### Explicitly open to aggressive redesign

- eight-slot relationship objective;
- player-relative spatial representation;
- pace / urgency / catch-up authority;
- fixed experiment speed as behavioral authority;
- `MotionIntent` shape / desired-speed contract;
- player movement corridor / right-of-way / chokepoint cooperation;
- ordering between coordination policy and temporal realization;
- NATURAL continuity implementation;
- scene-level orchestration responsibilities;
- later multi-companion, command and combat-facing inputs.

A defended seam may still be replaced, but the reason must be new evidence rather than convenience.

---

## 3. Evidence recovered before architecture selection

### 3.1 Point-target bottleneck

`RelationalPositioningBrain` ultimately produces a single `target: Vec2`. Route and local movement therefore receive one point even when the semantic desire is really a broad acceptable area around the player.

This makes arbitrary target switching, path crossing and player obstruction too easy to create.

**Current conclusion:** the semantic object should become a **coherent useful region / field**. A representative point may survive temporarily as an adapter for existing routing, but it must not become the new canonical meaning.

### 3.2 Speed/intent bottleneck

Current `MotionIntent` contains only `move: Vec2`. The S3/R1 local mover samples speed fractions, but every candidate is ultimately scaled against one experiment max speed.

This cannot cleanly express the distinction between:

- physical movement capability;
- ordinary preferred follow pace;
- temporary catch-up allowance;
- urgency / recovery pressure;
- final executable velocity.

The exact replacement contract remains open.

### 3.3 S5 field donor

Historical S5 demonstrated a useful bounded relationship-field substrate:

- broad cheap spatial sampling before expensive route qualification;
- route-aware shortlist evaluation;
- explicit utility terms;
- coherent good-region reasoning;
- representative anchor only as an adapter.

Its critical falsification was **centroid collapse**: globally averaging disconnected near-best regions produced an absurd anchor near the player center. The repair was topological, not a weight tweak — retain only the connected good component containing the best sample before interpolation.

Preserve the finding, not the constants. Do not canonize S5’s 32×3 sampling, weights, shortlist size, polar topology or representative-point interface.

### 3.4 S3/R1 local velocity donor

The existing local mover is not disposable. It already demonstrates:

- omnidirectional velocity candidate sampling;
- multiple speed fractions;
- route-lookahead guidance;
- predicted player-relative clearance;
- explicit hard rejection vs soft score terms;
- deterministic inspectable selection;
- hard-vs-comfort repair and egress handling.

The redesign should reuse these mechanics where they remain valid while replacing point-target and fixed-speed semantics.

### 3.5 Recovered R1-5A player-authority donor — mechanically qualified, never Owner-promoted

Deeper donor recovery changed the initial CCC picture materially.

Historical branch:

`planning/r1-5-player-conflict-authority`

Qualified experimental checkpoint:

`c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`

Qualification status in that branch:

**MECHANICAL QUALIFICATION PASS · OWNER BROWSER EVIDENCE NOT RUN · NOT MERGED TO MAIN**

The experiment added a separate final player physical-authority boundary after NATURAL continuity and the existing static final gate.

Most important finding: **broad cooperation/comfort policy and hard physical player authority are different responsibilities.**

The attempted broad final envelope reused the S3 `0.55 s` horizon plus `0.18 m` player comfort buffer. It was falsified as a hard final gate: clean moving-player cases triggered excessive emergency intervention or lost useful progress. That would turn an emergency boundary into a second steering system.

The mechanically qualified alternative used:

- only next-physics-step physical prediction;
- body radii plus a tiny `0.002 m` numerical hard margin;
- explicit egress semantics when already touching/overlapping;
- projection of an unsafe final command toward already player-aware upstream preferred motion;
- static hard-safety preservation during repair;
- fallback to preferred/stop/best-effort only when necessary;
- reset of NATURAL local temporal history when final authority alters the command.

In the original material NATURAL failure fixture, this guard removed measurable player disturbance with only rare interventions while preserving useful companion progress. In clean moving-player matrix cases it typically did not intervene at all.

This is **strong donor evidence**, not current authority, because no Owner/browser gate was run and the branch was never merged.

### 3.6 Resulting two-level player interaction invariant

CCC must not collapse all “player safety” into one mechanism.

**Level A — cooperation policy / comfort / right-of-way (upstream):**

- predicted player corridor;
- preferred passing side / yielding behavior;
- front-crossing and obstruction costs;
- chokepoint semantics;
- comfort spacing;
- intentional vs unwanted proximity;
- motion readability and useful progress.

This layer should shape normal behavior continuously.

**Level B — physical player-agency guard (downstream):**

- rare emergency authority over the final realized command;
- protects against the companion materially taking control away from the player;
- short physical horizon;
- egress-aware;
- must remain compatible with static hard safety;
- should not become ordinary steering.

A high intervention rate from Level B in otherwise clean play is itself a failure signal: upstream cooperation or temporal realization is not doing its job.

This responsibility split is now a **design invariant backed by experiment**, unless future evidence falsifies it.

---

## 4. Proposed responsibility skeleton

This is a responsibility map, not a class diagram or frozen module tree.

### 4.1 Coordination observation / situated frame

Build the smallest factual frame needed to reason about the player-companion relationship at active-play timescales.

Likely evidence:

- player position, requested/actual velocity and short recent motion history;
- companion position, requested/actual velocity and physical capability;
- current separation and relative velocity;
- route/topology state;
- relationship-region evidence;
- local hard/comfort feasibility;
- recent coordination outcome / progress state;
- later command / role modifiers through explicit inputs.

Do not silently grant omniscience beyond the laboratory’s intended situated evidence.

### 4.2 WHERE — coherent useful region

WHERE answers **where it is useful for the companion to be**, without directly commanding a motor target.

Candidate utility dimensions:

- desired distance band rather than one fixed radius;
- interference with likely player movement corridor;
- companion travel cost;
- route/topology cost;
- static comfort/clearance;
- continuity of the current coherent region;
- player-facing obstruction / front-crossing cost;
- future role/command/combat modifiers through explicit inputs.

Primary semantic object:

> one or more coherent acceptable regions with utility/evidence and continuity identity.

A representative route target may be generated as an adapter while the router still requires a point.

### 4.3 PACE — temporal relationship / desired-speed authority

PACE answers **how urgently and how quickly the companion should change the relationship**, independently from exact steering direction.

Research variables:

- distance from the useful region;
- motion of the region itself;
- player speed and persistence;
- route remaining distance;
- recent separation / recovery history;
- yield/conflict state;
- overshoot risk near settle;
- bounded catch-up reserve above ordinary follow pace.

Diagnostic labels such as `settle / follow / catch-up / recover` may be useful, but should not be canonized as execution modes before evidence requires them.

Critical distinction:

> physical capability ≠ ordinary preferred pace ≠ catch-up allowance ≠ final executable command.

### 4.4 PLAYER COOPERATION — corridor, right-of-way and constrained passage

The player is not merely another circular dynamic obstacle.

CCC should reason about a short-horizon **player movement corridor**: a swept, uncertainty-aware region representing likely near-future occupancy and flow.

Questions to research:

- when should the companion strongly avoid entering that corridor?
- when is a brief crossing acceptable?
- when should it yield, hold, sidestep or back off?
- how should same-direction and opposite-direction chokepoint contention differ?
- how quickly should yielding release when the player clears or reverses?
- how should intentional close contact later differ from accidental obstruction?

Do not freeze “player always has hard right-of-way” as a universal rule. Initial non-combat following can strongly prefer player priority while leaving a clean path for future intentional close-contact semantics.

### 4.5 LOCAL COORDINATION REALIZATION — joint direction + speed

This layer combines WHERE + PACE + PLAYER COOPERATION + route/static feasibility into a local preferred velocity family.

Current S3 velocity sampling is a strong donor because it already chooses direction and speed jointly.

Redesign goals:

- region utility replaces distance to one relationship point;
- pace authority replaces one fixed behavioral speed ceiling;
- hard constraints stay distinguishable from soft utility;
- output remains inspectable as candidate evidence, not a black-box vector.

Possible hard reasons:

- hard static illegality;
- no valid egress from true hard overlap;
- a dynamic conflict explicitly forbidden by the current cooperation contract.

Possible soft costs:

- region utility loss;
- player-corridor intrusion;
- comfort clearance;
- route deviation;
- temporal discontinuity;
- unnecessary motion;
- pace error / failure to catch up.

### 4.6 TEMPORAL REALIZATION — motion quality without semantic authority drift

NATURAL motion quality remains valuable, but smoothing cannot silently invalidate the coordination decision that justified the preferred velocity.

Families worth comparing:

1. **constraint-aware temporal controller** — shape motion inside a currently admissible velocity set;
2. **temporal shaping + policy revalidation** — shape normally, then revalidate the final command against current coordination constraints and use a bounded preferred fallback;
3. **hybrid** — urgency/right-of-way can deliberately relax continuity before a hard fallback is needed.

Do not confuse normal cooperation revalidation with the rare physical player-agency guard.

The recovered R1-5A guard is now a concrete donor for the downstream emergency boundary. CCC-3 should compare transplant/adaptation against any new final guard rather than reinventing the responsibility from scratch.

### 4.7 FINAL HARD AUTHORITIES

After temporal realization, two independent hard responsibilities may remain:

1. **static physical authority** — existing defended final static command boundary;
2. **player physical-agency authority** — candidate transplant/adaptation of the qualified R1-5A emergency guard.

Ordering/composition must be tested so one repair does not reintroduce a violation rejected by the other.

These boundaries must stay rare during healthy cooperation. They are not substitutes for PLAYER COOPERATION.

### 4.8 WORLD OUTCOME + coordination feedback

World remains authoritative for what physically happened.

Post-World evidence should include:

- actual displacement / velocity;
- contacts and measurable player disturbance;
- progress toward / inside the useful region;
- route changes;
- whether a yield/conflict episode resolved;
- whether catch-up pressure reduced separation;
- whether local retry/reconsideration was productive;
- whether a final hard authority intervened and whether upstream behavior subsequently adapted.

Existing progress/recovery is a strong donor and defended substrate, but point-target assumptions may need adapters for region objectives.

---

## 5. Current-best authority chain

Current strongest hypothesis:

`World / situated evidence`

→ **Coordination observation**

→ **WHERE: coherent useful region**

+ **PACE: temporal relationship / desired speed authority**

+ **PLAYER COOPERATION: corridor / right-of-way / chokepoint policy**

→ **route/topological projection where required**

→ **local joint direction + speed realization**

→ **temporal realization with coordination semantics preserved**

→ **final static hard authority**

→ **rare final player physical-agency authority**

→ **World / Rapier truth**

→ **progress/recovery + coordination outcome**

→ **causal evidence**.

This is intentionally a skeleton, not a class diagram.

The central rule is:

> **space, pace and cooperation must meet before the final movement command; hard emergency boundaries protect physical authority but must not become ordinary steering.**

---

## 6. Cadence hypotheses

Do not force every responsibility onto one cadence.

Useful starting hypotheses from existing evidence:

- **World / temporal realization / final physical guards:** 60 Hz fixed step;
- **local coordination realization:** ~20 Hz is already mechanically viable as a starting point;
- **expensive region/topology reconsideration:** ~10 Hz is already mechanically viable as a starting point;
- **event-driven immediate reconsideration:** material region invalidation, hard egress or acute player conflict may require it.

These are not final constants.

A slower strategic cadence must never make fast physical safety or acute cooperation stale.

---

## 7. Debug/evidence contract

CCC must be explainable from its first experiment.

### WHERE

Expose:

- broad field samples / validity;
- utility terms;
- route-qualified shortlist;
- coherent-region membership;
- selected region identity and continuity;
- representative adapter anchor when used;
- reason for region switch / loss.

### PACE

Expose:

- current separation from useful region;
- ordinary preferred pace;
- catch-up / urgency pressure;
- physical speed capability / current allowed envelope;
- reason for acceleration, settling or slowing.

### PLAYER COOPERATION

Expose:

- predicted player corridor;
- horizon / uncertainty;
- candidate corridor conflicts;
- current cooperation/right-of-way reason;
- yield/conflict episode state and release reason.

### REALIZATION

Expose:

- candidate direction + speed field;
- hard rejects vs soft costs;
- preferred velocity;
- temporally shaped command;
- any policy-level revalidation/fallback.

### FINAL HARD AUTHORITIES

Expose separately:

- static hard authority source/reason;
- player physical-agency authority source/reason;
- original vs final physical clearance;
- intervention magnitude;
- whether the intervention reset temporal state.

### OUTCOME

Expose:

- actual velocity / displacement;
- progress toward/in selected region;
- player displacement / motion error;
- catch-up effectiveness;
- recovery/reconsideration action;
- causal chain for the frame.

Player-facing readability and Owner/debug readability remain separate concerns.

---

## 8. Experimental campaign skeleton

Implementation should remain bounded, but each stage is re-planned from fresh evidence.

### CCC-0 — shadow CoordinationFrame + observability

Goal: establish the new causal vocabulary without changing movement authority.

Build/validate shadow evidence for:

- coherent relationship region;
- pace pressure / catch-up demand;
- predicted player corridor;
- candidate cooperation conflicts;
- recovered R1-5A physical-agency guard evidence as an offline/reference donor, not live authority.

Keep legacy movement authoritative.

Gate: evidence must be stable, deterministic where expected, visually legible and capable of representing known failure cases.

### CCC-1 — WHERE + PACE authority under simple realization

Promote new region and pace semantics while minimizing temporal confounders.

Prefer DIRECT or another deliberately simple realization first so relationship/pace quality can be judged independently from NATURAL smoothing.

Compare against the legacy eight-slot baseline.

### CCC-2 — PLAYER COOPERATION authority

Introduce corridor-aware cooperation in representative situations:

- cross-front movement;
- same-direction doorway following;
- opposite-direction chokepoint contention;
- player stop/reverse;
- companion slightly ahead of player;
- player pressure/push/release near static geometry.

Qualification must measure player disturbance and useful progress, not merely companion survival.

The emergency physical-agency guard must not be used to hide poor cooperation.

### CCC-3 — temporal realization + final-authority composition

Only after upstream coordination is credible, redesign/reintroduce NATURAL motion quality.

Required work:

- preserve coordination legality through temporal shaping;
- replay the exact historical R1-5A material fixture;
- compare adaptation/transplant of the mechanically qualified R1-5A guard against any alternative downstream guard;
- verify static and player hard authorities compose without repair ping-pong;
- measure emergency intervention rate and correction magnitude;
- reject designs where the emergency guard becomes routine steering.

### CCC-4 — integrated one-companion Owner campaign

Stress unscripted play across open space, pillars, doorways, repeated reversals and prolonged free movement.

Primary questions:

- does the companion feel less arbitrary?
- can it genuinely catch up without rubber-banding?
- does it stay out of the player’s flow without becoming timid/useless?
- are region changes understandable?
- does yielding release naturally?
- does it recover after separation/contention?
- does NATURAL movement remain stable without frequent emergency correction?
- does long free play remain foundation-stable?

Only after this should the project decide what becomes the durable base for commands, combat and one→few companions.

---

## 9. Required falsifiers / scenarios

At minimum preserve or add controlled cases for:

- sustained open-space player travel where equal ordinary pace creates separation;
- large initial separation and bounded catch-up;
- settle inside useful region without jitter;
- abrupt player reversal;
- repeated left/right reversals;
- player crossing directly in front of companion;
- companion ahead of player and forced to vacate flow;
- same-direction doorway entry/following;
- opposite-direction doorway contention;
- doorway stop/release;
- pillar-induced region split / topology change;
- region invalidation while moving;
- push toward wall then release;
- true hard-overlap egress;
- exact historical R1-5A abrupt-turn material player-disturbance fixture;
- static + player authority same-frame composition;
- moving-player head-on/cross-front/reversal non-interference cases;
- long free-running torture without freeze/shutdown/recovery thrash.

Later combat/contact semantics should add new cases rather than silently weakening these non-combat cooperation falsifiers.

---

## 10. Metrics worth collecting

No single scalar defines companion quality.

Mechanical/causal metrics:

- time outside useful relationship region;
- recovery time after separation;
- maximum/mean separation during sustained travel;
- time spent under catch-up pressure;
- player-corridor conflict count/duration;
- unwanted player contact frames;
- measurable player displacement / motion error caused by the companion;
- region switch frequency / disconnected-region thrash;
- hold/yield duration and successful resume;
- route invalid/unreachable duration;
- command vs actual velocity divergence;
- acceleration / jerk / discontinuity around fallbacks;
- local retry/reconsideration frequency;
- **player physical-agency guard intervention rate**;
- **maximum/mean physical guard correction magnitude**;
- static/player hard-authority composition conflicts;
- catastrophic fault / freeze / permanent shutdown count.

Interpretation rule:

> frequent emergency physical-agency interventions in nominal play are evidence of an upstream cooperation or temporal-realization defect, not evidence that the guard is “working well”.

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
- current local velocity lattice cannot express pace/cooperation without combinatorial or responsiveness problems;
- progress/recovery cannot adapt cleanly from point targets to region objectives;
- player-corridor prediction creates systematic false yielding/obstruction that reasonable horizons cannot bound;
- temporal realization repeatedly forces the downstream player physical guard to intervene;
- the historical R1-5A guard cannot compose cleanly with the redesigned speed contract or static authority;
- constraint-aware temporal realization becomes more fragile than replacing the continuity controller;
- CCC responsibilities leak so heavily into `R1LabScene` that the workbench becomes architecture again.

Any such finding may justify changing a previously defended seam, but the burden is explicit evidence.

---

## 12. Explicit non-goals for this redesign phase

Do not silently expand CCC into:

- full combat AI;
- weapon selection;
- threat planner architecture;
- final command grammar;
- multi-companion squad hierarchy;
- LLM integration;
- generic Utility AI / BT / GOAP framework selection;
- navmesh/crowd middleware adoption by default;
- shared-package extraction with `Llm-Live-NPC`;
- production/shipping character-controller design.

The design should leave clean future inputs for those systems without implementing them now.

---

## 13. Immediate next research move

Before any behavior authority changes:

1. transplant/re-express the useful S5 relationship-field donor against current `main` as **shadow evidence**, not by merging its historical branch;
2. define a provisional shadow `CoordinationFrame` carrying region, pace and player-corridor evidence without freezing the final public API;
3. preserve the qualified historical R1-5A player physical-authority experiment as a named donor/falsifier, not current authority;
4. build exact catch-up and corridor-contention falsifiers alongside the historical R1-5A fixture;
5. expose all new evidence in the causal workbench;
6. only then decide the first authority-promotion slice.

This keeps the next implementation aggressive in direction but bounded by evidence.