# R1-4 Progress / Recovery Qualification

Status: **MECHANICAL QUALIFICATION PASS · OWNER BROWSER GATE OPEN**

Qualified runtime SHA: `d3ec785ec7d12b5584cfd0e30e17bd496a5d639d`

Strict validation:
- workflow run `34846619838`: **SUCCESS**
- 20/20 test files PASS
- 104/104 tests PASS
- `tsc --noEmit`: PASS
- production Vite build: PASS
- npm install audit: 0 vulnerabilities

This document qualifies the bounded R1-4 progress/recovery layer and the R1 Robustness Workbench mechanically. It does **not** claim Owner-visible movement quality, final player cooperation, or R1-5 right-of-way/yield competence.

## Qualified contract

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

## Falsification history that changed the contract

R1-4 was intentionally red-tested before qualification.

1. Body motion was initially treated as progress. A falsifier proved that lateral/orbit/slide motion can occur without improving the route/objective metric. `PROGRESSING` now requires objective/route improvement plus material companion displacement.

2. A correctly moving companion maintaining distance to a moving target initially consumed recovery retries because error did not shrink. The contract now exposes `TRACKING_MOVING_OBJECTIVE`; stable moving-target tracking does not consume retry budget.

3. A target moving toward a stationary companion could otherwise make the objective metric improve without any companion contribution. This is no longer classified as companion progress.

4. `invalid-target` is not collapsed into hard unreachable. It produces `ROUTE_INVALID -> RECONSIDER_OBJECTIVE`, because local retry cannot repair a semantic target that lies in geometry.

5. One nominal open-space integration fixture originally targeted the player's exact position. Player avoidance correctly prevented arrival. The fixture was corrected rather than weakening movement safety.

6. The doorway rehearsal originally required physical contact or `BLOCKED_PLAYER` as proof of contention. Local avoidance sometimes resolved close contention without collision. The gate was changed to require real geometric proximity plus successful resume, no persistent failure and bounded retries; movement policy was not weakened.

## Dynamic rehearsal evidence

The qualified runtime passes full movement-stack rehearsals for:
- continuously moving relationship target with stable semantic objective;
- player crossing the companion path from the side, followed by release;
- repeated doorway reversals/contention followed by release and resume;
- true static separation producing persistent hard-unreachable without retry thrash.

These are robustness/recovery proofs, not proofs of polished player cooperation. Explicit right-of-way/yield behavior remains R1-5.

## DIRECT / NATURAL A-B integrity

`R1WorkbenchSpatialStack` exposes DIRECT and NATURAL through the same repaired R1 hard-vs-comfort spatial contract and the same post-World recovery vocabulary.

The qualified A/B integration proves both actuators:
- reach the same free objective;
- expose R1 hard/comfort evidence;
- finish with `ARRIVED` and zero unnecessary local retry debt.

The intended difference is actuator realization:
- DIRECT has no temporal refinement/continuity/final-continuity constraint layer;
- NATURAL exposes refinement, continuity and final hard-command constraint evidence.

Thus the workbench comparison is not confounded by DIRECT silently using the older comfort-as-hard movement contract.

## Causal Workbench v2 evidence

The R1 Robustness Workbench now records distinct pre-decision and post-outcome evidence.

Pre-decision evidence includes:
- relationship objective and target;
- route status/path/cost;
- route comfort constraint;
- local spatial state/candidate;
- hard-vs-comfort repair state and blockers;
- rehabilitated hard-safe candidate count;
- comfort-exit candidate count;
- preferred/refined velocity;
- final hard-command constraint source/reason when applicable.

Post-outcome evidence includes:
- actual/requested velocity and contacts;
- post-step route status/path/comfort constraint;
- authoritative R1-4 state/action/reason;
- no-progress and unreachable counters;
- retry count and actually applied local retries.

Incident schema is `companion-brain-lab-r1-causal-incident-v2`.

The trace v2 test explicitly verifies preservation and defensive cloning of the new hard/comfort, final-command and recovery evidence.

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

Pages should publish the exact qualified runtime SHA above. A successful Pages build/deploy proves delivery only; the Owner browser gate remains required for visual legibility, causal usefulness and real interactive feel.

## Next boundary

After the Owner browser gate, the next planned stage is R1-5: explicit player cooperation / right-of-way / yielding policy. Do not smuggle R1-5 behavior into R1-4 recovery fixes unless new evidence shows a true R1-4 invariant violation.
