# R1 — Audit Ledger

Status: **LIVE LEDGER · R1-4 AUDITED MECHANICAL PASS · OWNER BROWSER GATE OPEN**

Date: 2026-09-14

Purpose: keep demonstrated facts, Owner evidence, hypotheses, process debt and next-stage candidates separate. Historical R1 planning remains useful, but this ledger is the current compact authority for what the campaign has actually established.

## Legend

- **PASS / demonstrated** — directly supported within the stated evidence scope.
- **OWNER-EVIDENCED** — established by Owner browser/play evidence; mechanism may subsequently be narrowed by automation.
- **MATERIAL FINDING** — strong evidence with practical consequence.
- **LEADING HYPOTHESIS** — plausible and code-grounded, but still requires a dedicated falsifier.
- **PROCESS DEBT** — evidence/workflow weakness that can distort future decisions.
- **PAUSED / DEFERRED** — intentionally outside current authority.

## A. Defended foundations

### A1 — World remains physical authority

**PASS / defended.** Brains produce intent; World/Rapier establish actual physical outcome. Debug reports evidence and does not replace World truth.

### A2 — fixed-step/headless apparatus remains useful

**PASS within research scope.** It supports deterministic scenario construction, regression fixtures, causal pre/post evidence and browser-independent validation.

### A3 — whole-body static queries and deterministic static routing remain useful

**PASS as bounded primitives.** S2 proved center-point reachability insufficient. R1 later corrected the meaning of their clearance contract rather than discarding whole-body spatial evidence.

### A4 — route guidance and local locomotion remain separate responsibilities

**PASS as a seam.** S3 Owner evidence established a material responsiveness improvement when the route became guidance and omnidirectional local locomotion selected short-horizon motion.

### A5 — debug is a peer research product

**PASS conceptually and mechanically.** R1-1 moved textual inspection out of the playfield and introduced phase-coherent decision/outcome evidence. Final Owner judgement of workbench ergonomics remains part of R1-6.

## B. Owner-evidenced failures that changed the architecture

### B1 — S1 endpoint-valid positioning was insufficient

**OWNER-EVIDENCED / preserved.** Doorway play showed that a sensible relationship target does not imply traversability, dynamic cooperation or progress awareness.

### B2 — S4 autonomous zero-motion lock was real

**OWNER-EVIDENCED, mechanism later reproduced.** The simulation could continue while the companion remained in `UNREACHABLE -> HOLD -> zero motion` after ordinary dynamic play.

### B3 — S4 HUD could occlude physical truth

**OWNER-EVIDENCED / repaired at apparatus level.** Textual causal inspection now lives outside the world viewport in the R1 workbench.

### B4 — responsiveness was more valuable than small naturalness gains when robustness regressed

**OWNER judgement / prioritization.** This is why R1 interrupted S5 and further feel tuning.

## C. R1 findings now resolved or promoted

### C1 — desired-clearance prison

**DEMONSTRATED in R1-0; repaired in R1-2.**

A physically legal body could start inside the enlarged desired-clearance envelope. The old query/planning contract could then reject hard-feasible egress and convert comfort violation into autonomous immobility.

Current contract:
- hard body feasibility owns connectivity/legality;
- desired clearance is separate quality evidence;
- physically legal egress can be rehabilitated;
- truly too-narrow hard geometry remains unreachable.

### C2 — temporal actuation could violate the validated spatial command

**DEMONSTRATED in R1-0; repaired for hard static geometry in R1-3.**

NATURAL continuity can modify an upstream safe preferred command. A final hard-static command gate now validates the actual next-step command after temporal realization and falls back to a hard-safe upstream command or explicit stop.

Important boundary: this final gate currently validates **static hard geometry only**. Dynamic player-conflict safety remains a separate R1-5 question, not a solved consequence of R1-3.

### C3 — unreachable / arrived / hold needed explicit temporal semantics

**DEMONSTRATED architecture gap; materially repaired in R1-4.**

R1-4 now exposes explicit post-World states/actions including route-invalid, transient/persistent unreachable, blocked-player, no-progress, recovering, progressing, moving-objective tracking and arrived.

### C4 — local recovery needed bounded authority

**PASS within R1-4 scope.** Only `RETRY_LOCAL` resets local movement-realization state. It does not mutate World truth, invent a relationship target or take route authority.

### C5 — post-qualification R1-4 coverage was initially too narrow

**MATERIAL FINDING / repaired before Owner gate.**

The first R1-4 qualification passed 104 tests, but a later claim-vs-code audit added falsifiers that exposed:
1. retry budget behaving like a lifetime cap on a long-lived semantic objective rather than re-arming after healthy progress;
2. healthy back-and-forth moving-target tracking collapsing because only endpoint displacement was measured;
3. Euclidean proximity winning over invalid/unreachable route truth;
4. an additional defensive route-metric arrival inconsistency.

The first three new regressions failed while all prior 104 tests remained green. After repair, a fourth route-aware arrival falsifier was deliberately made red and then repaired.

Audited application runtime: `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`.

Final runtime evidence:
- 21/21 test files PASS;
- 108/108 tests PASS;
- TypeScript PASS;
- production build PASS;
- Pages build/deploy PASS.

