# R1 — Movement Robustness + Causal Workbench

Status: **PLANNING / NO IMPLEMENTATION AUTHORITY YET**

Date: 2026-09-14

This stage exists because the S4 Owner/browser recording changed the meaning of the current state. S3 established a materially better, responsive omnidirectional local mover. S4 added temporal continuity and local preferred-velocity refinement and passed the automated suite, but the live dynamic-play gate exposed a serious failure class: the companion can enter `NAV UNREACHABLE -> SPATIAL HOLD -> zero motion` while the game continues running. The same recording also showed that the current debug HUD can physically occlude the companion and therefore contaminate the research apparatus.

R1 is not a bug-fix sprint and is not the next intelligence feature. It is a bounded robustness/recovery campaign whose job is to make the movement stack trustworthy under adversarial ordinary play before S5 or later tactical work receives movement authority.

---

## 1. Recovered project truth

| Stage | Current research status |
| --- | --- |
| S0 physical apparatus | **PASS as research apparatus / not movement-quality pass** |
| S1 relational positioning | **OWNER-BROWSER INFORMATIVE FAIL / evidence preserved** |
| S2-A/B observability + direct traversal | **valuable qualified substrate** |
| S2-C0 static router | **nominal-state mechanical qualification; boundary-state robustness unproven** |
| S3 spatial locomotion | **material responsiveness success; robustness/recovery still unproven** |
| S4 natural motion | **OWNER-BROWSER INFORMATIVE FAIL / dynamic-play regression evidence** |
| S5 continuous relationship field | **PAUSE / shadow evidence preserved / no movement authority** |

The S4 automated evidence remains valid for the cases it actually exercised. The error was not that the tests lied; the evidence surface was too narrow compared with real Owner play.

---

## 2. Material findings from the S4 Owner recording + code audit

### F1 — the workbench can hide the world

The current HUD is a Phaser text object rendered above the playfield. It can cover actors and make a moving companion appear to disappear. This is not cosmetic. A research tool that hides physical truth can create false diagnoses.

**Decision:** textual/causal debug moves to a separate collapsible side panel. World-space geometry remains in the world.

### F2 — real autonomous self-lock exists

During the recording, the simulation continues (`RUNNING`, advancing ticks), while the companion enters a persistent zero-motion state associated with route `unreachable` and spatial `HOLD`.

This is not equivalent to the HUD occlusion problem.

### F3 — leading mechanism: clearance prison

Current route/local feasibility often queries a circle with:

`physical actor radius + 0.08 m route/static clearance`

while Rapier physical collision owns only the physical body radius.

Therefore a physically legal World state may lie inside the planning layer's enlarged forbidden envelope. Current shape casts use initial-penetration-stopping semantics. A query that begins inside the enlarged envelope can report an immediate blocker even for a direction that would move the physical actor away from the wall.

Plausible causal chain:

`World produces physically legal but comfort-clearance-violating state`

`-> route start lies inside enlarged planning obstacle`

`-> outgoing graph edges / local candidate sweeps are reported blocked`

`-> route becomes unreachable`

`-> moving candidates become hard-rejected`

`-> STOP remains admissible`

`-> HOLD preserves the violating state`

`-> no explicit recovery semantics exist`

This is a **leading causal hypothesis**, not yet a promoted fact. R1 must reproduce it deterministically before selecting a repair.

### F4 — S4 can amplify the boundary violation

S4 validates the coarse/refined preferred motion and only afterwards applies temporal motion continuity. The continuity output is the final MotionIntent, but that final commanded motion is not revalidated against the spatial constraints used to validate the preferred motion.

A turn that is safe as a new preferred velocity can therefore retain enough old velocity to enter a region the planner/local mover considers forbidden.

This is a cross-layer safety gap. It must be tested directly before deciding whether the right repair is post-actuator constraint projection, a constraint-aware actuator, a different safety contract, or some combination.

### F5 — `unreachable` currently leaks bad semantics downstream

