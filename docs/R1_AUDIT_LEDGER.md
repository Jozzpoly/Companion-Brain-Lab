# R1 — Audit Ledger

Status: **LIVE LEDGER · R1-4 AUDITED MECHANICAL PASS / OWNER GATE OPEN · R1-5A MECHANICAL PASS / OWNER EVIDENCE NOT YET RUN**

Date: 2026-09-14

Purpose: keep demonstrated facts, Owner evidence, hypotheses, rejected repair shapes, process debt and next-stage candidates separate. Historical planning remains useful, but this ledger is the compact authority for what the campaign has actually established.

## Legend

- **PASS / demonstrated** — directly supported within the stated evidence scope.
- **OWNER-EVIDENCED** — established by Owner browser/play evidence; mechanism may subsequently be narrowed by automation.
- **MATERIAL FINDING** — strong evidence with practical consequence.
- **LEADING HYPOTHESIS** — plausible and code-grounded, but still requires a dedicated falsifier.
- **REJECTED CANDIDATE** — explicitly tested repair/policy shape that failed an important tradeoff or claim.
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

**PASS conceptually and mechanically.** R1-1 moved textual inspection out of the playfield and introduced phase-coherent decision/outcome evidence. R1-5A now also transports final player-authority evidence into the same workbench and incident trace. Final Owner judgement of workbench ergonomics remains an Owner question.

## B. Owner-evidenced failures that changed the architecture

### B1 — S1 endpoint-valid positioning was insufficient

**OWNER-EVIDENCED / preserved.** Doorway play showed that a sensible relationship target does not imply traversability, dynamic cooperation or progress awareness.

### B2 — S4 autonomous zero-motion lock was real

**OWNER-EVIDENCED, mechanism later reproduced.** The simulation could continue while the companion remained in `UNREACHABLE -> HOLD -> zero motion` after ordinary dynamic play.

### B3 — S4 HUD could occlude physical truth

**OWNER-EVIDENCED / repaired at apparatus level.** Textual causal inspection now lives outside the world viewport in the R1 workbench.

### B4 — responsiveness was more valuable than small naturalness gains when robustness regressed

**OWNER judgement / prioritization.** This is why R1 interrupted S5 and further feel tuning.

## C. R1-0 through R1-4 findings resolved or promoted

### C1 — desired-clearance prison

**DEMONSTRATED in R1-0; repaired in R1-2.**

A physically legal body could start inside the enlarged desired-clearance envelope. The old query/planning contract could reject hard-feasible egress and convert comfort violation into autonomous immobility.

Current contract:
- hard body feasibility owns connectivity/legality;
- desired clearance is separate quality evidence;
- physically legal egress can be rehabilitated;
- truly too-narrow hard geometry remains unreachable.

### C2 — temporal actuation could violate the validated static command

**DEMONSTRATED in R1-0; repaired for hard static geometry in R1-3.**

NATURAL continuity can modify an upstream safe preferred command. A final hard-static command gate validates the actual next-step command after temporal realization and falls back to a hard-safe upstream command or explicit stop.

R1-5A later demonstrated that static command authority alone was not sufficient for player physical authority.

### C3 — unreachable / arrived / hold needed explicit temporal semantics

**DEMONSTRATED architecture gap; materially repaired in R1-4.**

R1-4 exposes explicit post-World states/actions including route-invalid, transient/persistent unreachable, blocked-player, no-progress, recovering, progressing, moving-objective tracking and arrived.

### C4 — local recovery needed bounded authority

**PASS within R1-4 scope.** Only `RETRY_LOCAL` resets local movement-realization state. It does not mutate World truth, invent a relationship target or take route authority.

### C5 — post-qualification R1-4 coverage was initially too narrow

**MATERIAL FINDING / repaired before Owner gate.**

The first R1-4 qualification passed 104 tests, but a later claim-vs-code audit exposed:
1. retry budget behaving like a lifetime cap rather than re-arming after healthy progress;
2. healthy back-and-forth moving-target tracking collapsing because only endpoint displacement was measured;
3. Euclidean proximity winning over invalid/unreachable route truth;
4. an additional defensive route-metric arrival inconsistency.

Audited R1-4 application runtime:

`8f08761cdfde3f0b5d3e595f4bb844d106104ed4`

