# S1 Relational Positioning — Qualification State

Status: **OWNER-BROWSER INFORMATIVE FAIL / RESEARCH EVIDENCE PRESERVED**  
Application evidence SHA: `7dca836985f4023cd2166222e67ab754d99c2e9b`  
Base physical apparatus: qualified S0 merge `448ca9c86f219d9c18a8898dfa36d0b9a82cdce1`

## Final S1 claim

S1 successfully isolated a deeper missing competence, but the relational-positioning policy is **not** sufficient as a movement foundation for a useful companion.

The experiment demonstrated that endpoint-relative positioning is not enough. A companion can choose a spatially reasonable and locally clear relationship point while still having no representation of whether the traversal to that point is feasible, contested or making progress.

This is an informative failure and should be preserved as evidence, not tuned into apparent success with doorway-specific exceptions.

## Automated evidence remains valid

The exact application evidence SHA passes the full repository check:

- strict TypeScript compile: **PASS**;
- S0 physical/domain tests: **9/9 PASS**;
- S1 relational-brain tests: **8/8 PASS**;
- total tests: **17/17 PASS**;
- Vite production build: **PASS**;
- npm install audit in the qualifying CI run: **0 vulnerabilities**.

Qualifying push run: `34787946799`.

Observed production artifact on that run:

- JS: ~3,541.26 kB minified;
- gzip: ~1,175.85 kB.

The bundle remains dominated by the existing Phaser + deterministic Rapier/WASM apparatus. S1 does not materially change the current research-bundle cost.

## Owner/browser evidence

The Owner tested the pinned S1 runtime and identified a material failure around the doorway: the companion can block or become blocked in the passage and the current behavior is too shallow to recover intelligently.

Review of the recording is consistent with three distinct missing capabilities:

1. **Traversal feasibility** — candidate validity checks the destination point, not the swept/path corridor from companion to destination.
2. **Dynamic cooperation in constrained space** — the companion has no concept of yielding, right-of-way, contested passage or short-horizon player/companion conflict.
3. **Progress awareness / recovery** — the companion does not know that it has been requesting motion without making meaningful progress, cannot classify the blocker and cannot trigger a causally appropriate recovery.

The recording also shows why this is not primarily a collision-model problem. S0 hard contact remains stable enough to expose the failure. Softer contact could improve feel later, but would currently risk masking a missing reasoning/movement layer.

## Why the current implementation fails causally

The relational probe deliberately contains only:

- endpoint candidate generation around the player;
- static endpoint-clearance checks;
- a scalar candidate score;
- hysteresis;
- direct `intentToward(target)` steering.

It contains no route representation and no path-progress state. Therefore a target may be valid while the direct traversal is blocked by world geometry or by the player. The motor keeps requesting movement toward that target because nothing in the public state tells the brain that the attempted traversal is infeasible or stalled.

This is now evidence, not a hypothetical concern.

## What S1 did establish usefully

S1 remains valuable because it established clean seams that should survive the next experiment unless evidence rejects them:

- relationship intent can remain separate from physical execution;
- brain logic consumes public World state and emits ordinary intent rather than mutating physics;
- decision cadence can be slower than the 60 Hz motor/physics loop;
- candidate evaluation and selection can be inspectable and deterministic;
- a deliberately weak baseline (CHASE) is useful for comparison;
- visible causal debug is already materially useful to Owner testing.

The fixed eight-slot policy itself is **not** canonized. It remains a probe.

## Debug finding

The existing S1 overlay is useful but insufficient for deeper work. It shows selected relationship target, candidate scores, requested/actual motion and contact state, but it cannot answer the questions that now matter:

- Is the target reachable?
- Is the direct corridor clear for the companion's radius?
- What route is currently intended?
- What is the next waypoint?
- What collider/actor blocks progress?
- How long has progress been below expectation?
- Did the system replan, yield, wait or recover, and why?
- What changed immediately before a bad behavior?

The next stage must treat this observability as first-class research apparatus, not UI polish.

## Preserved soft-contact hypothesis

The Owner-proposed hard-core + compressible-envelope idea remains explicitly deferred. The hard-contact baseline is doing useful falsification work. A later A/B may test compliant contact once navigation/yielding failures are no longer being confused with collision feel.

## Next stage

Proceed to the bounded **S2 Movement Intelligence + Debug Workbench** plan.

S2 should not begin with a full general-purpose navmesh, crowd simulator or AI architecture. It should first establish:

1. traversal-feasibility queries;
2. an explicit route/progress representation;
3. a deterministic, inspectable static routing competence appropriate to the current tiny 2D lab;
4. blocker classification and stuck/recovery state;
5. a substantially stronger debug/trace workbench;
6. then an Owner test of doorway/pillar cooperation before deciding whether explicit choke-point coordination or a more general navigation stack is actually required.