When a static route is `unreachable` or otherwise has no route polyline, current local route guidance can report zero remaining route distance while falling back toward the relationship target.

`unreachable` and `arrived` must never share an implicit representation such as “remaining = 0”. A failure state must carry an explicit reason and next allowed response.

### F6 — the planned progress/recovery stage was skipped, not disproven

S1 evidence explicitly identified missing progress awareness/recovery. The S2 plan contained progress/stuck classification and constrained-space cooperation. The S3 reframe still reserved an S3-D progress/cooperation stage. Positive responsiveness evidence moved the project into S4 naturalness before that robustness layer was implemented.

R1 restores that missing work at the correct priority.

### F7 — tests do not yet model Owner play

The current integration trials are strong for fixed-target nominal routes, but they mostly use a stationary player and authored target. They do not adequately cover:

- player physically pushing or pinning the companion;
- rapid player reversal;
- cross-front interception;
- repeated doorway reversal;
- moving relationship targets during route execution;
- final-actuator overshoot near static geometry;
- recovery after entering a clearance violation;
- temporary route failure that later becomes solvable.

The Owner rehearsal matrix and the promotion-test matrix have diverged.

### F8 — current A/B actuator comparison is not fully isolated

DIRECT and NATURAL own separate spatial-brain state and toggling resets motion brains. A clean actuator A/B should consume the same upstream preferred-motion evidence and differ only in realization policy whenever practical.

---

## 3. R1 non-negotiable invariants

These are stronger than implementation ideas. A candidate repair that violates them does not qualify.

1. **World remains physical authority.** Cognition/debug may not mutate or reinterpret canonical physical truth.
2. **Hard feasibility and comfort clearance are distinct concepts.** A preferred margin must not silently become an unrecoverable physical law.
3. **No physically legal state may become permanently immobile solely because a comfort/desired-clearance envelope is violated.**
4. **A clearance violation must have a legal egress path whenever hard geometry permits one.** The system must be able to move toward a safer state rather than reject every nonzero action because it starts in violation.
5. **Final commanded motion must respect hard safety.** Validating only an upstream preferred velocity is insufficient if a later actuator changes the actual command.
6. **`ARRIVED`, `WAITING`, `BLOCKED`, `UNREACHABLE`, `ROUTE_INVALID`, and `RECOVERING` are not interchangeable zero-speed states.**
7. **HOLD must have a public causal reason and a resume/reconsideration condition.** Persistent HOLD away from a legitimate goal must become evidence, not silent behavior.
8. **Progress is temporal.** Low speed alone is not “stuck”; intentional standing is valid. Stuck/recovery requires desired progress plus insufficient observed progress over a bounded window.
9. **Player authority does not imply companion paralysis.** The companion may yield, wait or cede space, but must be able to resume when the conflict clears.
10. **Debug must not hide physical truth by default.** Textual inspection lives outside the world viewport; spatial overlays remain spatial.
11. **Trace frames must be causally phase-coherent.** We must know which observation produced which decision/command and which later World outcome resulted.
12. **Owner-discovered failure classes become regression fixtures before promotion.** A future all-green suite must include the behaviors that broke the live build, not only prior nominal routes.

---

## 4. Spatial contract reframe to investigate

Do not implement this section verbatim without the R1-0 failing evidence. It is the current-best model to test.

### 4.1 Separate three spatial meanings

**A. Hard body feasibility**

Can the real physical body move there without crossing solid geometry?

This is a hard constraint.

**B. Desired / comfort clearance**

How much extra separation from static geometry is preferable for readability, future animation, robustness and cooperative movement?

This is normally a utility/cost or route-quality term, not automatically a hard rejection.

**C. Current clearance violation / egress**

If the World is already inside desired clearance but outside hard collision, the system must classify the violation and permit moves that improve or safely escape it.

A planning query that treats the initial violation itself as an unconditional collision cannot satisfy this invariant.

### 4.2 Shape-query semantics must be explicit