Evidence:
- 21/21 test files PASS;
- 108/108 tests PASS;
- TypeScript PASS;
- production build PASS;
- Pages build/deploy PASS.

R1-4 Owner/browser qualification remains open.

## D. R1-5A — final player physical authority

### D1 — NATURAL could invalidate an upstream player-safe decision

**MATERIAL FINDING / deterministic RED + real World consequence.**

Historical evidence:

`docs/R1_5A_DYNAMIC_FINAL_COMMAND_RED_EVIDENCE.md`

Primary RED run: `34864314897`.

The demonstrated failure shape was:

`player-aware preferred/refined motion`

`-> NATURAL continuity changes command`

`-> final static gate accepts command because no static blocker exists`

`-> materially player-disturbing command reaches World`.

In the material A/B before repair:
- DIRECT produced zero player displacement and zero motion error;
- NATURAL produced five contact frames, about `0.00698 m` player displacement and about `0.22756 m/s` player motion error.

This promoted the former hypothesis into a real R1-5 authority gap.

### D2 — S3 comfort prediction is not final physical authority

**REJECTED CANDIDATE / preserved falsification evidence.**

The existing S3 player model uses a `0.55 s` horizon and `0.18 m` comfort buffer. Applying that entire envelope as a final hard gate was safe but too intrusive:
- head-on moving-player trial required `17` emergency corrections;
- cross-front trial could end farther from its objective than it began.

Therefore:

> long-horizon player comfort/right-of-way policy and final physical player authority are distinct responsibilities.

The broad projection result remains a regression/falsification record in `r1-player-conflict-projection-matrix.test.ts`.

### D3 — contact manifold is not the player-agency failure definition

**MATERIAL SEMANTIC CORRECTION.**

Rapier can report contact-manifold frames near the physical boundary while requested-vs-actual player motion remains undisturbed. Physical-only horizon sweeps also showed contact counts were not monotonic with predictive horizon.

R1-5A therefore treats player-agency failure as material penetration/pushing or requested-vs-actual player disturbance attributable to the companion command, not merely the existence of a collider contact manifold.

### D4 — narrow final player physical authority

**MECHANICAL QUALIFICATION PASS.**

Qualified component:

`src/brain/final-player-command-constraint.ts`

Qualified execution order:

`NATURAL continuity -> static final authority -> player physical final authority -> World`.

The final player gate:
- uses one-physics-step physical prediction;
- does not import the S3 `0.18 m` comfort buffer;
- maintains a `0.002 m` physical hard margin when normally separated;
- uses egress semantics at/inside the boundary;
- repairs toward already player-aware preferred motion;
- refuses to reintroduce static hard blockers;
- resets only temporal actuator history if it changes the final command.

Exact qualified application checkpoint:

`c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`

Final run:

`34872858900`

Result:
- 31/31 test files PASS;
- 122/122 tests PASS;
- TypeScript PASS;
- production build PASS.

Detailed qualification:

`docs/R1_5A_PLAYER_AUTHORITY_QUALIFICATION.md`

### D5 — final authority remains rare rather than becoming hidden steering

**PASS in current deterministic matrix.**

Integrated real-brain World matrix:
- abrupt-turn material RED class: `2 / 36` final player-authority interventions, maximum player motion error `0`;
- head-on moving player: `0 / 72` interventions;
- cross-front moving player: `0 / 72`;
- player reversal: `0 / 72`.

This defends the current boundary as a rare emergency authority layer rather than a second local movement policy.

### D6 — static and player final authority remain composable

**PASS in bounded composition evidence.**

An adversarial same-frame wall/player fixture showed:
- static final gate can repair stale NATURAL motion first;
- the player final gate can then accept that already player-aware static fallback unchanged;
- no hard-static blocker is reintroduced.

A full doorway reversal/recovery run reached its target with one local retry and no persistent failure; upstream policy handled the player without requiring the emergency player gate.

### D7 — R1-5A evidence is visible to Owner/debug tooling

**PASS mechanically.**

Workbench and incident trace now preserve player final-authority source, intervention state, current/required physical clearance, original/final predicted clearance and reason separately from static final authority.

Incident schema is `companion-brain-lab-r1-causal-incident-v3`.

Browser/Owner ergonomics of this evidence are not yet Owner-qualified.

## E. Current open R1-5 hypothesis after R1-5A

### E1 — explicit cooperation/right-of-way may still be needed

