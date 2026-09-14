# CCC-0 Shadow Coordination — Execution Evidence

Status: **MECHANICAL SHADOW CHECKPOINT CANDIDATE · ZERO AUTHORITY PROVEN · OWNER OBSERVATION PENDING**

Base checkpoint:

`5e809fc61433b3eceefde088243ad736da0e5b1b`

Latest evidence head at document creation:

`f3ddfc8a7333fe3e274fb6c012ade7036e2770f0`

Latest completed validation observed at document creation:

- workflow `validate`
- run `34887724707`
- conclusion `success`

This document is not a claim that CCC coordination behavior is ready for authority. It records what the shadow stage has actually demonstrated and what remains deliberately unproven.

---

## 1. Stage question

CCC-0 asked:

> Before changing companion movement, can the current runtime produce bounded, causal, inspectable evidence for WHERE, PACE and PLAYER FLOW beside the legacy decision, while proving that the new research substrate has zero movement authority?

Current mechanical answer:

**Yes.**

Behavior-quality answer:

**Not evaluated yet.** The new evidence has not been promoted to movement authority and requires Owner/browser observation before it should inform CCC-1 authority design.

---

## 2. What exists now

### WHERE — shadow relationship region

The runtime samples a bounded player-relative field:

- 32 angular directions;
- 3 radii: `1.15`, `1.45`, `1.8`;
- 96 total broad samples;
- hard body validity before route work;
- local utility decomposition before route qualification;
- at most 12 locally shortlisted route candidates;
- coherent connected near-best region around the best route-qualified sample;
- weighted representative only inside that coherent region;
- final representative hard/route revalidation;
- explicit no-region data instead of player-center fallback.

Important semantic distinction:

- `NO_HARD_VALID_SAMPLE` means the bounded field itself contains no hard-valid body sample;
- `ROUTE_SHORTLIST_EXHAUSTED` means the bounded route shortlist found no reachable candidate, **not** that every untested field sample is globally unreachable.

The representative anchor is an adapter/debug artifact. The region is the research object.

### PACE — shadow temporal relationship

The current provisional evidence exposes:

- physical speed capability;
- observed player speed;
- companion speed;
- distance to the useful region;
- route distance of the best route-qualified sample;
- relative opening/closing speed;
- time outside the useful region;
- decomposed urgency pressure;
- provisional desired speed;
- explanatory labels `SETTLED`, `FOLLOWING`, `CATCH_UP`, `RECOVERING`.

The labels are not a hidden behavior FSM and currently have no authority.

### PLAYER FLOW — shadow corridor

The current provisional corridor exposes:

- meaningful actual player velocity first;
- requested velocity only when actual velocity is not meaningful;
- no directional corridor when the player is stationary and no motion evidence exists;
- short bounded prediction horizon;
- separate physical and comfort radii;
- heading persistence/confidence;
- explicit `REVERSAL_UNCERTAIN` evidence after an abrupt reversal.

This is cooperation evidence, not a final player collision guard.

### Aggregate shadow frame

`ShadowCoordinationFrame` combines:

- WHERE;
- PACE;
- PLAYER FLOW;
- same-observation legacy relationship target;
- same-observation legacy preferred velocity;
- legacy-target disagreement with the shadow region;
- small explicit temporal history.

It contains no movement command.

---

## 3. Zero-authority evidence

CCC-0 is integrated inside `R1WorkbenchSpatialStack` **after** the authoritative DIRECT/NATURAL brain has already selected `MotionIntent`.

Shadow evaluation is wrapped in fault containment. A shadow exception becomes debug evidence and does not replace, clear or recompute the authoritative command.

Automated evidence includes:

### One-step equivalence

For DIRECT and NATURAL separately:

- pre-shadow authoritative brain and shadow-enabled workbench receive equivalent evidence;
- returned `MotionIntent` is exactly equal.

### Parallel-World equivalence

For DIRECT and NATURAL separately:

- two independent deterministic `LabWorld` instances start from identical `open` state;
- one is driven by the pre-shadow authoritative brain;
- one is driven by the shadow-enabled workbench;
- a scripted player changes direction during the run;
- for 120 steps the test checks:
  - exact authoritative companion command equality;
  - exact post-World snapshot equality on every step;
  - exact progress/recovery decision equality.

This is stronger than a final-state comparison: the trajectories must remain identical frame by frame.

### Shadow-failure isolation

The workbench can be injected with a synthetic shadow evaluator that throws immediately.

For DIRECT and NATURAL separately the test verifies:

- the authoritative command is still exactly equal to the pre-shadow baseline;
- `shadowCoordination` becomes null;
- the research failure appears only as `shadowCoordinationError`.

### Existing long workbench run

The existing 360-step DIRECT/NATURAL workbench integration remains green while shadow evidence is evaluated throughout the run.

Mechanical conclusion:

> **No semantic movement authority has leaked into CCC-0.**

Remaining caveat:

> synchronous shadow work may still have browser/runtime performance cost; semantic zero-authority does not by itself prove negligible presentation-time overhead.

---

## 4. Geometry and falsifier campaign

Current automated coverage includes:

