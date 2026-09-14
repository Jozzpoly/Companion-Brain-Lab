# R1 — Consolidated Historical Audit Ledger

Status: **HISTORICAL EVIDENCE · R1-4 MECHANICAL PASS PRESERVED · OWNER BROWSER FAIL PRESERVED · SUPERSEDED FOR LIVE AUTHORITY BY FOUNDATION AUDIT**

Date: 2026-09-14

This file is the compact historical ledger for R1. It no longer claims to be the live project authority.

Current live state and readiness authority:
- [`FOUNDATION_RUNTIME_SURVIVAL_AUDIT.md`](FOUNDATION_RUNTIME_SURVIVAL_AUDIT.md)
- [`FOUNDATION_ACTIVE_AUTHORITY_MAP.md`](FOUNDATION_ACTIVE_AUTHORITY_MAP.md)

Detailed S/R-stage qualification files remain preserved for exact evidence. Git history retains the earlier long-form planning ledger.

## Evidence legend

- **PASS / demonstrated** — directly supported within the stated evidence scope.
- **OWNER-EVIDENCED** — established by Owner browser/play evidence.
- **MATERIAL FINDING** — strong evidence with practical architectural consequence.
- **HISTORICAL MECHANICAL PASS** — automated evidence that remains true for that exact source/runtime, but does not override later Owner evidence.
- **DEFERRED** — intentionally outside the stage's authority.

## Defended foundations carried forward

### World remains physical authority

**PASS / defended.** Brains request motion; World/Rapier establish actual physical outcome. Debug reports evidence rather than inventing physical truth.

### Whole-body spatial queries are required

**PASS as a primitive.** S1 showed that endpoint validity alone is insufficient. S2 established body-radius traversal evidence and deterministic static routing as useful bounded primitives.

### Route guidance and local locomotion are separate responsibilities

**PASS as a seam.** S3 Owner evidence materially improved responsiveness when route output became guidance and local locomotion chose short-horizon omnidirectional motion.

### Debug is a peer research product

**PASS conceptually.** Owner use repeatedly demonstrated the value of exposing target, route, preferred/commanded/actual movement, blockers, progress and state transitions. Later foundation work strengthens its fault-survival and semantic clarity.

## Owner-evidenced failures that changed the architecture

### S1 endpoint-valid positioning was insufficient

**OWNER-EVIDENCED.** Doorway play demonstrated that a sensible relationship target does not imply traversability, dynamic cooperation or progress awareness.

### S4 autonomous zero-motion lock was real

**OWNER-EVIDENCED.** Simulation could continue while the companion remained in an autonomous `UNREACHABLE/HOLD/zero-motion` state after ordinary dynamic play.

### In-world debug could hide physical truth

**OWNER-EVIDENCED.** Large HUD/debug presentation interfered with visual diagnosis. R1 moved causal textual inspection into a side workbench while retaining spatial overlays in the world.

### Responsiveness had higher value than small feel gains when robustness regressed

**OWNER judgement.** This redirected work away from premature naturalness/relationship-field expansion and into R1 robustness.

## R1 findings and repairs

### Desired-clearance prison

**DEMONSTRATED and materially repaired.**

A physically legal body could be inside an enlarged desired-clearance envelope. Treating that comfort envelope as hard connectivity could prevent legal egress.

R1 separated:
- hard body feasibility / legality;
- desired comfort clearance / quality evidence.

Foundation work later extends this into explicit hard-overlap egress semantics.

### Temporal actuation could invalidate spatially safe preferred motion

**DEMONSTRATED for hard static geometry and repaired in R1-3.**

NATURAL continuity modifies upstream preferred motion. R1 introduced final hard-static command validation and bounded fallback rather than assuming the preferred-motion proof still applied after temporal shaping.

Dynamic player-conflict final authority remained deliberately unresolved rather than being claimed solved by symmetry.

### Unreachable / arrived / hold required post-World temporal semantics

