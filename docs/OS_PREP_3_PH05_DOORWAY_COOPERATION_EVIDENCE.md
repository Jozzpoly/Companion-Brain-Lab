# OS-PREP-3 PH-05 — Doorway / Chokepoint Cooperation Evidence

Status: **CLOSED ENOUGH · BOUNDED SUCCESS**
Date: **2026-09-19**

Qualified checkpoint:

`68265f8f451da11ff2b07937e82c7a18f71a6cd4`

Validation:

- `validate` #1341 / run `35465102837` — **FULL GREEN**
- `npm run check` — PASS
- aggregate `browser:audit` — PASS
- doorway reversal Twin — PASS
- doorway settle/reacquisition M1 Twin — PASS
- Twin non-interference — exact
- inherited PH-01..PH-04 / semantic / P1 / P2 / Z4 evidence — PASS

Authority:

- gameplay = existing SPATIAL/NATURAL baseline;
- A1 research Twin = `PASS_THROUGH_ONLY`;
- P2 = not enabled;
- right-of-way/yield/priority claims = NONE.

## 1. Product question

Can player and companion share a constrained doorway without babysitting, deadlock or the companion fighting to preserve an ideal relationship at the expense of traversal?

The key distinction is:

> successful traversal is not automatically cooperation.

The useful behavior must preserve player agency and later recover the relationship without requiring the player to repair the AI.

---

## 2. Base doorway reversal story

Story:

`+X 120 ticks -> immediate -X 120 ticks`

No pause.

No P2.

No manual companion repositioning.

### Participant-first read

- player crosses the doorway outbound without visibly managing the companion;
- companion yields to geometry rather than contesting the doorway;
- on immediate reversal the player crosses back without deadlock or collision;
- companion remains on the far/right side for much of the return;
- this initially reads as either:
  - healthy temporary relationship sacrifice, or
  - weak reacquisition after reversal.

### Causal result

Player:

- requested progress: **11.950000 m**;
- actual progress: approximately **11.949825 m**;
- progress fraction: ~**99.9985%**;
- contact ticks: **0**;
- backward ticks: **0**;
- stalled ticks: **0**;
- outbound doorway crossing: ~t53;
- return crossing: ~t204.

Companion/system:

- no recovery action is required;
- after the early outbound routing phase, movement returns to direct routing;
- relationship revises through `right -> back-right -> back`;
- companion does not immediately follow the player through the doorway on reversal.

This is not a deadlock.

It is temporary separation with an unresolved reacquisition question.

---

## 3. M1 — stop helping and observe reacquisition

Story:

`+X 120 -> -X 120 -> neutral 120`

The player stops after returning to the left side.

The player does not move back toward the companion or otherwise rescue the relationship.

The final 240-tick incident window covers:

- the complete return beat;
- the complete neutral settle beat.

### Participant-first read

After t240:

- companion approaches the doorway on its own;
- crosses to the player's side;
- continues toward the player;
- decelerates naturally;
- settles without oscillation or re-entering the doorway.

The visible sequence reads as:

**temporary separation -> autonomous reacquisition -> settle.**

---

## 4. M1 causal result

Return phase:

- requested progress: **6.000000 m**;
- actual progress: **5.999912 m**;
- deficit: ~**0.000088 m**;
- progress fraction: ~**99.9985%**;
- backward ticks: **0**;
- stalled ticks: **0**.

Across return + settle:

- contact ticks: **0**;
- route status: `direct` for **240 / 240** frames;
- route path changes: **0**;
- recovery/post action: `NONE` for **240 / 240** frames.

Settle/reacquisition:

- player remains fixed at approximately `(3.80, 4.00)`;
- companion begins settle phase near `(6.70, 3.51)`;
- companion returns through doorway at approximately **t287**;
- companion travels ~**1.464 m** during settle;
- settled state begins around **t338**;
- final companion speed: **0**;
- final companion position: approximately `(5.32, 3.98)`;
- final player-companion separation: ~**1.518 m**.

The final separation is close to the intended relational spacing scale (~1.45 m).

---

## 5. Causal interpretation

The favorable result is not produced by a special chokepoint FSM.

It is also not a recovery subsystem rescuing a stuck controller.

During the qualified return + settle window:

- routing is direct;
- recovery action remains NONE;
- relationship labels revise as the player's situation changes;
- the ordinary relationship/spatial stack later brings the companion back through the doorway.

The useful property is therefore:

> the system can temporarily abandon an ideal relative position to preserve player movement, then recover the relationship when the shared-space pressure is gone.

That is closer to teammate value than maintaining formation at all costs.

---

## 6. What PH-05 currently defends

For this bounded doorway story:

- player agency remains effectively intact in both directions;
- no collision or player babysitting is needed;
- temporary spatial separation is tolerated;
- the companion can autonomously reacquire after the player stops;
- no recovery machinery is required for this episode;
- no dedicated right-of-way/yield policy is required.

---

## 7. What PH-05 does not defend

PH-05 does not establish:

- general navigation competence;
- arbitrary doorway widths/geometries;
- mirror robustness;
- multi-companion chokepoints;
- combat-space traversal;
- all possible immediate reversals;
- ideal timing of reacquisition;
- that current relationship revisions are internally coherent;
- that smooth participant-visible continuity reflects smooth upstream intent.

The final item is now the most useful unresolved question.

---

## 8. Route forward

Do **not** immediately build another doorway variant.

Reuse the qualified M1 artifact for **PH-08 — multi-beat continuity vs smooth-rendering illusion**.

Reason:

- participant surface reads as one coherent episode;
- the same causal trace already contains relationship/objective revisions;
- earlier PH-01 proved that NATURAL realization can hide abrupt upstream changes;
- this doorway episode gives a richer constrained-space test of the same risk.

First task:

> identify every material relationship/objective revision in the M1 return + settle window and compare its discontinuity with command/body continuity.

Only add a new PH-08 apparatus if the existing artifact cannot answer that question.

PH-06 close-contact work remains informed by the already-strong PH-02 stale-policy pathology; do not repeat a generic contact sweep without a new discriminating question.
