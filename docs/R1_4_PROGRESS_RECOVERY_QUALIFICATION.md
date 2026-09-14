# R1-4 Progress / Recovery Qualification

Status: **AUDITED MECHANICAL QUALIFICATION PASS · OWNER BROWSER GATE OPEN**

Audited application runtime SHA: `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`

This document may live at a later documentation-only commit. The SHA above is the exact application runtime qualified for the Owner browser gate.

Final strict validation of that runtime:
- workflow run `34860205177`: **SUCCESS**
- 21/21 test files PASS
- 108/108 tests PASS
- `tsc --noEmit`: PASS
- production Vite build: PASS
- npm install audit: 0 vulnerabilities

This qualification covers the bounded R1-4 progress/recovery layer and the R1 Robustness Workbench mechanically. It does **not** claim Owner-visible movement quality, final player cooperation, or R1-5 right-of-way/yield competence.

## Why the earlier qualification was reopened

The earlier runtime `d3ec785ec7d12b5584cfd0e30e17bd496a5d639d` had a legitimate green mechanical run: 20 test files / 104 tests plus TypeScript and production build. The problem was not that those results were fabricated; their **coverage was insufficient for the breadth of the qualification claim**.

A post-qualification claim-vs-code audit therefore reopened R1-4 before consuming Owner test time. It found three current-contract gaps and one additional defensive contract inconsistency.

### Audit falsification chain

1. **Red audit run `34859564107`**
   - all prior 104 tests remained PASS;
   - 3/3 newly added regressions failed exactly as predicted:
     - local retry budget did not re-arm after healthy progress on the same semantic objective;
     - repeated target/body reversals could collapse healthy moving-target tracking into `UNKNOWN` because the monitor measured only endpoint displacement;
     - Euclidean arrival tolerance could win before `invalid-target` / `unreachable` route truth.

2. **First repair run `34859807621`**
   - 21/21 test files PASS;
   - 107/107 tests PASS;
   - TypeScript and production build PASS.

3. A second audit pass identified a route-metric arrival inconsistency. A synthetic `routed` observation could be only `0.1 m` away geometrically while still having `3.5 m` of route remaining, yet the monitor would say `ARRIVED`.

4. **Second red run `34860062045`**
   - the previously repaired 107 tests remained PASS;
   - the new routed-near-target falsifier failed alone as predicted.

5. **Final repair run `34860205177`**
   - 21/21 test files PASS;
   - 108/108 tests PASS;
   - TypeScript and production Vite build PASS;
   - npm install audit reported 0 vulnerabilities.

The fourth case is important as a monitor-contract invariant, but with the current `0.30 m` actor radius and `0.20 m` arrival tolerance it is not claimed as a reproduced current-World gameplay failure. It is defensive route-aware hardening. The first three findings apply directly to the active R1-4 temporal contract.

## Audited contract

R1-4 preserves the phase boundary:

`pre-step objective / route / spatial decision -> command -> World -> post-step route / outcome -> progress/recovery decision`

The public temporal vocabulary includes:
- `ARRIVED`
- `PROGRESSING`
- `TRACKING_MOVING_OBJECTIVE`
- `INTENTIONAL_HOLD`
- `HOLDING_UNEXPLAINED`
- `BLOCKED_PLAYER`
- `BLOCKED_STATIC`
- `NO_PROGRESS`
- `ROUTE_INVALID`
- `TRANSIENT_UNREACHABLE`
- `PERSISTENT_UNREACHABLE`
- `RECOVERING`

Bounded actions:
- `NONE`
- `WAIT_CONFLICT`
- `RETRY_LOCAL`
- `RECONSIDER_OBJECTIVE`
- `REPORT_UNREACHABLE`

Only `RETRY_LOCAL` has local movement authority. It refreshes local movement state for the next decision. It does not mutate World state, invent a new relationship objective, take route authority, or introduce scenario-specific escape motion.

### Retry episode semantics

`R1_MAX_LOCAL_RETRIES_PER_EPISODE = 2` is now actually episodic rather than a lifetime cap on a long-lived semantic objective.

