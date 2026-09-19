# OS-PREP-3 PH-08 — Multi-Beat Continuity vs Smooth-Rendering Illusion

Status: **CLOSED ENOUGH · PRODUCT CONTINUITY USEFUL, UPSTREAM INTENTION DISCONTINUOUS**
Date: **2026-09-19**

Source artifact:

- PH-05 doorway settle/reacquisition M1
- exact source `68265f8f451da11ff2b07937e82c7a18f71a6cd4`
- Validate #1341 / run `35465102837` — **FULL GREEN**

No new runtime or test apparatus was added for PH-08.

The qualified PH-05 M1 artifact was reused.

## 1. Product question

Does the participant-visible doorway episode read as one evolving action because upstream intent is actually continuous, or because downstream NATURAL realization smooths discrete relationship/objective changes?

This distinction matters because:

> smooth motion is not evidence of persistent intention.

---

## 2. Participant-first evidence

The already-recorded PH-05 M1 sequence reads coherently:

- player reverses through doorway;
- companion temporarily remains on the far side;
- companion later returns;
- passes through doorway;
- approaches the stationary player;
- decelerates;
- settles.

Nothing in the participant-only sequence exposes a violent policy reset.

The behavioral surface can reasonably be summarized as:

**temporary separation -> reacquisition -> settle.**

This is useful player-facing behavior.

---

## 3. Material upstream discontinuity at t186

Immediately before t186:

- relationship label: `right`;
- world target: approximately `(6.800, 2.550)`;
- preferred velocity: ~**2.10 m/s @ 180°**;
- final command: ~**2.10 m/s @ 180°**.

At t186:

- relationship becomes `back-right`;
- target jumps by ~**0.840 m**;
- preferred velocity becomes ~**1.05 m/s @ 135°**;
- preferred-velocity vector changes by ~**1.547 m/s**.

But the final command at that same tick becomes only:

- ~**2.061 m/s @ 179.4°**.

Same-tick command-vector change is only ~**0.044 m/s**.

Actual body velocity has not yet materially changed.

The final command reaches within ~5° and 15% speed error of the new preferred motion around t193:

- lag: ~**7 ticks**;
- ~**117 ms** at 60 Hz.

Thus a large discrete objective/motion change becomes a short smooth visible arc.

---

## 4. Material upstream discontinuity at t210

Immediately before t210:

- relationship label: `back-right`;
- world target: approximately `(6.625, 2.975)`;
- preferred motion is around the 135° diagonal.

At t210:

- relationship becomes `back`;
- target jumps by ~**1.033 m**;
- preferred-velocity vector changes by ~**0.684 m/s**;
- new preferred direction is ~**120°**.

Same-tick final command changes by only ~**0.044 m/s** and remains near **135.8°**.

It converges close to the new preferred motion by about t214:

- lag: ~**4 ticks**;
- ~**67 ms**.

Again:

> upstream objective meaning changes discretely while participant motion remains visually continuous.

---

## 5. Stop / semantic-expiry boundary

At t240 the Owner releases movement.

Canonical semantic orientation behaves correctly:

- t239: `SAME_STEP_OWNER`, direction `-X`;
- t240 onward: `OWNER_MEMORY`;
- strength decays;
- by **t272** orientation is canonical **NONE**;
- player is stationary and no body-motion provenance is promoted into Owner meaning.

However the live baseline does not stop at t272.

After canonical orientation becomes NONE:

- the relationship label remains `back`;
- the legacy world target remains approximately `(5.25, 4.00)`;
- baseline companion intent remains non-zero;
- the companion continues autonomous reacquisition;
- crosses to the player's side;
- later settles around t338.

This produces a participant-visible **good result** in this episode.

The PH-05 incident does not itself export the explicit legacy provenance label, so this dossier does not independently claim the exact `RETAINED_LAST_SEMANTIC_FRAME` marker.

But it does establish the local boundary:

> canonical directional semantics have expired while legacy baseline behavior continues pursuing the previously established directional relationship objective.

PH-02 independently qualified the retained-policy mechanism as capable of causing real stale-policy pathology.

---

## 6. Combined interpretation

PH-08 therefore rejects two simplistic conclusions.

### Wrong conclusion A

> “The doorway sequence looks smooth, therefore the companion has one continuous intention.”

False.

At least two material world-objective revisions are hidden by downstream temporal realization.

### Wrong conclusion B

> “Any behavior after semantic expiry is visibly bad and should simply be deleted.”

Also unsupported.

In this bounded doorway episode, continuation after semantic expiry contributes to useful autonomous reacquisition and a clean settle.

The real architectural pressure is harder:

> preserve useful relationship continuity without pretending that expired directional evidence is still current truth.

This should not be solved by blindly removing continuity or by promoting stale directional policy.

---

## 7. Product vs epistemic truth

Participant/product truth:

- the episode is coherent and useful;
- player agency is preserved;
- companion autonomously reacquires.

Causal/epistemic truth:

- relationship/objective state changes discretely;
- NATURAL realization masks part of that discontinuity;
- useful-looking continuation survives beyond canonical directional semantic expiry.

These truths coexist.

That is precisely why participant-first and causal evidence must remain separate.

---

## 8. What PH-08 defends

- downstream temporal realization successfully prevents abrupt body snaps;
- the doorway sequence is participant-readable;
- multi-beat behavior can remain useful across discrete relationship revisions;
- current evidence is sufficient to detect when smoothness is masking upstream discontinuity.

---

## 9. What PH-08 does not defend

PH-08 does not establish:

- a persistent action/intention object;
- that current discrete relationship revisions are ideal;
- that retained post-expiry policy is safe;
- that smoothing should be reduced;
- that relationship continuity should be deleted;
- a replacement architecture.

PH-01 and PH-02 remain active constraints on any later redesign.

---

## 10. Route forward

Do not build a new PH-08 apparatus.

Proceed to **PH-07 pillar mirror** because a materially different uncertainty remains:

> does known deterministic/fake side preference leak into a visible topology choice around a symmetric obstacle?

Use the existing central pillar scenario.

Create mirrored Owner histories with a small symmetric `+Y/-Y` pre-nudge before the same forward traversal.

The mirrored run should be evaluated by world-space symmetry and first divergence, not by symbolic slot names.

No P2.