Current `staticCircleTraversal` exposes one behavior for several responsibilities. R1 should decide whether the World spatial-query boundary needs explicit query semantics such as:

- hard sweep / stop on initial penetration;
- egress-capable sweep;
- clearance measurement / nearest blocker;
- body occupancy vs preferred-clearance occupancy.

Do not expose Rapier objects to brains. Any Rapier-specific details remain behind World/spatial-query authority.

### 4.3 Route feasibility should not silently encode comfort as physics

Candidate current-best model:

- graph connectivity based on hard body feasibility plus small numerical safety tolerance;
- desired clearance contributes route cost/quality and debug evidence;
- routes violating desired clearance can be marked constrained/degraded rather than automatically nonexistent when the physical body can pass;
- truly too-narrow passages remain unreachable.

This is a hypothesis. R1 must compare it against an alternative where a hard planning margin is retained but explicit egress/recovery is supported.

---

## 5. Final-command safety boundary

R1 must make the following chain explicit:

`observation -> preferred motion -> motion realization -> final command constraint -> World -> outcome`

Two implementation families are legitimate candidates:

### Candidate A — constraint-aware actuator

The temporal actuator knows the admissible motion set and shapes acceleration/turning inside it.

Potential benefit: one coherent optimization rather than “smooth then clip”.

Risk: movement-quality logic becomes coupled to navigation/spatial queries and harder to reason about.

### Candidate B — independent actuator + final command projection/revalidation

Keep continuity generic, then validate/project its commanded velocity against hard physical constraints before MotionIntent.

Potential benefit: cleaner responsibility seam and easier A/B.

Risk: naive projection can create wall-sliding artifacts, oscillation, or destroy the intended acceleration/jerk properties.

R1 should build falsifiers before selecting either family. The final command, not merely the preferred command, is the safety object.

---

## 6. Progress / recovery semantics

Do not build a giant FSM. Begin with inspectable classifications derived from evidence.

Provisional public vocabulary:

- `progressing` — desired route/relationship progress is being made;
- `arrived` — objective legitimately satisfied;
- `waiting` — zero/low motion is intentional with explicit resume condition;
- `yielding-player` — companion cedes a dynamic conflict to the player;
- `blocked-static` — requested progress is prevented by hard static geometry;
- `blocked-player` — requested progress is prevented by player occupancy/motion;
- `clearance-violation` — body is physically legal but inside desired static margin;
- `route-invalid` — existing route assumptions no longer hold;
- `unreachable` — no currently valid route under the selected hard-feasibility semantics;
- `recovering` — a bounded action is explicitly trying to restore a normal planning state.

Required evidence window should include at least:

- desired progress direction / current objective;
- route status and revision;
- distance/arc-length remaining where meaningful;
- requested / commanded / actual velocity;
- actual displacement;
- contact history;
- hard clearance and desired clearance;
- player conflict prediction;
- duration since meaningful progress;
- previous classification and transition reason.

A recovery action must have a termination condition and a maximum lifetime. “Turn left after 0.5 s” is not acceptable as a general recovery policy.

---

## 7. Causal Workbench v2

R1 treats debug as a peer product.

### 7.1 Layout

Move textual control/inspection out of Phaser world rendering.

Working UI direction:

`[ responsive world canvas ][ collapsible / resizable debug side panel ]`

The panel may be DOM/UI outside the canvas. The exact technology is secondary to the semantic split.

**World-space overlays retain:**

- body/hard radius;
- desired-clearance envelope;
- route graph/corridor;
- local rays / velocity candidates;
- preferred/refined/commanded/actual vectors;
- player prediction;
- contact/blocker points/normals;
- recovery/yield target/escape direction;
- trails.

**Side panel owns:**

- mode / actuator / time controls;
- pause / step / incident capture;
- current relationship objective;
- route state/reason/revision;
- progress/recovery state;
- clearance status;
- candidate-selection summary;
- preferred -> refined -> commanded -> actual values;
- semantic event stream;
- incident controls;
- debug-layer toggles.