**LEADING HYPOTHESIS / R1-5B NOT STARTED AS ACTIVE AUTHORITY.**

R1-5A prevents a final NATURAL command from materially taking player agency. It does not decide what good cooperation should look like before the emergency boundary is reached.

Open questions include:
- stable passing-side choice;
- player-first vs companion-first right-of-way;
- whether ordinary open-space conflicts need explicit commitment or existing candidate policy is enough;
- intentional wait/yield/back-off in a real choke;
- release/resume timing;
- avoiding left/right or go/stop thrash;
- preserving a moving relationship objective while treating the player as a high-priority dynamic actor.

R1-5B should remain upstream of the final hard player gate. Do not turn the emergency boundary into a social policy system.

## F. Process/evidence debt

### F1 — Owner rehearsal evidence historically outran regression coverage

**PROCESS DEBT, materially repaid but permanently relevant.** S1 and S4 Owner runs exposed failures absent from then-current tests. R1-4 and R1-5A both used RED-first falsification to promote those classes into deterministic evidence.

### F2 — robustness work was skipped once after responsiveness improved

**PROCESS DEBT / sequencing lesson.** S3 responsiveness success led into S4 naturalness and S5 shadow work before planned progress/recovery and constrained-space cooperation were complete. R1 exists to finish that missing foundation before upstream authority expands.

### F3 — fine DIRECT/NATURAL feel conclusions remain limited

**OPEN EXPERIMENT-DESIGN DEBT.** Mechanical A/B evidence is strong for bounded invariants, but fine motion-quality judgement remains an Owner/browser task.

## G. Owner/public-runtime boundary

### R1-4

Mechanical/audit/delivery: **PASS**.

Owner browser gate: **OPEN**.

Public Pages remains pinned to exact audited R1-4 runtime `8f08761...`.

### R1-5A

Mechanical qualification: **PASS**.

Owner/browser evidence: **NOT YET RUN**.

Public Pages: **NOT PROMOTED**.

Do not infer Owner-qualified movement feel from the 122-test suite.

## H. R1-5B direction

Treat R1-5B as **cooperation/right-of-way policy**, not another emergency safety gate.

Required properties:
- asymmetric player priority without permanent paralysis;
- open-space conflict should normally retain useful motion when a pass exists;
- true chokes may justify explicit wait/yield/back-off;
- passing/yield choice needs commitment/hysteresis sufficient to avoid thrash;
- release/resume condition must be public and bounded;
- cooperation remains downstream of relationship-target representation;
- final player physical authority remains a last boundary rather than the mechanism for ordinary cooperation.

No doorway-specific script qualifies as a general repair.

## I. S5 relationship field

**PAUSED / useful donor candidate.**

S5-A established a 96-sample route-aware continuous relationship field, bounded shortlist and coherent connected good-region logic. Its centroid-collapse falsifier produced a real topological correction. It never received movement authority.

When R1 eventually passes the required Owner robustness evidence, S5 should be transplanted/rebased as a donor onto the post-R1 line and independently requalified, not merged wholesale with old S4 assumptions.

## J. Deferred / escalation boundary

Still deferred during this campaign:
- combat/enemies;
- command system;
- multiple companions;
- LLM cognition;
- soft-contact replacement;
- generic shared runtime extraction;
- production navigation architecture;
- ORCA/RVO or another large crowd stack by default.

Escalate substrate comparison only if bounded cooperation work requires accumulating special cases, persistent oscillation, destructive final clipping, or cannot remain causally separable from static routing and relationship intent.

## K. Current decision checkpoint

1. Preserve audited R1-4 public runtime and recoverable base.
2. R1-5A mechanical qualification is complete at application checkpoint `c84c1342...`.
3. Do **not** call R1-5A Owner-qualified until browser/play evidence exists.
4. Do **not** call all of R1-5 complete; R1-5B cooperation/right-of-way is a separate campaign.
5. Do not silently repin public Pages away from R1-4 while its Owner gate remains the published gate.
6. If the Owner finds a material R1-4 or R1-5A browser failure, that evidence outranks the current plan and reopens the relevant responsibility.
7. After appropriate Owner evidence, begin R1-5B with deterministic open-space passing/right-of-way falsifiers before adding explicit policy state.
8. Preserve S5 as a later donor, not current authority.