- deterministic identical-input output;
- finite evidence;
- bounded broad sample count;
- bounded route shortlist count;
- explicit no-region data;
- distinction between no hard-valid sample and shortlist exhaustion;
- disconnected near-best components are not averaged together;
- representative remains away from player center rather than reproducing the historical S5 centroid collapse;
- representative is hard/route revalidated;
- actual player motion wins over requested motion when meaningful;
- stationary player does not fabricate a heading;
- previous meaningful heading may persist through a temporary stop;
- stationary corridor does not fabricate flow;
- abrupt reversal lowers corridor confidence/horizon;
- moving-away PACE urgency exceeds stationary urgency at identical geometry;
- moving-toward/reversal reduces urgency relative to moving away;
- desired speed remains within physical capability.

Real lab geometry campaign:

- `open`;
- `pillar`;
- `doorway`;
- `head-on`;
- deliberately shifted player-relative field adjacent to the pillar.

The doorway case explicitly rechecks that the region representative does not collapse toward player center while route-qualified samples cross the passage topology.

---

## 5. Workbench observability

CCC-0 now extends the existing workbench instead of creating a second debug application.

### World layer

A new `Coordination` layer is available and default OFF.

It can render:

- all bounded WHERE samples;
- hard-invalid samples;
- route-evaluated unreachable samples;
- route-evaluated reachable samples;
- coherent region membership;
- representative anchor;
- legacy target → shadow anchor disagreement;
- player flow line;
- physical and comfort corridor envelopes.

### Panel

Three new sections remain collapsed by default:

- `CCC-0 shadow · WHERE`;
- `CCC-0 shadow · PACE`;
- `CCC-0 shadow · PLAYER FLOW`.

A shadow failure is explicitly labelled as research/debug failure while authoritative movement remains unchanged.

### Causal trace / incident capture

Causal frames may now carry an explicitly named `CCC0_SHADOW_COORDINATION` block in the **decision evidence**, separate from the authoritative command phase.

Incident export schema is now:

`companion-brain-lab-ccc0-causal-incident-v3`

The trace defensively clones shadow vectors so later mutation cannot rewrite recorded evidence.

---

## 6. Material findings discovered during CCC-0 itself

CCC-0 has already falsified or corrected two tempting assumptions before they could receive authority.

### Finding A — stationary player must not inherit a fake world-axis heading

Initial implementation used `+X` when actual velocity, requested velocity and previous heading were absent.

That would have made an arbitrary world direction semantically become the player's front and would have biased WHERE while the player was simply standing still.

Correction:

- no evidence → heading source `none`;
- direction `{0,0}`;
- front/back penalty disabled;
- previous meaningful heading may still persist through a temporary stop.

This is a direct example of why the shadow stage exists.

### Finding B — bounded shortlist failure is not global unreachable truth

Initial no-region wording could be read as "no reachable relationship region exists" even though only a bounded route shortlist had been queried.

Correction:

- distinguish field hard-validity failure from shortlist route exhaustion;
- explicitly state that untested samples are not claimed unreachable.

This avoids later recovery logic being built on false epistemic certainty.

---

## 7. What is **not** proven

The following remain intentionally open:

### Visual / semantic legibility

Automated tests cannot answer whether the region, pace and corridor are understandable and useful when watched live.

Owner/browser questions include:

- does the coherent region look like a plausible useful place around the player?
- does it remain stable enough without becoming sticky?
- does it behave sensibly near the doorway and pillar?
- does PACE rise/fall in a way that matches intuitive separation pressure?
- does corridor confidence visibly fall during reversals instead of flickering or hallucinating flow?
- are legacy-vs-shadow disagreements informative?

### Runtime overhead

The full shadow evaluator currently runs synchronously during each spatial workbench intent.

Its work is structurally bounded at the sampling/shortlist level, but real browser cost has not yet been measured or observed. If it is materially expensive, cadence/caching must be redesigned without compromising evidence semantics.

### Scoring quality

Current constants are provisional research parameters. Mechanical tests only defend invariants/falsifiers; they do not establish that the utility weights encode the best teammate behavior.

### Current-player-input immediacy

The shadow models read the authoritative `WorldSnapshot`. Player actual/requested velocity therefore reflects World evidence available at the observation boundary, not a privileged lookahead into a just-read current-frame keyboard command. This is deliberate causal discipline for now, but any perceived one-tick responsiveness issue should be evaluated rather than hidden.

### Authority design

CCC-0 provides evidence only. It does not answer how CCC-1 should finally combine region utility, pace, right-of-way, local realization and rare hard player-agency protection.

The earlier CCC skeleton remains a hypothesis to re-plan after Owner evidence.

---

## 8. Current verdict

### Mechanically

**PASS candidate.**

The project now has a bounded, deterministic, fault-contained and causal shadow coordination substrate with strong zero-authority evidence.

### Behaviorally

**UNPROVEN by design.**

No new companion behavior has been promoted.

### Next gate

1. finish final branch validation / review;
2. make the shadow checkpoint easy to run in the browser without replacing the historical Foundation preview prematurely;
3. Owner observes WHERE / PACE / PLAYER FLOW across open, pillar, doorway, head-on and deliberately adversarial movement;
4. use those observations to falsify/rewrite CCC assumptions;
5. only then design CCC-1 authority promotion.

The correct response to bad Owner evidence is not to protect this implementation. It is to change or delete it.