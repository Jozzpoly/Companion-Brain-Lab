# Authority A1.2 — post-g future-causality replan

Status: **planning checkpoint only**. This document does not grant movement authority.

Base evidence: A1.2g exact qualified head `1b4dfee79b25458b982f11ddb17104454c7da554`, validate #942 PASS.

## Why the plan changes again

A1.2g solved a different problem than A1.2c–f: we can now branch the exact current Rapier physics state, rehearse hypothetical world-unit velocities through the same solver, observe static slide and dynamic player/companion contact, and leave live World unchanged.

That removes the need for a hand-written collision/contact-response approximation as future physical truth.

It does **not** answer what causal intervention each player-future hypothesis is allowed to impose on the cloned World.

A1.2c hypotheses are evidence about plausible player futures. A1.2g inputs are interventions: velocities actively written to cloned bodies every future physics step. Treating those as the same concept would silently promote observations into causes.

## Current causal split

### H1 — OWNER_REQUEST_CONTINUATION

Evidence source: same-step Owner request.

Candidate intervention semantics: **repeat the same Owner-request world velocity for the bounded rehearsal horizon**.

This is a clear counterfactual: "if the Owner continues the current request". It is not a prediction that the Owner certainly will.

### H3 — TRANSITION_HOLD

Evidence source: explicit transition control produced when the Owner stops/reverses or body causality is uncertain.

Candidate intervention semantics: **repeat zero player control over the bounded horizon**.

This remains an explicit conservative counterfactual, not an aggregation of H1/H2.

### H2 — BODY_RESPONSE_CONTINUATION

Evidence source: current observed body response.

This cannot have one universal rehearsal mapping.

Live World writes player requested velocity before every physics step. The current `actualVelocity` is therefore an *outcome* of prior control + contacts + solver response, not a persistent force/inertia source.

A0 provenance must constrain whether H2 may be promoted into a future intervention:

- `OWNER_DIRECTED`: repeating current body response may be evaluated as a bounded **body-response persistence counterfactual**, but must remain labelled as such rather than being called natural inertia;
- `STATIONARY`: needs explicit treatment; tiny residual body velocity must not automatically become long-horizon drift merely because it was observed once;
- `OWNER_CONSTRAINED`: current response is an effect of a constraint. Repeating it as control would erase the cause and is not qualified;
- `EXTERNAL_MOTION_EVIDENT`: current response is explicitly an externally caused effect and must not be converted into self-sustaining player control;
- `MIXED_OR_UNCERTAIN`: no single causal intervention is justified.

A1.2c already emits `BODY_CAUSALITY_UNCERTAIN` for constrained/external/mixed states. A later adapter must preserve this boundary.

## Revised bounded sequence

### A1.2h — pure future-intervention contract

No physics execution yet.

Convert each H1/H2/H3 item into either:

1. a **rehearsable intervention specification** with explicit causal meaning; or
2. an **unresolved intervention** carrying the reason it cannot honestly be executed as a repeated control.

Required properties:

- H1/H2/H3 remain separate;
- no averaging, centroid, winner or fallback substitution;
- an unresolved H2 is not silently replaced by H1 or H3;
- no G3 claim;
- no companion candidate;
- no runtime authority.

### A1.2i — one player intervention through same-physics rehearsal

Only after A1.2h qualifies.

For one explicit player-future intervention at a time, build the per-step raw velocity sequence and prove the rehearsal evidence preserves hypothesis ID/family/provenance.

Still no companion candidate and no G3.

### A1.2j — one G1/G2-qualified DIRECT candidate + one player intervention

Compose one player branch and one DIRECT companion realization through A1.2g.

G2 remains upstream. Rehearsal must not make an illegal static companion command acceptable merely because Rapier stops it.

Publish joint physical trajectory/contact evidence only. Do not select a winner.

### A1.2k — G3 policy over same-physics trajectory evidence

Revisit A1.2f egress semantics using real rehearsed trajectories instead of the clipped-stop approximation.

A1.2f policy is a donor, not automatically the final policy. In particular, exact touch, initial overlap recovery and monotonic egress must be revalidated on sampled same-physics frames/contact evidence.

Only then may U1 move behind qualified G3 in the matrix.

## Explicitly deferred

- G4 cooperation/right-of-way policy;
- U2 robustness across H1/H2/H3;
- selector/winner/tie-breaking;
- TEMPORAL actuator path semantics;
- runtime movement authority;
- performance/cadence/pruning for many rehearsals.

## Performance warning

A1.2g proves correctness, not affordability. Do not assume a future runtime can execute `candidate count × player-future count × long horizon` every decision frame.

Before any runtime authority promotion, measure actual rehearsal cost with realistic candidate/future counts and decide cadence, pruning, caching or short-horizon structure from evidence.

## Promotion principle

The next authority boundary is not "we can simulate futures". It is:

> we can state exactly which causal counterfactual each future branch represents, run it through the same World physics without mutating live state, reject physically/causally invalid branches before utility, and explain why the surviving branch evidence means what we claim it means.

Until that is true, A1.2 remains research/shadow evidence only.