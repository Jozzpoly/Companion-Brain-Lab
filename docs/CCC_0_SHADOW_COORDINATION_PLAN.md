# CCC-0 — Shadow Coordination Frame Plan

Status: **STAGE PLAN · NO MOVEMENT AUTHORITY**

Parent frame:

`docs/CCC_PRE_ARCHITECTURE_SKELETON.md`

External challenge/research:

`docs/CCC_EXTERNAL_NAVIGATION_RESEARCH.md`

Base foundation:

`681c8fd3c2fd9b460d59a65148fe066dd65ca2cb`

---

## 1. Stage question

Before changing how the companion moves, can the current runtime continuously produce a reliable, inspectable explanation of:

1. **WHERE** it would prefer the companion to exist as a coherent player-relative region;
2. **PACE** how much temporal pressure exists to settle, follow or catch up;
3. **PLAYER COOPERATION** what near-future space the player is likely to use and where companion motion would interfere;
4. how those new signals compare with the still-authoritative legacy target/motion on the **same tick**?

CCC-0 is successful only if those signals become useful research evidence **without changing submitted companion motion**.

---

## 2. Hard stage boundary

CCC-0 may:

- add pure/deterministic shadow evaluators;
- selectively transplant/re-express S5 field ideas against current `main` contracts;
- maintain small shadow-only temporal state such as previous region identity or bounded player-motion history;
- add tests and controlled fixtures;
- add debug overlays/panel sections;
- extend causal incident evidence with explicitly shadow-labelled data;
- add metrics derived from shadow evidence.

CCC-0 must **not**:

- replace the legacy relationship target;
- change the route target used by authoritative movement;
- change DIRECT/NATURAL selected motion;
- change World inputs;
- alter physical actor speed;
- install the historical R1-5A player hard guard as live authority;
- add command/combat/multi-companion behavior;
- merge historical S5/R1-5 branches wholesale.

A regression test should explicitly defend this zero-authority property.

---

## 3. Provisional shadow data vocabulary

These names are intentionally provisional. They describe evidence responsibilities, not a frozen public API.

### 3.1 `ShadowRelationshipRegion`

Minimum useful evidence:

- evaluation tick;
- player position and observed direction;
- companion position/radius;
- bounded field sample set;
- each sample’s local validity;
- utility decomposition;
- whether route qualification was attempted;
- route status/cost when evaluated;
- coherent-component identity/membership;
- best sample;
- representative adapter anchor, if available;
- explicit reason when no coherent reachable region exists;
- previous/current region relationship for continuity evidence.

Important semantic rule:

> representative anchor is debug/router adapter evidence; **the region is the relationship model**.

### 3.2 `ShadowPaceEvidence`

Minimum useful evidence:

- physical companion speed capability;
- observed player speed;
- distance from companion to the useful region, not only distance to representative point;
- route distance when meaningful;
- current relative closing/opening speed;
- whether the region is moving away from the companion;
- normalized urgency / catch-up pressure;
- provisional desired pace or desired-speed envelope;
- diagnostic label such as `SETTLED`, `FOLLOWING`, `CATCH_UP`, `RECOVERING` only as explanation;
- reason/decomposition.

The diagnostic label must not become an FSM contract during CCC-0.

### 3.3 `ShadowPlayerCorridor`

Minimum useful evidence:

- player current position/radius;
- observed motion vector;
- short prediction horizon;
- predicted endpoint;
- corridor width / physical and comfort envelopes kept distinguishable;
- motion confidence/persistence evidence;
- whether the player is effectively stationary;
- recent direction-change/reversal evidence where available;
- explicit corridor reason.

First implementation should remain geometric and deterministic. No learned predictor.

### 3.4 `ShadowCoordinationFrame`

Aggregates the above for one decision tick plus comparison evidence:

- legacy relationship state/target;
- legacy local preferred velocity;
- shadow region;
- shadow pace;
- shadow player corridor;
- obvious legacy-vs-shadow disagreements;
- no authoritative output command.

The frame should be cheap to clone/export and self-describing enough to survive incident capture.

---

## 4. WHERE implementation hypothesis for CCC-0

Use S5 as donor, but re-express it against current foundation contracts rather than copying the old branch unchanged.

### Preserve

- bounded broad sampling;
- cheap local evaluation before route cost;
- bounded route-qualified shortlist;
- coherent connected good region containing the best reachable sample;
- centroid-collapse protection;
- deterministic tie-breaking;
- representative anchor revalidation.

