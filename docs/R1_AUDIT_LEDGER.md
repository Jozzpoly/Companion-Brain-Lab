# R1 — Audit Ledger

Status: **LIVE PLANNING LEDGER**

Date: 2026-09-14

Purpose: keep evidence, hypotheses, process debt and architecture candidates separate while R1 is planned/executed. A future stage must not silently promote a hypothesis because it sounds plausible or because a repair made one fixture green.

---

## Legend

- **PASS / demonstrated** — directly supported by automated or Owner evidence within its stated scope.
- **MATERIAL FINDING** — strong evidence with practical consequence; mechanism may still need narrower reproduction.
- **LEADING HYPOTHESIS** — plausible causal explanation requiring deterministic falsification.
- **PROCESS DEBT** — problem in how evidence/gates were carried between stages.
- **ARCHITECTURE CANDIDATE** — possible repair/reframe; not selected.
- **DEFERRED** — intentionally outside R1 authority.

---

## A. Defended foundations

### A1 — World remains authoritative

**Status:** PASS / defended.

Brains emit MotionIntent; World/Rapier establish actual motion/contact. App rendering mirrors state. Preserve this boundary.

Relevant files:
- `src/world/world.ts`
- `src/physics/rapier-physical-world.ts`
- `src/brain/*`

### A2 — fixed-step/headless apparatus remains useful

**Status:** PASS within research scope.

S0 established deterministic local scenario/reset/step contracts and useful requested-vs-actual physical evidence. Nothing in the S4 regression shows the physics kernel is exploding or the simulation clock is broken.

### A3 — whole-body static query is a valuable primitive

**Status:** PASS as a primitive, not as one universal semantic mode.

S2-B proved that center-point reachability is insufficient and that whole-body swept queries expose useful blocker geometry. R1 questions how that primitive is parameterized/semantically reused, not whether whole-body queries are useful.

### A4 — static route/local locomotion separation is valuable

**Status:** PASS as responsibility seam.

S3 Owner evidence materially improved responsiveness after route became corridor/lookahead guidance and local locomotion chose omnidirectional velocity.

### A5 — debug as a peer research product is validated by Owner use

**Status:** PASS conceptually.

The Owner explicitly reported that debug showed its value. Current layout/causal timing is inadequate, but observability investment is justified.

---

## B. Owner-evidenced failures

### B1 — in-world HUD can occlude physical truth

**Status:** MATERIAL FINDING.

S4 uses a large Phaser text HUD at high depth over the world. The Owner recording shows this is large enough to hide actor motion/position and create apparent disappearance.

Consequence: textual inspector must move out of the playfield.

### B2 — real autonomous zero-motion lock occurs

**Status:** MATERIAL FINDING.

The S4 Owner recording shows advancing simulation ticks while the autonomous companion enters persistent zero motion associated with route `unreachable` and spatial/motion HOLD.

Consequence: S4 cannot remain classified as an open feel-only gate.

### B3 — S4 natural feel improvement is small relative to robustness regression

**Status:** OWNER judgement / material prioritization.

Owner reported only minimal feel improvement while observing random shutdown-like behavior. Further feel tuning is lower priority than robustness.

---

## C. Leading causal hypotheses

### C1 — desired-clearance prison

**Status:** LEADING HYPOTHESIS.

Evidence:
- route/local static feasibility often uses physical radius + `0.08` m desired clearance;
- World static collision owns the physical radius only;
- physically legal World state may therefore start inside the enlarged query shape;
- `staticCircleTraversal` currently calls `World.castShape(... stopAtPenetration=true ...)`;
- Rapier documents that disabling stop-at-penetration allows a cast starting in penetration to continue when its trajectory exits that penetration;
- moving candidates can be hard-rejected while STOP remains admissible.

Predicted symptom:
`legal physical state inside desired margin -> route/local casts hit at t=0 -> unreachable/rejected moves -> STOP/HOLD -> no egress`.

Required falsifier:
deterministic physically-legal / desired-clearance-violating start with target away from wall.

### C2 — S4 actuator can create unsafe final command relative to validated preferred motion

**Status:** LEADING HYPOTHESIS / code-grounded safety gap.

Evidence:
- coarse/refined preferred motion is spatially validated;
- continuity actuator then modifies the command using current velocity/acceleration history;
- final commanded MotionIntent is not independently validated against the same spatial constraints.

Predicted symptom:
a safe new preferred turn near geometry retains enough old velocity to enter desired-clearance violation, after which C1 can lock the planner.

Required falsifier:
near-wall 90°/reversal fixture comparing preferred, refined, commanded and resulting clearance.

### C3 — `unreachable` downstream semantics encourage pathological HOLD

**Status:** MATERIAL CODE FINDING / exact experiential impact unproven.

Current route guidance for non-routed states falls back to relationship target but reports zero route lookahead/remaining distance. Some local scoring terms therefore receive a representation also compatible with “nothing useful remains to travel”.

Required repair principle:
`unreachable != arrived`; explicit failure/progress semantics.

### C4 — lack of progress/recovery converts transient invalidity into persistent failure

**Status:** MATERIAL ARCHITECTURE GAP.

This was already identified in S1/S2 and explicitly deferred in S3. Current autonomous runtime has no general temporal classifier that distinguishes intentional hold, temporary player conflict, static block, clearance violation, route invalidation and recovery.

