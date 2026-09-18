# OS-PREP-3 PH-01 — Open Turn/Reversal Evidence

Status: **MATERIAL FINDING · NEXT FALSIFIER = MIRRORED 90° TURN**
Date: **2026-09-18**

Exact candidate:

`610c0c7f1ef8055af44ebca245b440614ecc58f8`

Validation:

- `validate` #1310 / run `35351555825` — **FULL GREEN**
- `npm run check` — PASS
- inherited aggregate `browser:audit` — PASS
- PH-01 participant/research Twin capture — PASS
- PH-01 artifact upload — PASS
- research Twin A1 authority — `PASS_THROUGH_ONLY`
- Twin World outcome equality — exact (`maxPositionError=0`, `maxVelocityError=0`)

Artifact:

`os-prep3-ph01-open-turn-reversal-610c0c7f1ef8055af44ebca245b440614ecc58f8`

## 1. Experiment

Open field, NATURAL actuator, 144 World steps:

1. `+X` for 36 steps;
2. clean 90° turn to `+Y` for 36;
3. neutral for 18;
4. reverse to `-Y` for 36;
5. neutral for 18.

Two exact Twins were run:

- participant Twin: A1 OFF;
- research Twin: A1 DIRECT selected only as the already-qualified pass-through research lens.

The research Twin did not alter any aligned World position, command velocity, requested velocity, actual velocity or contact outcome.

---

## 2. Participant-first read

This read was written from participant-only canvas frames before incident/A1 research evidence was opened.

### Visible interpretation

The motion is smooth and continuous, but it is not yet strongly legible as a teammate deliberately maintaining one relationship through the whole story.

- Initial `+X`: companion moves diagonally away/up-left as the player closes. This avoids trivial direct convergence and creates a plausible side/offset relation.
- 90° turn: no visible snap/jitter. The companion follows a broad curved trajectory and ends above-right of the player. From the participant surface this is ambiguous: coherent relational adjustment and delayed carry both fit.
- Brief stop: companion continues materially closing separation instead of settling immediately.
- Reverse: companion initially continues in the old screen direction for a noticeable part of the episode; the actors converge and pass in vertical alignment before the companion bends back.
- Final neutral: companion keeps moving through the sampled release window and continues reducing separation.

### Blind strengths

- no obvious coarse-sampled left/right thrash;
- no body teleport or hard visual snap;
- no direct collision/chase-through-player pathology in this open story;
- continuous embodied path.

### Blind concerns

- smoothness may be doing much of the perceptual work;
- stop/reversal response is slow enough that previous motion remains visually dominant for several beats;
- separation keeps closing through neutral beats;
- the broad arc is not self-explanatory without research vocabulary.

Blind classification:

**AMBIGUOUS · causal reconciliation required**

Evidence limitation:

The participant artifact samples a still every 6 World steps. It is sufficient for broad trajectory but not final feel or sub-sample oscillation.

---

## 3. Causal reconciliation

### Finding F-01A — same symbolic label, materially different world-space intention

At t35:

- Owner control: `+X`;
- legacy relationship label: `left`;
- target: approximately `(4.50, 2.55)`.

At t36:

- Owner control changes same-step to `+Y`;
- A1 semantic orientation immediately reports `SAME_STEP_OWNER`, direction `+Y`;
- legacy relationship label remains `left`;
- target jumps to approximately `(6.25, 4.00)`.

Target displacement:

**2.2726601106 m**

No route-path change occurred.

This is direct live evidence that:

> stable legacy relationship label != stable world-space relationship intention.

The discontinuity is not explained by stale Owner semantics: the research observer changed to the fresh +Y meaning on the same tick.

### Finding F-01B — coherent-region research evidence does not require the same target jump

At t36 the CCC shadow region reports:

- topology change: **false**;
- coherent-sample overlap: **1.0**;
- representative-anchor displacement: **~0.287 m**;
- legacy-target to shadow-anchor distance: **~2.329 m**.

This is not an authority comparison and does not prove the shadow region is the desired policy.

It does show that the live 2.27 m target jump is not mechanically required merely because the broader reachable/coherent region became discontinuous.

### Finding F-01C — downstream temporal realization hides the upstream discontinuity

After the t36 target jump:

- t36–t38 local preferred Y remains negative;
- t39 preferred Y becomes positive;
- the final commanded Y remains negative through t46;
- commanded Y crosses positive at t47.

So the body does not visibly snap toward the new target. Several downstream layers transform the abrupt upstream objective change into a broad smooth arc.

This matches the blind participant ambiguity almost exactly.

Material conclusion:

> PH-01 has live evidence for the historical CCC warning that temporal realization can make an abrupt upstream relationship change look like continuous intention.

This is a causal mechanism finding, not yet a gameplay rejection.

### Finding F-01D — label change can also preserve world-space intention

At t90 the Owner supplies fresh `-Y` input:

- A1 orientation becomes `SAME_STEP_OWNER`, `-Y`, on the same tick;
- legacy label changes `left -> right`;
- target displacement is **0**.

The target remains on the same world-space side of the player.

Therefore the inverse also occurs:

> changed legacy label != changed world-space intention.

Together F-01A and F-01D falsify use of the slot label as a reliable identity for spatial intention/episode continuity.

### Finding F-01E — stop carry is not caused by external body motion being mistaken for Owner meaning

At t72 Owner control becomes neutral.

The research semantic lens transitions to bounded `OWNER_MEMORY` of the previous +Y direction while actual player motion settles to stationary.

The legacy relationship target remains fixed at the remembered side while the companion is still materially displaced from it, so continued movement during the stop is causally consistent with trying to reach that retained relation.

This does **not** establish that the amount/duration of catch-up is desirable.

It does rule out one simpler explanation for this story: the continuation is not merely fresh external body motion being mislabeled as new Owner intent.

---

## 4. Current interpretation

### Defended

- PH-01 apparatus is non-interfering in this story.
- The participant ambiguity is real and recoverable from causal evidence.
- Symbolic slot-label continuity is not world-space intention continuity.
- The t36 broad visible arc is downstream of a large abrupt legacy target rotation.
- Temporal realization materially masks that objective discontinuity.
- Fresh semantic Owner orientation itself is not lagging at the t36 turn.

### Not defended

- that the t36 target rotation is necessarily bad gameplay;
- that world-space persistence is always preferable to heading-relative relationship;
- that the shadow region is the correct production objective;
- that the observed smoothness is undesirable;
- that the companion feels bad/good to the Owner;
- that current reversal behavior should be tuned before more falsification.

---

## 5. Highest-value remaining rival

A single 90° direction is not enough to distinguish:

1. a structural consequence of rotating a heading-relative relationship frame;
2. deterministic side/tie bias;
3. incidental asymmetry of the authored start/trajectory.

The smallest next discriminator is therefore:

> mirror the 90° turn: `+X -> -Y`, then mirror the reversal story.

If the target jump and broad-body response mirror cleanly, the rotated-frame explanation strengthens and fake global side preference weakens.

If they do not mirror, the first divergence becomes the next causal target.

---

## 6. Next authorized experiment

**PH-01 Mirror M1**

Story:

`+X -> -Y -> brief stop -> +Y -> neutral`

Requirements:

- participant/research Twins;
- exact input mirror;
- research pass-through only;
- Twin World non-interference;
- compare target-displacement magnitude and timing;
- compare label transitions;
- compare command-turn latency;
- participant-first read before causal interpretation.

No behavior tuning before M1.