### Rework immediately

- use current static geometry/query contracts instead of S5-local duplicated geometry where practical;
- keep hard physical point validity separate from desired comfort quality;
- expose sample utility terms as evidence rather than hiding them in one score;
- give region continuity an identity/evidence model rather than only previous-point distance;
- reserve explicit slots for player-corridor terms, but do not let them become authoritative during CCC-0.

### Do not optimize yet

Sampling resolution, radii, score weights and shortlist count remain experiment constants.

The initial goal is **diagnostic richness and falsifiability**, not tuning the perfect follow region.

---

## 5. PACE implementation hypothesis for CCC-0

The first pace model should be deliberately simple enough to inspect.

Candidate inputs:

- shortest distance to any qualified point/region sample;
- route distance to region adapter where route evidence exists;
- player speed;
- relative separation trend;
- recent duration outside the good region;
- recent yield/blocking state only after that evidence exists.

Candidate output:

- continuous `urgency` in `[0,1]`;
- provisional desired speed in world units or an explicit speed envelope;
- explanation terms.

Important falsifier:

> two situations with the same geometric separation but different player motion should not necessarily receive the same pace pressure.

Examples:

- player stationary 2 m away;
- player steadily moving away 2 m away;
- player rapidly reversing toward companion 2 m away.

The third case must not blindly produce maximum catch-up because raw distance is large.

---

## 6. PLAYER CORRIDOR implementation hypothesis for CCC-0

Start with a deterministic swept-capsule style representation around predicted player motion.

Do not begin with a single long fixed ray.

Candidate evidence:

- velocity source: meaningful actual velocity, otherwise requested velocity;
- speed-dependent horizon bounded to a short interval;
- player physical radius as the hard geometric core;
- separate comfort/right-of-way expansion;
- confidence reduced by low speed, recent reversal or unstable heading;
- corridor shortened/softened as confidence drops.

### Critical distinction

The shadow corridor is **cooperation policy evidence**, not the downstream physical-agency boundary.

Historical R1-5A already falsified promoting a broad comfort envelope into a final hard gate.

---

## 7. Temporal evidence without premature state-machine architecture

CCC-0 needs some history, because purely instantaneous observations cannot distinguish persistent travel from twitching/reversal.

Keep history deliberately small and inspectable:

- a bounded recent player velocity/direction window;
- previous coherent region identity/evidence;
- time/ticks outside the useful region;
- optional previous corridor confidence.

Avoid:

- hidden long-lived behavioral modes;
- timers whose only job is to mask bad switching;
- large opaque history buffers;
- mixing movement actuator state into coordination state.

Region continuity, cooperation episode continuity and motor continuity are separate problems and should remain separately observable.

---

## 8. Workbench integration

### 8.1 New debug layer

Add a `coordination` world layer, default **off** initially to avoid overwhelming the existing foundation workbench.

When enabled, visualize at minimum:

- field samples with local/route qualification distinctions;
- coherent good region;
- best sample / representative adapter;
- player corridor hard core and comfort envelope;
- key disagreement between legacy target and shadow region where visually useful.

Avoid aesthetic polish. The visualization is research instrumentation.

### 8.2 Panel sections

Add collapsed-by-default sections:

**Coordination / WHERE**
- region state;
- best/coherent sample count;
- route-qualified count;
- representative adapter source;
- region switch/continuity evidence.

**Coordination / PACE**
- distance to region;
- player speed;
- separation trend;
- urgency;
- provisional desired pace;
- reason.

**Coordination / PLAYER**
- observed player velocity;
- corridor horizon/length;
- confidence;
- hard vs comfort width;
- reason.

### 8.3 Causal trace

Extend current causal decision/observation evidence rather than create a second trace system.

Shadow fields must be explicitly named/typed so incident exports cannot be mistaken for movement authority.

---

## 9. Automated evidence campaign

### 9.1 Pure determinism / invariants

Defend:

- identical snapshot/history/query evidence → identical shadow frame;
- finite values only;
- bounded sample and route-query counts;
- coherent region never spans disconnected near-best components;
- representative adapter cannot silently be unreachable/invalid;
- no reachable region becomes explicit data, not exception;
- stationary player produces a collapsed/low-confidence movement corridor rather than a fabricated direction.

### 9.2 S5 donor regressions

