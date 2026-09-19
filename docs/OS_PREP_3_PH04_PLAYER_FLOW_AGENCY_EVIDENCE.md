# OS-PREP-3 PH-04 — Open-Space Player-Flow / Agency Evidence

Status: **OPEN-SPACE BASELINE CLOSED ENOUGH · TRUE-CONFLICT CLAIM REMAINS NONE**
Date: **2026-09-19**

Qualified checkpoints:

- B0 head-on baseline: `9ab5026d805ff9c042ed059ec190587c006554d6`
  - `validate` #1332 / run `35372780496` — **FULL GREEN**
- B1 late cross-front: `a73dc9620954f7fbae5e7ee49c129b4f9d3dd7a4`
  - `validate` #1334 / run `35373610063` — **FULL GREEN**

Authority:

- gameplay = existing SPATIAL/NATURAL baseline;
- A1 research Twin = `PASS_THROUGH_ONLY`;
- P2 = not enabled;
- right-of-way claim = NONE;
- yield-policy claim = NONE;
- priority claim = NONE.

## 1. Product question

In open-space head-on / crossing situations, does the current companion preserve player agency without requiring the player to babysit or negotiate around it?

The question is participant-facing.

A visually polite pass is not automatically evidence of a yield/right-of-way policy.

---

## 2. B0 — authored head-on baseline

Initial state:

- player: `(4.5, 4)`;
- companion: `(7.5, 4)`;
- both capability: `3 m/s`;
- no obstacles;
- Owner holds `+X` for 120 World steps.

### Participant-first read

Before research evidence:

- player travels on a straight horizontal line;
- companion leaves the player's line early with a clear diagonal sidestep;
- the closest visual pass is readable as a side-pass rather than body contention;
- player does not stop, backtrack or steer around the companion;
- companion later resumes the relationship.

### Causal result

Observation-window ideal forward progress:

**5.950000 m**

Observed:

**5.949909 m**

Deficit:

**0.000091 m**

Additional facts:

- forward progress fraction: ~**99.9985%**;
- player lateral deviation: **0**;
- contact ticks: **0**;
- backward ticks: **0**;
- stalled ticks: **0**;
- minimum actor center separation: ~**1.133 m**;
- participant/research Twin non-interference: exact.

The visible “pass” did not require a dedicated player-flow conflict response.

Already at t0 the relationship policy selected `left` and placed the relationship target off the player's line.

The live spatial stack then moved the companion diagonally toward that relation.

Same-tick shadow player-flow remained `CLEAR` through the story.

Therefore:

> B0 is evidence that existing relational geometry can preserve player agency in a simple head-on situation without a special right-of-way policy.

It is not evidence that a right-of-way policy exists.

---

## 3. B1 — late cross-front provocation

B1 deliberately avoided manual companion positioning.

Story:

1. Owner holds `+X` for 36 ticks while the companion begins its natural B0 sidestep;
2. Owner changes to diagonal `+X/-Y` for 36 ticks, toward the companion's current corridor;
3. Owner resumes `+X` for 48 ticks.

The purpose was to introduce fresh Owner intent after the companion had already begun its autonomous maneuver.

### Participant-first read

Before JSON/debug:

- the Owner path moves toward the companion's current trajectory;
- the nearest moment is visibly tighter than B0;
- there is still no readable jam, shove, backtrack or forced avoidance;
- both actors pass through the episode and separate naturally.

Blind classification:

**TIGHTER CROSSING, BUT STILL NOT A TRUE CONFLICT.**

### Causal result

Across the full story:

- requested path progress: **5.950000 m**;
- actual path progress: **5.949924 m**;
- deficit: **0.000076 m**;
- progress fraction: ~**99.9987%**;
- contact ticks: **0**;
- backward ticks: **0**;
- stalled ticks: **0**;
- minimum center separation: ~**0.856 m**;
- Twin non-interference: exact.

During the diagonal cross-front episode alone:

- requested progress: **1.800000 m**;
- actual progress: **1.799987 m**;
- deficit: ~**0.000013 m**.

At every same-tick shadow sample:

- preferred flow = `CLEAR`;
- authoritative flow = `CLEAR`.

Closest same-tick comfort clearance remained positive.

So B1 also failed to create the target phenomenon.

That is an experiment result, not a failed gameplay result.

---

## 4. Critical interpretation

Two increasingly pressured open-space stories produced almost complete player agency without contact.

The current baseline is therefore stronger than an interpretation such as:

> “head-on inevitably requires an explicit yield/right-of-way mechanism.”

At the same time, PH-04 has **not** demonstrated how the system behaves once a real player-flow conflict exists.

The campaign must not manufacture that conflict by increasingly artificial Owner scripts merely to make the dossier produce a red/green verdict.

Doing so would shift the work from testing the companion to designing an adversarial harness.

The next high-information environment is constrained shared space, where conflict can arise materially from the World.

---

## 5. What PH-04 currently defends

For the bounded open-space stories tested:

- player agency is preserved to numerical tolerance;
- no collision/contact is required to make the pass work;
- no player backtracking or side-stepping is required;
- companion behavior is participant-readable without debug;
- simple relational positioning can produce a cooperative-looking result;
- no dedicated right-of-way/yield policy is necessary for these cases.

---

## 6. What PH-04 explicitly does not defend

PH-04 does not establish:

- a general right-of-way policy;
- a yield policy;
- a priority model;
- successful handling of true predicted conflict;
- chokepoint cooperation;
- mirror robustness of all crossing geometries;
- multi-agent crowd behavior;
- that the current deterministic side preference is desirable;
- that P2 should gain automatic authority.

The true-conflict claim remains **NONE**.

---

## 7. Route forward

Do not escalate to a more adversarial open-field script.

Proceed to **PH-05 — doorway/chokepoint cooperation**.

Reason:

- the World itself constrains alternatives;
- relationship geometry cannot trivially create unlimited separation;
- player-flow, route, contact, progress/recovery and temporary relationship sacrifice can interact naturally;
- a conflict, if observed, is materially earned by shared-space geometry.

Start with the existing doorway scenario and baseline behavior.

No P2 in the first participant story.