Panel collapsed = maximum playfield with minimal status strip.

### 7.2 Phase-coherent trace

The current single `tick` sample is insufficient for cross-layer debugging.

R1 should model an execution record closer to:

- `observationTick` / pre-step World snapshot identity;
- relationship decision revision;
- route revision;
- spatial decision revision;
- preferred motion;
- refined motion;
- actuator output;
- final constrained command;
- outcomeTick / post-step World state;
- progress/recovery classification after outcome.

The exact schema can remain compact, but one frame must not accidentally combine a pre-step decision with a post-step route and present them as simultaneous truth.

### 7.3 Failure-oriented QoL

High-value R1 QoL:

- direct debug layer toggles, not only cyclic presets;
- optional auto-pause on `unreachable`, `clearance-violation`, recovery timeout, prolonged no-progress, rapid route thrash;
- automatic incident marker/capture metadata on those transitions;
- freeze-current-frame inspector;
- visible state-transition reason and resume condition;
- small rolling graphs for progress / hard clearance / desired clearance / response error where useful;
- eventually bounded replay/scrub if the phase-coherent trace proves sufficient.

Do not build replay before the new trace semantics exist.

---

## 8. R1 regression/rehearsal campaign

### R1-F0 — reproduce before repair

Produce deterministic failing fixtures for the live failure class before changing semantics.

Required cases:

1. **Clearance egress** — companion starts physically legal but inside desired static margin; target lies away from the wall. Expected current failure or explicit evidence of why the hypothesis is wrong.
2. **Push-to-wall** — player physically pushes companion into desired-clearance violation, then leaves. Companion must eventually resume autonomous progress without reset.
3. **Actuator corner carry** — a safe preferred turn near geometry is temporally realized by NATURAL. Detect whether commanded motion crosses the preferred safety envelope or creates an unrecoverable start state.
4. **Doorway reversal** — player repeatedly crosses/reverses while companion is routing through the choke.
5. **Cross-front interruption** — moving player cuts across the companion's current path and then clears it.
6. **Moving relationship target** — player direction changes while the route is active; stale route/target must not create prolonged HOLD.
7. **Temporary unreachable** — route becomes unavailable transiently and later available; companion must not require reset.
8. **Hard unreachable** — physically impossible target remains honestly unreachable without thrash or fake progress.

### Promotion metrics

The exact thresholds remain experimental, but the suite should measure rather than merely assert arrival:

- time/distance to resumed progress after conflict clears;
- maximum unjustified HOLD duration away from objective;
- duration inside desired-clearance violation;
- hard-geometry contact / penetration outcome;
- route status transitions and revision count;
- progress monotonicity window / regressions;
- rapid candidate/route/state thrash;
- final objective success where appropriate;
- recovery count and recovery timeout;
- player obstruction/interference duration.

### Owner rehearsal matrix

After automated qualification, Owner browser testing should intentionally repeat:

- circling;
- rapid reversals;
- push/pin/release near walls;
- doorway entering/exiting/reversing;
- cross-front cuts;
- sudden stops;
- body contact from multiple directions;
- actuator DIRECT/NATURAL comparison from identical scenario/reset seeds;
- 0.25x inspection with side panel and incident capture.

Any new Owner-discovered failure class becomes a candidate regression fixture before the next architectural promotion.

---

## 9. R1 campaign sequence

### R1-0 — evidence preservation + red tests

- preserve exact S4 failing runtime as evidence;
- reclassify S4 Owner gate as informative fail/regression;
- freeze S5 at shadow-only;
- encode clearance-prison / dynamic-player / actuator-boundary failures before repair;
- verify whether the leading mechanism is real, incomplete or false.

**Gate:** at least one deterministic fixture reproduces the relevant class or the hypothesis is falsified with a better causal explanation.

### R1-1 — Causal Workbench v2 shell