Required evidence:
transient conflict fixtures + bounded resume criteria.

---

## D. Process/evidence debt

### D1 — Owner rehearsal matrix was not promoted into regression suite

**Status:** PROCESS DEBT.

S0 manual qualification already asked the Owner to:
- ram the companion into a wall;
- squeeze/pin actors in doorway/contact;
- reverse repeatedly;
- scrape walls/corners.

S3 Owner gate similarly requested circling, player reversals, cross-front motion and sudden stops.

S3/S4 automated integration trials instead focused primarily on fixed targets with a stationary player.

Consequence: future Owner-discovered failure classes should become bounded regression fixtures before the next promotion.

### D2 — stage sequence skipped planned robustness work

**Status:** PROCESS DEBT / sequencing correction.

S1/S2 identified progress/recovery and constrained-space cooperation. S3 reframe retained an S3-D stage for those topics. After responsiveness improved, work advanced into S4 naturalness and then S5 shadow relationship fields before S3-D was completed.

Consequence: R1 restores robustness priority before further upstream authority.

### D3 — A/B actuator comparison is not perfectly isolated

**Status:** PROCESS/EXPERIMENT DESIGN DEBT.

DIRECT and NATURAL have separate spatial-brain state and switching resets motion brains. A clean actuator experiment should, where practical, feed identical upstream preferred-motion evidence into both realization policies.

Consequence: redesign A/B harness before drawing fine feel conclusions.

---

## E. Debug/workbench debt

### E1 — textual debug is rendered inside world presentation

**Status:** MATERIAL FINDING.

Fix direction: responsive world + collapsible/resizable side panel; world-space overlays remain spatial.

### E2 — trace phase ambiguity

**Status:** MATERIAL CODE FINDING.

Current scene computes decision/intents from a pre-step snapshot, advances World, then updates some navigation evidence and records a sample against the post-step snapshot. A displayed/recorded “frame” can therefore combine decision evidence and later World/route evidence without explicit phase identity.

Fix direction: observation/decision/command/outcome/progress identities or revisions in trace.

### E3 — debug category selection is too coarse

**Status:** QoL debt with research impact.

Current presets are useful but mostly cycle-based. R1 should allow direct layer toggles and explicit failure-state inspection without forcing the Owner to cycle through unrelated views.

---

## F. Architecture candidates — not selected

### F1 — hard feasibility + soft desired clearance

**Status:** ARCHITECTURE CANDIDATE.

Possible model:
- hard physical sweep determines legal connectivity;
- desired clearance contributes cost/quality;
- current desired-clearance violation has explicit egress semantics;
- too-narrow physical passages remain truly unreachable.

Must be compared against F2.

### F2 — retain hard planning margin but add egress-aware query/recovery

**Status:** ARCHITECTURE CANDIDATE.

Possible model:
- route margin remains hard under normal planning;
- queries distinguish initial penetration/egress;
- recovery state may temporarily leave the normal comfort envelope to restore validity.

Risk: two-mode semantics can become harder to reason about than F1.

### F3 — `stopAtPenetration=false` in explicitly scoped egress queries

**Status:** ARCHITECTURE CANDIDATE / API-grounded.

Official Rapier docs support the needed exit-penetration behavior. Do not apply globally without fixtures; route graph, hard safety and local recovery may need different semantics.

### F4 — final-command projection/revalidation

**Status:** ARCHITECTURE CANDIDATE.

Keep generic motion continuity, then constrain/revalidate final commanded velocity.

Risk: naive clipping/projection can cause wall sliding, oscillation or destroy motion-quality bounds.

### F5 — constraint-aware actuator

**Status:** ARCHITECTURE CANDIDATE.

Actuator shapes temporal motion inside a known admissible motion region.

Risk: coupling/complexity between movement feel and navigation constraints.

### F6 — character-controller substrate comparison

**Status:** CONDITIONAL ESCALATION CANDIDATE, not current decision.

Historical S0 planning considered character-controller/kinematic resolution, while actual S0 baseline uses dynamic Rapier bodies with velocity assignment. Dynamic actor pushing is valuable evidence but can legitimately move actors into planning comfort violations.

Only compare KCC/alternative character movement if R1 evidence shows the current dynamic-body + query contracts cannot be made robust without accumulating special cases.

---

## G. Explicitly paused/deferred

### G1 — S5 relationship-field authority

**Status:** PAUSED.

Preserve the qualified shadow field and centroid-collapse/topology finding. Do not allow it to control movement until R1 passes.

### G2 — soft contact

**Status:** DEFERRED.

Hard contact remains useful because it exposes missing cooperation/recovery. Softness may later improve feel but must not mask R1 failures.

### G3 — combat, commands, multiple companions, ORCA/RVO, LLM

**Status:** DEFERRED by R1 scope.

R1 is movement robustness + causal workbench, not a general companion architecture stage.

---

## H. Current decision checkpoint

R1 implementation must begin with **red reproductions**, not with query flag changes or recovery code.

First three decisive experiments:

1. **Clearance egress fixture** — physically legal but desired-clearance-violating start; target away from obstacle.
2. **Push/release fixture** — moving player pushes companion into boundary state, then conflict disappears.
3. **Actuator boundary fixture** — compare safe preferred/refined motion against final NATURAL commanded motion near geometry.

The result of those experiments determines whether C1, C2, C3/C4 or a different mechanism is primary.