- retries remain bounded by the existing cooldown and per-episode limit;
- verified healthy `PROGRESSING`, `TRACKING_MOVING_OBJECTIVE`, or valid `ARRIVED` re-arms the episode retry count;
- re-arming does **not** erase the last-retry timestamp, so a brief healthy transition cannot bypass cooldown;
- cumulative applied local retries remain separately visible in workbench/debug evidence.

### Moving-objective semantics

`PROGRESSING` still requires objective/route improvement plus material **net companion displacement**. This preserves the earlier anti-orbit / anti-slide falsifier.

`TRACKING_MOVING_OBJECTIVE` now uses accumulated target/body travel through the rolling window rather than only first-to-last displacement. This means a target and companion can reverse direction repeatedly and still count as healthy tracking when error remains bounded.

A target moving toward a stationary companion still cannot manufacture companion progress.

### Route truth and arrival

Route validity is authoritative over Euclidean proximity:
- `invalid-target -> ROUTE_INVALID -> RECONSIDER_OBJECTIVE`;
- hard `unreachable` remains transient/persistent unreachable rather than `ARRIVED`;
- for a hard-valid route, `ARRIVED` requires both physical target distance and current route/progress metric to be within arrival tolerance.

## Earlier R1-4 falsification history retained

Before the post-qualification audit, R1-4 had already changed in response to evidence:

1. body motion alone was rejected as proof of progress; lateral/orbit/slide motion must improve the objective/route metric to become `PROGRESSING`;
2. stable tracking of a monotonically moving target gained explicit `TRACKING_MOVING_OBJECTIVE` semantics;
3. target-only approach to a stationary companion was prevented from manufacturing progress;
4. `invalid-target` was separated from ordinary hard unreachable;
5. a nominal open-space integration fixture that targeted the player's exact position was corrected rather than weakening player avoidance;
6. doorway rehearsal evidence was changed from requiring literal contact to requiring real contention/proximity plus successful bounded resume, because avoidance can resolve conflict before collision.

## Dynamic rehearsal evidence

The audited runtime passes full movement-stack rehearsals for:
- continuously moving relationship target with stable semantic objective;
- repeated moving-target reversal in the temporal monitor audit;
- player crossing the companion path from the side, followed by release;
- repeated doorway reversals/contention followed by release and resume;
- independent recovery episodes on the same semantic objective after healthy progress;
- true static separation producing persistent hard-unreachable without retry thrash.

These are robustness/recovery proofs, not proofs of polished player cooperation. Explicit right-of-way/yield behavior remains R1-5.

## DIRECT / NATURAL A-B integrity

`R1WorkbenchSpatialStack` exposes DIRECT and NATURAL through the same repaired R1 hard-vs-comfort spatial contract and the same post-World recovery vocabulary.

The A/B integration proves both actuators:
- reach the same free objective;
- expose R1 hard/comfort evidence;
- finish with valid arrival semantics and no unnecessary local retry debt.

The intended difference remains actuator realization:
- DIRECT has no temporal refinement/continuity/final-continuity constraint layer;
- NATURAL exposes refinement, continuity and final hard-command constraint evidence.

Thus the workbench comparison is not confounded by DIRECT silently using the older comfort-as-hard movement contract.

## Causal Workbench evidence

Pre-decision evidence includes relationship objective/target, route status/path/cost, comfort constraint, local spatial state/candidate, hard-vs-comfort repair state/blockers, rehabilitated candidate counts, preferred/refined velocity and final hard-command constraint evidence.

Post-outcome evidence includes actual/requested velocity and contacts, post-step route truth, authoritative R1-4 state/action/reason, no-progress/unreachable counters, retry episode count and cumulative applied local retries.

Incident schema remains `companion-brain-lab-r1-causal-incident-v2`.

## Non-claims / remaining boundary

This qualification does not claim:
- final companion feel;
- explicit player priority/right-of-way policy;
- ideal doorway negotiation;
- multi-companion cooperation;
- combat behavior;
- commands;
- LLM cognition;
- final UI/visual quality.

A successful Pages build/deploy proves delivery only. The Owner browser gate remains required for visual legibility, causal usefulness and real interactive feel.

## Next boundary

Publish the exact audited application runtime SHA above and run the Owner browser gate. Only after that evidence should R1-5 begin. Do not smuggle R1-5 behavior into R1-4 unless new evidence shows a true R1-4 invariant violation.