Recreate the valuable S5 falsifiers against current foundation:

- open-space region does not centroid-collapse into player center;
- pillar produces coherent topology-aware region rather than averaging across sides;
- oversized/unroutable passage does not create false reachable region;
- small heading changes do not cause pathological region teleporting.

Do not require exact historical S5 numeric outputs.

### 9.3 PACE falsifiers

At minimum:

- inside useful region + stationary player → low urgency;
- companion behind a steadily moving player → increasing catch-up pressure;
- large static separation → catch-up pressure but bounded desired speed;
- player reversal toward companion → urgency drops relative to same-distance moving-away case;
- approaching region → pressure declines before overshoot.

### 9.4 Corridor falsifiers

At minimum:

- stationary player;
- steady straight movement;
- abrupt 180° reversal;
- repeated left/right reversal;
- low-speed jitter;
- cross-front relative geometry;
- player moving toward companion;
- companion already ahead of player flow.

### 9.5 Zero-authority regression

For the same authoritative runtime input sequence:

- enabling/calculating shadow coordination must not alter companion `MotionIntent`;
- World snapshots/outcomes should remain identical within deterministic expectations;
- DIRECT/NATURAL debug values unrelated to shadow evidence should remain unchanged.

This is a promotion blocker, not a nice-to-have test.

---

## 10. Browser/Owner evidence gate for CCC-0

CCC-0 does not ask whether the new companion “feels better” because it still cannot control movement.

Owner/browser review should instead answer:

- Does the displayed region usually look like a place where a sensible companion **could** stand?
- When it looks wrong, can the overlay explain why?
- Does catch-up pressure rise/fall when expected during natural player motion?
- Does the corridor visually represent the player’s flow without wildly flickering?
- Do sudden reversals reduce prediction confidence quickly enough?
- Do doorway/pillar cases expose topology rather than pretending Euclidean closeness is enough?
- Are disagreements between legacy target and shadow reasoning interesting and legible?

Bad shadow decisions are expected and useful at this stage if they are observable.

---

## 11. CCC-0 promotion gate

Promote CCC-0 as a successful research substrate only when all are true:

1. **ZERO AUTHORITY:** authoritative movement is mechanically unchanged;
2. **DETERMINISTIC/BOUNDED:** shadow evaluation is finite, deterministic where expected and query-bounded;
3. **KNOWN FAILURES REPRESENTABLE:** S5 centroid-collapse, catch-up deficit, reversal uncertainty and player-corridor conflicts can be observed explicitly;
4. **TOPOLOGY-AWARE:** region evidence respects current route/static authority rather than Euclidean wishful thinking;
5. **CAUSAL:** a captured incident can explain legacy decision next to shadow WHERE/PACE/PLAYER evidence from the same tick;
6. **BROWSER-LEGIBLE:** Owner can inspect the three coordination axes without guessing what the system meant;
7. **FOUNDATION REGRESSION:** full existing suite/build/audit remains clean.

Passing CCC-0 does **not** qualify WHERE/PACE/PLAYER COOPERATION as good enough for movement authority. It only qualifies the apparatus needed to judge them.

---

## 12. Stop/escalation triggers during CCC-0

Stop and reconsider instead of weight-tuning if:

- current static router makes bounded field qualification prohibitively expensive or semantically misleading;
- representative-point route adapters repeatedly disagree with coherent region topology;
- useful distance-to-region cannot be expressed robustly with the sampled representation;
- corridor evidence requires so much hidden temporal state that the simple geometric model stops being inspectable;
- causal trace growth makes incidents unreadable instead of more informative;
- workbench rendering becomes the dominant complexity of the stage;
- shadow computation measurably destabilizes runtime timing despite having no authority.

---

## 13. Expected implementation order

1. Pure shadow types/evaluators with no scene integration.
2. Relationship-region donor recovery + deterministic tests.
3. Simple pace evidence + falsifiers.
4. Simple player-corridor evidence + reversal/jitter falsifiers.
5. Aggregate `ShadowCoordinationFrame` and legacy comparison.
6. Causal trace transport.
7. Workbench panel/overlay.
8. Zero-authority regression.
9. Full automated qualification.
10. Browser/Owner evidence pass.
11. Only then plan CCC-1 authority promotion from what the shadow evidence actually showed.

This ordering keeps each new signal testable before presentation and keeps presentation separate from behavior authority.