- responsive world area;
- side panel outside the world overlay;
- direct debug categories;
- phase-coherent trace identifiers;
- explicit hard-vs-desired clearance visualization;
- failure auto-marker / optional auto-pause.

Behavior should remain failing at first.

**Gate:** the known failure becomes faster and less ambiguous to diagnose than in S4.

### R1-2 — spatial contract repair

- separate hard feasibility from desired clearance;
- define initial-violation/egress semantics;
- correct `unreachable` downstream semantics;
- requalify route/local feasibility invariants.

**Gate:** physically legal clearance-violation fixtures have bounded egress while truly too-narrow geometry remains unreachable.

### R1-3 — final-command safety

- test/select constraint-aware actuator vs post-actuator final-command constraint;
- ensure NATURAL cannot invalidate the spatial safety contract silently;
- preserve responsive turning/braking evidence.

**Gate:** aggressive near-wall turns/reversals remain recoverable and do not reintroduce frame-scale snapping unnecessarily.

### R1-4 — progress / recovery intelligence

- rolling progress evidence;
- public failure classification;
- bounded recovery actions;
- transition reasons + resume/termination conditions;
- no silent indefinite HOLD away from an intentionally satisfied objective.

**Gate:** all dynamic regression fixtures either progress, intentionally wait/yield with visible reason, recover, or honestly report persistent hard unreachable.

### R1-5 — constrained-space player cooperation

Only after static/command robustness is trusted:

- explicit player conflict detection;
- yielding/waiting semantics;
- resumption after conflict clears;
- doorway/head-on/cross-front campaign.

**Gate:** repeated player-companion contention no longer requires reset and does not rely on doorway-specific scripts.

### R1-6 — Owner robustness gate

A dedicated Owner run evaluates:

- responsiveness retained;
- no random apparent companion shutdown;
- movement recovery legible;
- debug no longer steals the world viewport;
- side-panel workflow actually reduces diagnosis cost;
- NATURAL improves feel without changing competence class.

Only after this gate should S5 be reconsidered for active visualization/authority work.

---

## 10. Explicit deferrals during R1

Do not let R1 expand into:

- S5 movement authority;
- combat/enemies;
- commands;
- multiple companions;
- ORCA/RVO;
- final animation/facing system;
- LLM cognition;
- soft-contact replacement;
- generic engine/framework extraction;
- production navigation architecture;
- aesthetic UI polish unrelated to research ergonomics.

Soft-contact remains a later A/B hypothesis. R1 should first make hard-contact movement robust enough that softness cannot hide missing intelligence.

---

## 11. Stop / escalation conditions

R1 must reconsider its current spatial substrate instead of patching indefinitely if any of the following becomes true:

- egress-safe shape-query semantics cannot be expressed reliably behind the current Rapier World adapter;
- visibility-graph routing requires repeated special cases merely to recover from normal contact states;
- hard-feasibility + soft-clearance separation still produces route thrash or ambiguous corridors;
- final-command safety projection destroys motion quality or creates persistent sliding/oscillation;
- progress/recovery state grows into scenario-specific FSM spaghetti;
- causal trace cannot unambiguously associate decisions with outcomes;
- browser workbench complexity becomes a larger source of false evidence than the AI itself.

At that point a broader character-controller/navigation substrate comparison (including Rapier KCC or a dedicated navigation/local-avoidance solution) becomes justified by evidence rather than habit.

---

## 12. Current next move

Do **not** implement S5 authority or tune S4 naturalness.

Begin R1-0 by reproducing the Owner failure class mechanically, starting with:

1. physically legal / desired-clearance-violating start;
2. player push-to-wall then release;
3. NATURAL actuator corner/reversal near static geometry.

The first implementation decision is not “how do we fix it?” but:

> Which exact contract fails first in a deterministic reproduction: route feasibility, local candidate feasibility, final actuator command, progress interpretation, or some combination?

Only after that evidence should R1-1/R1-2 choose the repair shape.
