# R1-4 Owner Browser Gate

Status before Owner test: **AUDITED MECHANICAL QUALIFICATION PASS · OWNER BROWSER GATE OPEN**

Exact application runtime to test: `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`

The goal is not to judge final companion polish. The gate asks whether R1-4 remains live under disturbance and whether the workbench explains the causal reason for its behavior.

The post-qualification audit deliberately falsified the earlier 104-test qualification and added regressions for recovery re-arming, repeated moving-target reversals and route-authoritative arrival. The audited runtime passes 108/108 tests; this browser gate is still required because mechanical evidence cannot establish interactive feel or visual/causal legibility.

## Minimal gate

1. Open the public preview and keep mode on `SPATIAL`.
2. Compare `NATURAL` and `DIRECT` with `N`.
3. Use `2` Pillar and `3` Doorway most heavily; `1` Open and `4` Head-on are useful controls.
4. Push/cross in front of the companion, reverse direction repeatedly, block then release, and move the relationship target continuously by moving the player.
5. On the **same selected relationship slot**, create several separate block/release episodes with healthy movement between them. This specifically checks that recovery capacity re-arms after real progress instead of becoming a lifetime two-retry budget.
6. Reverse your movement repeatedly while the companion tracks you. Healthy back-and-forth tracking should remain live rather than decaying into no-progress recovery merely because a rolling window ends near where it began.
7. Pause/step (`P` / `O`) when something suspicious happens; capture incident with `I`.

## What must remain true

- No silent permanent shutdown after ordinary disturbance/release.
- A moving target must not cause retry thrash merely because distance is maintained rather than reduced.
- Repeated direction reversals may still be valid `TRACKING_MOVING_OBJECTIVE` when both target and companion are actually moving and error remains bounded.
- Physical movement without objective improvement must not be labelled `PROGRESSING`.
- Player conflict may become `BLOCKED_PLAYER / WAIT_CONFLICT`; after release, bounded local recovery may occur, but retry count must not climb without bound.
- After genuine healthy progress/tracking, a later independent disturbance on the same semantic objective must still be recoverable. Healthy progress may re-arm the episode count, but it must not bypass retry cooldown or create per-frame reset/thrash.
- A truly impossible static objective should become persistent unreachable and be reported honestly instead of fake-progress looping.
- `ROUTE_INVALID` should say that the objective itself needs reconsideration rather than pretending a local movement retry can fix it.
- `ARRIVED` must agree with current route truth; physical proximity alone must not override invalid/unreachable navigation semantics.
- DIRECT and NATURAL should expose the same route/hard-vs-comfort/recovery meaning. NATURAL may differ in smoothness because it has temporal refinement/continuity.

## Workbench legibility check

The panel should make these questions answerable without guessing:
- What relationship target is active?
- What route was used pre-step and what route exists post-step?
- Is the route hard-reachable but comfort-constrained?
- Did hard-vs-comfort repair rehabilitate candidate movement?
- Did NATURAL's final hard-command gate constrain the temporal command?
- What post-World progress/recovery state and action were chosen?
- How many no-progress/unreachable ticks and retries are currently accumulated?
- Does `retry episode` visibly return to zero after real progress while `applied local retries` remains cumulative evidence rather than being erased?
- Why did the state transition?

Visual cues expected:
- ordinary route: blue;
- comfort-constrained route / comfort violation / rehabilitated candidates / constrained final command: amber/orange emphasis;
- hard rejection/contact: red emphasis;
- requested vs actual motion remain visually distinguishable.

## PASS

PASS if repeated manual disturbance does not create a silent sticky failure, recovery remains bounded and reusable across independent episodes, moving-target reversals remain correctly classified, hard-unreachable is honest, and the workbench lets the Owner explain suspicious behavior causally.

## FAIL / capture incident

Capture `I` and treat as material finding if any of these occur:
- companion stops indefinitely after conflict clears;
- after one or two old recovery events, later independent disturbance on the same slot can no longer recover despite substantial healthy movement in between;
- retries repeatedly reset/oscillate without meaningful healthy progress, or cooldown is effectively bypassed;
- repeated but healthy back-and-forth tracking falls into `UNKNOWN` / `NO_PROGRESS` / recovery solely because net endpoint displacement is small;
- workbench says `PROGRESSING` while NPC is only sliding/orbiting or while the target alone approaches it;
- hard/comfort or arrival evidence contradicts visible route geometry;
- DIRECT and NATURAL disagree on core reachability/recovery semantics rather than actuator feel;
- route is truly impossible but system cycles through movement as though progress were possible;
- panel/incident history cannot explain why the movement state changed.

R1-5 player right-of-way/yield quality is not part of this gate. Awkward but live contention can pass R1-4 if it recovers honestly and the causal evidence is correct.