**DEMONSTRATED architecture gap; materially repaired in R1-4.**

R1-4 added explicit post-outcome states and actions covering arrival, progress, moving-objective tracking, intentional/unexplained hold, player/static blocking, invalid route, transient/persistent unreachable, recovery and no-progress.

### Recovery authority must be bounded

**PASS within R1-4 scope.**

Only local retry resets movement-realization state. It does not mutate World truth, invent objectives, silently take route authority or execute scenario-specific escape scripts.

### Qualification claims initially outran coverage

**MATERIAL PROCESS FINDING.**

R1-4 first passed 104 tests. A later claim-vs-code audit deliberately added red regressions that exposed:
- retry budget behaving as a lifetime cap instead of an episode budget;
- reversing moving-target tracking being misclassified by endpoint-only displacement;
- Euclidean arrival winning over invalid/unreachable route truth;
- a defensive route-metric arrival inconsistency.

Those cases were repaired and retained as regression evidence.

Exact audited R1-4 application runtime:
`8f08761cdfde3f0b5d3e595f4bb844d106104ed4`

Historical mechanical evidence:
- 21/21 test files PASS;
- 108/108 tests PASS;
- strict TypeScript PASS;
- production build PASS;
- Pages build/deploy PASS.

This evidence remains valid for that exact scope.

## Later Owner browser failure — why R1-4 is not the live robustness authority

**OWNER-EVIDENCED FAIL / historical mechanical evidence preserved.**

A later Owner browser run reproduced a whole-workbench freeze during an ordinary constrained-world interaction. The last completed causal frame stopped advancing while the rendered workbench still appeared `RUNNING`.

Foundation diagnosis found ordinary world states could still reach exception paths, including:
- slight hard-body static penetration after physical contact;
- initial-overlap traversal semantics rejecting outward egress;
- simultaneous dynamic rejection of STOP;
- zero admissible local candidates reaching the preserved S3 throw;
- legacy relationship exhaustion reaching a second ordinary-state throw.

Therefore the prior statement “R1-4 mechanical pass, Owner gate open” is historical only. It does not authorize new work on the assumption that the runtime substrate is robust.

The active repair/readiness campaign is documented in `FOUNDATION_RUNTIME_SURVIVAL_AUDIT.md`.

## Process lessons carried forward

### Owner evidence must become regression evidence

S1, S4 and the later R1-4 browser failure each exposed behavior outside the then-current automated surface. New failure classes should be promoted into bounded deterministic regressions whenever possible.

### Green tests do not widen a claim automatically

A test suite proves only the exercised contract. Qualification language must remain narrower than the tested behavior surface.

### Historical experiments are donors, not implicit authority

S0–S5 and R1 layers remain valuable evidence. Their modules, docs and tests may be reused selectively, but the presence of old code must not silently restore old top-level authority.

### DIRECT/NATURAL fine-feel evidence remains limited

The A/B workbench is useful for broad comparison, but exact feel judgement remains an Owner/runtime question and should not be inferred from mechanical regressions alone.

## Preserved future directions — not R1 claims

The following remained intentionally unresolved and are now candidates for the post-foundation aggressive redesign rather than cleanup blockers:

- continuous/region-based relationship representation replacing the legacy eight slots;
- dynamic player movement corridor, right-of-way and chokepoint cooperation;
- pace / urgency / catch-up speed authority;
- redesign of the `MotionIntent` contract;
- multi-companion coordination;
- commands and combat;
- selective transplant of old S5 relationship-field research;
- possible alternative character movement/controller substrate only if evidence justifies escalation.

## Final R1 disposition

R1 produced valuable architecture seams, regression evidence and causal tooling, but its last mechanically qualified runtime did **not** survive the final Owner robustness challenge.

Therefore:

> R1 is preserved as a strong research donor and evidence layer, not as the final foundation to build the next large companion architecture on unchanged.

The foundation-hardening campaign owns the current readiness decision.
