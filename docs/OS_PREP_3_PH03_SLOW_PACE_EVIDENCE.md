# OS-PREP-3 PH-03 — Slow Pace / Separation Evidence

Status: **CLOSED ENOUGH · LIVE BASELINE ADEQUATE IN THIS SCENARIO · SHADOW PACE PROMOTION HAZARD**
Date: **2026-09-18**

Qualified candidate:

`a45ed5547beacf080c7969b5a28cde9f43730b5e`

Validation:

- `validate` #1326 / run `35367820203` — **FULL GREEN**
- `npm run check` — PASS
- aggregate `browser:audit` — PASS
- PH-03 base slow-walk Twin — PASS
- PH-03 sustained slow-walk M1 Twin — PASS
- Twin non-interference — exact within configured tolerance
- inherited PH-01 / semantic / P1 / P2 / Z4 evidence — PASS

## 1. Product question

When the player moves genuinely slowly, does the live companion settle into a useful matching relation, or does it keep behaving like a target-chasing optimizer?

This dossier also asks a separate promotion question:

> does the shadow PACE signal actually describe the good live behavior well enough to deserve future authority?

Those are different claims.

---

## 2. Apparatus truth

Ordinary browser WASD produces normalized full-magnitude Owner input.

Therefore timeScale would have been a false slow-walk test: it slows the whole World, not the Owner intent relative to companion capability.

PH-03 added a query-gated test-only Owner-control scale:

`?ownerscale=1`

It scales the Owner `MotionIntent` before semantic interpretation and World stepping.

Without the flag, runtime scale remains exactly `1`.

PH-03 used:

- Owner scale: `0.2`
- player physical capability: `3 m/s`
- requested slow pace: **0.6 m/s**

The same scaled intent is visible to World truth, semantic orientation and all downstream systems.

---

## 3. Base story

Story:

- 180 ticks / 3 seconds continuous `+X` at 0.6 m/s;
- 60 ticks / 1 second neutral release.

Participant/research Twins were exactly aligned.

### Participant-first read

Before metrics/debug:

- companion closes the initial large separation quickly;
- after catch-up it settles above/alongside the player;
- no obvious overshoot-thrash cycle appears;
- on release, there is no aggressive run-away or repeated re-catch;
- the pair tends toward a stable arrangement.

This visually falsified the naive claim:

> “the historical 55% PACE floor means the current live companion must visibly run too fast beside a slow player.”

It does not.

### Base causal nuance

After the initial catch-up, companion speed temporarily falls below player speed.

Around t120 onward:

- player remains near **0.6 m/s**;
- companion average over the later slow-walk portion is lower;
- separation rises gradually.

This raised a credible rival:

> perhaps the live controller is not oscillating, but slowly falling behind until another catch-up episode begins.

That earned M1.

---

## 4. M1 sustained slow-walk falsifier

Story:

- 360 ticks / 6 seconds continuous `+X` at 0.6 m/s;
- no release;
- participant/research Twin;
- final 240-tick incident window corresponds to t120..t359.

### Participant-first read

The sequence does **not** show a rhythmic catch-up / over-brake / catch-up pump.

Instead:

- after catch-up, the companion becomes calm;
- a small longitudinal lag accumulates;
- the lag growth progressively slows;
- no visible second chase burst occurs;
- lateral relation remains broadly stable.

Blind classification:

**CALM TRACKING WITH SLOW ASYMPTOTIC LONGITUDINAL DRIFT — not oscillatory chase.**

---

## 5. M1 causal result

Over t120..t359:

- separation: approximately **1.276 m -> 1.493 m**;
- separation trend flips: **0**;
- companion average speed: approximately **0.509 m/s**;
- player speed: approximately **0.600 m/s**;
- live command average: approximately **0.508 m/s**.

The important part is convergence.

Later windows:

- from ~t220 onward companion speed is about **0.589 m/s**;
- from ~t240 onward about **0.594 m/s**;
- from ~t260 onward about **0.596 m/s**;
- final ~1 second about **0.598 m/s**.

Residual separation growth also collapses:

- t220..t359: only ~**1.36 cm** additional growth;
- t260..t359: only ~**4.4 mm**;
- t300..t359: about **1.4 mm**.

So the live system is not diverging indefinitely.

It asymptotically converges to the player's slow pace.

---

## 6. Live mechanism interpretation

The current live NATURAL stack achieves this without PACE authority.

The relevant live machinery includes:

- moving heading-relative relationship target;
- route / target-distance scoring;
- local candidate speeds;
- unnecessary-motion penalty near the relationship target;
- continuity/refinement;
- actual player motion in dynamic-clearance evaluation.

The target remains close enough for local tracking to converge toward the player's translational velocity even though there is no explicit “copy player pace” authority.

This is a useful empirical result:

> current live behavior can pace-match through moving-target tracking and local control, not because PACE tells it to.

---

## 7. Shadow PACE contradiction

During the stabilized M1 window, shadow PACE reports:

- label: `SETTLED`;
- desired speed: **1.65 m/s**.

That is:

- **2.75×** the player's actual ~0.6 m/s pace;
- far above the live companion's successful ~0.598 m/s terminal tracking pace.

PACE remains shadow-only and has no movement authority.

Therefore this is not a current gameplay failure.

It is a **promotion hazard**.

### Anti-claim

Do not infer:

> “PACE is qualified because the live companion behaved well.”

The opposite is closer to the current evidence.

The live baseline behaves better in this slow-walk case than the current shadow desired-speed signal predicts.

Any future promotion of PACE must first explain and resolve this contradiction.

---

## 8. What PH-03 does defend

For this bounded open-field slow-walk story:

- the live companion does not exhibit obvious pace thrashing;
- it can converge close to a 0.6 m/s player pace;
- the initial longitudinal drift is asymptotic rather than runaway;
- release behavior in the base story is calm enough to continue campaign work;
- test-only slow Owner input is now available without altering normal runtime.

---

## 9. What PH-03 does not defend

PH-03 does not establish:

- generally good pace behavior in obstacles/combat/crowding;
- ideal separation distance;
- ideal catch-up urgency;
- that current arrival behavior is final-quality;
- that shadow PACE should receive authority;
- that 1.65 m/s `SETTLED` desired speed is acceptable;
- that the Owner will prefer this visual spacing/lag.

No tuning is earned yet.

---

## 10. Route forward

PH-03 is **closed enough** for pre-Owner preparation.

Carry forward two separate truths:

1. **live baseline:** adequate in this bounded slow-walk case;
2. **shadow PACE:** material future promotion hazard until its slow-walk contradiction is resolved.

Proceed to **Wave B / PH-04 — player-flow cooperation and agency**.

The next question:

> when player and companion futures physically conflict, can the player keep moving naturally, or does the companion make the human negotiate around the AI?

Start with baseline behavior only.

No P2 intervention until participant-visible obstruction/cooperation has been characterized.
