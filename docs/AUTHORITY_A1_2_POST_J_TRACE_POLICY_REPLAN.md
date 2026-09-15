# Authority-A1.2 post-j trace/policy replan

Status: **planning only**. No new movement authority.

Base truth: A1.2j exact qualified head `19d69e214840290c17d10316c332a3c07ff469be`, validate #963 PASS.

## Why this replan exists

A1.2j is the first qualified A1 slice that executes one causally-qualified player future and one G1/G2-qualified DIRECT companion command in the same query-only clone of the live Rapier World. We now have real joint body trajectories and reciprocal player↔companion contact records.

That changes what G3 is allowed to mean.

A1.2e/f reasoned about analytical/piecewise trajectories whose player branch could stop at the first static contact. A1.2f later proved that this approximation can report CLEAR while the live Rapier player slides around the static contact and enters a materially different player↔companion relationship. A1.2g–j removed that physical-model gap.

We must not now hide a new approximation inside the G3 adapter.

## Long-term project intent

The point of this work is not to maximize the number of authority layers. The target is a companion that behaves like a live teammate in one shared physical reality: it reads player movement, preserves local continuity, yields or commits for causal reasons, avoids pathological obstruction, and can later support combat, commands and a richer local live brain.

Hard-body safety is a necessary substrate for that teammate loop, not the final behaviour model.

After the remaining G3 physical-truth boundary is qualified, work should deliberately bias back toward **G4 cooperation/right-of-way and natural shared movement**, rather than indefinitely expanding pre-runtime safety infrastructure.

## New boundary discovered after A1.2j

A same-physics joint rehearsal publishes **post-step ActorSnapshots plus contact records**.

Post-step positions alone are not continuous-collision truth. Rapier can detect and resolve a collision inside a World step before the published body positions are sampled. Conversely, a contact record is physical evidence that interaction occurred even if the post-step hard clearance is positive.

Therefore:

**joint physical trace evidence ≠ G3 policy decision**

The first new slice must characterize what happened without deciding whether that event is acceptable teammate behaviour.

## A1.2k — joint hard-body trace evidence

Scope: pure evidence adapter over one qualified A1.2j result plus its aligned initial A1 situation.

It should publish at minimum:

- source tick and exact World-step horizon provenance;
- initial player/companion hard radii and hard clearance;
- one sampled hard clearance per physical frame;
- minimum sampled clearance, its step/time and terminal clearance;
- whether any player↔companion contact record occurred;
- whether contact evidence was reciprocal in the same frame;
- first/last contact step and contact-frame count when present;
- whether sampled clearance ever materially worsened from the initial state;
- whether an initially overlapping/touching pair shows sampled recovery;
- explicit scope: sampled post-step geometry + Rapier contact records, **not continuous-time closest-approach reconstruction**.

A1.2k must not output PASS/HOLD/FAIL, utility, cooperation quality or selection authority.

Critical falsifiers should include:

1. open parallel joint motion: no contact and positive clearance despite tiny solver-level relative drift;
2. `head-on`: reciprocal contact is retained even if solver-resolved sampled positions do not show the analytical overlap predicted by old A1.2e;
3. synthetic or qualified initial-touch/overlap traces: recovery/worsening observations are factual evidence rather than policy;
4. malformed trace provenance / wrong source tick / actor/radius mismatch is rejected;
5. live World remains untouched because k consumes j evidence only.

No global safety epsilon may be enlarged to hide Rapier numeric drift. Numeric tolerance used for provenance/alignment must remain separate from the actual measured clearances.

## A1.2l — G3 policy over qualified trace evidence

Only after A1.2k qualifies should G3 be redesigned over real joint-trace evidence.

Candidate policy distinctions worth preserving from A1.2f, subject to fresh falsification:

- new material hard overlap is not an ordinary PASS;
- worsening pre-existing overlap is worse than recovery;
- monotonic/credible egress from pre-existing overlap may be allowed;
- exact/predicted contact should not be silently collapsed into either overlap or ordinary clear motion.

But old status semantics are **not automatically canonical**. In particular, A1.2l must distinguish:

- **hard-body physical safety**: what the shared solver actually allowed/resolved;
- **contact occurrence**: whether bodies interacted;
- **cooperation quality**: whether the companion pressed, blocked, cut across, yielded or behaved socially well.

That third question belongs primarily to G4, not to G3.

A conservative G3 may keep an explicit indeterminate/hold-like outcome for solver-resolved contact until G4 exists, but it must not claim that “no sampled overlap” means “good teammate behaviour.”

## After A1.2l

Do a fresh readiness decision before building more matrix/selector infrastructure.

Preferred direction if hard-body truth is now adequate:

**G4 cooperation/right-of-way → natural teammate movement experiments → only then robustness/selection/runtime promotion.**

Questions for G4 include player corridor ownership, crossing trajectories, yielding, following/pace, recovery after contention and avoiding sustained contact pressure. These should be evaluated on the same physical joint futures rather than returning to endpoint-only abstractions.

## Deferred / non-claims

This replan does not authorize:

- runtime movement;
- candidate selection or winner/tie-break logic;
- robustness aggregation across H1/H2/H3;
- TEMPORAL candidate execution;
- comfort-envelope policy;
- final navigation architecture;
- treating current G2 straight static sweep as permanent doctrine;
- treating current G3 labels as permanent doctrine;
- treating contact itself as either always unsafe or always acceptable.

The next promotion boundary is evidence quality, not feature count.