The lesson is not that automated evidence is untrustworthy. It is that qualification claims must stay narrower than the exercised behavior surface.

## D. Current open hypothesis before R1-5

### D1 — dynamic final-command authority gap

**LEADING HYPOTHESIS / code-grounded, not yet reproduced.**

Current local locomotion already predicts short-horizon player/companion conflict and can reject preferred velocity candidates with `player-predicted-collision`. NATURAL continuity then changes the selected move. The R1-3 final command gate subsequently revalidates **static geometry**, but does not re-run the dynamic player-conflict contract on the realized command.

Therefore the architecture has the same *shape* as the earlier static pre-R1-3 gap:

`dynamic-safe preferred move -> temporal realization changes command -> no final dynamic revalidation -> World`

This must become the first R1-5 falsifier. Do not add a final dynamic gate merely because the symmetry looks compelling; first prove whether NATURAL can actually turn a player-safe preferred move into a materially conflicting final command.

## E. Process/evidence debt

### E1 — Owner rehearsal evidence historically outran regression coverage

**PROCESS DEBT, partially repaid.** S1 and S4 Owner runs exposed failures not represented by then-current fixed-target tests. R1 promoted many of those classes into deterministic dynamic rehearsals. The R1-4 post-qualification audit showed this discipline must continue.

### E2 — robustness work was skipped once after responsiveness improved

**PROCESS DEBT / sequencing lesson.** S3 responsiveness success led into S4 naturalness and S5 shadow work before planned progress/recovery and constrained-space cooperation were complete. R1 exists to finish that missing foundation before upstream authority expands.

### E3 — fine DIRECT/NATURAL A/B feel conclusions remain limited

**OPEN EXPERIMENT-DESIGN DEBT.** The workbench now shares repaired spatial/recovery semantics, but actuator switching/state and manual Owner interaction still make fine motion-quality comparison less controlled than a dedicated identical-evidence A/B harness.

## F. Current R1-4 evidence boundary

**Mechanical/audit/delivery: PASS. Owner browser gate: OPEN.**

The outstanding Owner run should stress:
- repeated independent block/release episodes on the same semantic relationship objective;
- rapid reversals / back-and-forth moving target;
- push/pin/release near static geometry;
- doorway and cross-front contention;
- DIRECT/NATURAL comparison;
- causal legibility of `retry episode` vs cumulative applied retries and state-transition reasons.

Do not promote R1-4 to Owner-qualified merely from the 108-test suite.

## G. R1-5 direction — planning authority only until Owner gate

R1-5 should be treated as **dynamic player-conflict authority + constrained-space cooperation**, not as a generic avoidance tuning pass.

Required properties:
- player priority can be asymmetric without converting the player into a permanent paralysis obstacle;
- open-space conflict should normally be resolved by proactive passing/repositioning rather than passive waiting;
- tight chokes may justify explicit yield/wait/back-off responsibility;
- pass/yield choice needs enough commitment/hysteresis to avoid left/right thrash;
- release/resume conditions must be public and bounded;
- player cooperation must remain downstream of relationship-target representation so it does not hard-code the obsolete S1 eight-slot model;
- any final dynamic-command authority must be earned by a red reproduction, not installed pre-emptively.

No doorway-specific script qualifies as a general repair.

## H. S5 relationship field

**PAUSED / useful donor candidate.**

S5-A established a 96-sample route-aware continuous relationship field, bounded shortlist and coherent connected good-region logic. Its centroid-collapse falsifier produced a real topological correction. It never received movement authority.

S5 branch changes are isolated to the field module/tests/docs relative to its S4 base. When R1 eventually passes its Owner robustness gate, S5 should be **transplanted/rebased as a donor onto the post-R1 line and independently requalified**, not merged wholesale as if its old S4 substrate were still authoritative.

First resumed S5 phase should remain shadow visualization against the preserved S1 target. Movement authority comes only after new Owner evidence.

## I. Deferred / escalation boundary

Still deferred during R1:
- combat/enemies;
- command system;
- multiple companions;
- LLM cognition;
- soft-contact replacement;
- generic shared runtime extraction;
- production navigation architecture;
- ORCA/RVO or other large crowd stack by default.

Escalate to a broader character-controller/navigation/local-avoidance substrate comparison only if bounded R1-5 work requires accumulating special cases, oscillates despite explicit conflict commitment, or the current candidate-movement substrate cannot express robust player cooperation cleanly.

## J. Current decision checkpoint

1. Complete the audited R1-4 Owner browser gate before granting new movement authority.
2. Planning and deterministic red falsifiers for R1-5 may proceed in parallel because they do not alter the Owner-test runtime.
3. First R1-5 question: **can the final NATURAL command violate a dynamic player-conflict decision that was valid at the preferred-motion layer?**
4. If falsified, do not add redundant dynamic final-command machinery; move directly to right-of-way / commitment / yield semantics.
5. If reproduced, repair that authority seam before judging higher-level yielding behavior.
6. After R1-5 mechanical qualification, run the dedicated R1-6 Owner robustness gate.
7. Only then reconsider S5 shadow visualization and eventual authority.
