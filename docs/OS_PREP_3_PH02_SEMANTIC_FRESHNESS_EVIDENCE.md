# OS-PREP-3 PH-02 — Semantic Freshness / Post-Expiry Policy Evidence

Status: **CLOSED ENOUGH · MATERIAL PATHOLOGY**
Date: **2026-09-18**

Exact qualified candidate:

`f21e9076c0e54b2691212a09d424a62c464f8d33`

Validation:

- `validate` #1318 / run `35361510585` — **FULL GREEN**
- `npm run check` — PASS
- aggregate `browser:audit` — PASS
- post-expiry disturbance capture — PASS
- temporal participant sequence — PASS
- post-expiry Twin shadow — PASS
- inherited relationship semantic provenance / expiry evidence — PASS

## 1. Product question

After canonical Owner meaning has expired to true directionless `NONE`, can retained legacy relationship policy still produce a visible behavior that is materially driven by stale directional intent?

PH-02 does not ask whether the 33-tick expiry contract works internally. That was already qualified.

It asks whether policy continuity beyond semantic expiry has a real participant consequence.

---

## 2. Participant-first temporal read

Source:

9 participant-only canvas frames, t180..t204, sampled every 3 World ticks.

This interpretation was written before opening the causal summary or Twin-shadow result.

### Visible behavior

- t180–t195: player and companion remain in sustained close contact / near-contact;
- there is no immediate clean egress;
- the pair drifts only modestly for most of the window;
- t198 is the first clearly readable break;
- t201–t204: separation becomes clear and continues smoothly;
- no coarse left/right thrash, body teleport or explosive shove is visible at this sampling rate.

### Blind interpretation

The strongest visible signal is:

> after a close-contact situation, the pair stays entangled for surprisingly long before the companion finally clears away.

The participant artifact alone does **not** reveal why.

Live rivals before causal inspection included:

- retained stale relationship frame;
- close-contact physics;
- comfort/egress policy;
- motor inertia;
- local candidate constraints;
- recovery behavior.

Blind classification:

**MATERIAL PARTICIPANT PHENOMENON: sticky close-contact / delayed egress. Cause not yet attributed.**

---

## 3. Canonical semantic truth at the witness

At source tick t180:

- Owner control: `{0,0}`, inactive;
- requested player velocity: effectively zero;
- actual player motion exists only through contact;
- player motion provenance: `EXTERNAL_MOTION_EVIDENT`;
- canonical relationship orientation: **NONE**;
- canonical direction: `null`;
- canonical strength: `0`;
- A1 orientation: **NONE**.

The solver/contact motion is therefore **not** promoted back into Owner meaning.

That part of the semantic repair is working.

---

## 4. Live legacy policy after expiry

At the same t180 state the baseline relationship policy still reports:

- selected slot: `left`;
- player direction: `+X`;
- semantic evidence source: `NONE`;
- frame provenance: `RETAINED_LAST_SEMANTIC_FRAME`;
- target: approximately `(3.248, 2.550)`.

The current player-companion geometry supports a directionless radial target on the opposite side, around `(4.698, 3.991)`.

Target divergence:

**2.044 m**

So semantic expiry is not policy expiry.

The runtime can be epistemically directionless while still acting through a retained directional relationship frame.

---

## 5. Participant-visible consequence

During the 24-tick post-apparatus recovery window:

- contact exists for **19 / 24 ticks**;
- externally caused player motion persists for **9 ticks**;
- maximum player displacement from the release point is approximately **0.057 m**;
- every fresh relationship reconsideration at t186, t192, t198 and t204 still uses:
  - `evidenceSource = NONE`;
  - `frameProvenance = RETAINED_LAST_SEMANTIC_FRAME`;
  - retained `+X` frame;
  - selected slot `left`.

The temporal participant sequence shows the same episode as prolonged stickiness followed by eventual smooth separation.

This establishes temporal alignment between the stale-policy state and the visible phenomenon.

It does not by itself establish exclusive causality.

---

## 6. Counterfactual causal isolation

The already-qualified post-expiry Twin-shadow apparatus starts from the **same exact pre-World-step live state** at t180 and uses:

- the same Rapier physics;
- query-only cloned worlds;
- no mutation of the live World;
- no A1 movement authority;
- one tactical interval / 6 World ticks.

Four command branches were compared.

### Live retained command

Command:

approximately `(-0.467, -0.070)`

Result over 6 ticks:

- contact: **6 / 6 frames**;
- max player displacement: **0.0721 m**;
- max player speed: **0.729 m/s**;
- companion travel: **0.071 m**.

### Directionless radial current-relative command

Command:

approximately `(+1.000, -0.006)`

Result:

- contact: **1 / 6 frames**;
- max player displacement: **0 m**;
- max player speed: **0**;
- companion travel: **0.300 m**.

### HOLD neutral control

Command:

`(0,0)`

Result:

- contact: **6 / 6 frames**;
- max player displacement: **0.0027 m**.

This confirms that doing nothing also leaves the contact unresolved over this short horizon.

### Directionless A1 research branch

Command:

approximately `(+0.861, +0.006)`

Result:

- contact: **2 / 6 frames**;
- max player displacement: **0 m**;
- max player speed: **0**;
- companion travel: **0.258 m**.

This branch is research-only and is **not** a selected replacement policy.

### Directional contrast

- retained vs radial command dot: **-0.988**
- retained vs A1-directionless command dot: **-0.990**
- radial vs A1-directionless command dot: **+0.9999**

So the retained live policy is not a small variant of the directionless escape interpretation.

It sends the companion almost exactly the opposite way.

---

## 7. Causal conclusion

PH-02 now has enough evidence to state:

> after canonical Owner semantics have expired to true `NONE`, `RETAINED_LAST_SEMANTIC_FRAME` can materially drive participant-visible delayed egress / sticky close-contact behavior.

The counterfactual result rules out “close-contact physics alone” as a sufficient explanation for the observed short-horizon persistence.

The retained command contributes materially to keeping the pair in contact and moving the player.

This is a **real product-facing pathology**, not merely debug-state debt.

---

## 8. What this does not prove

PH-02 does **not** prove:

- that the radial current-relative branch is the correct production policy;
- that the A1 directionless branch is correct;
- that retained semantic continuity should always end exactly at 33 ticks;
- that HOLD is a good neutral default;
- that every post-expiry situation will produce contact pathology;
- that the observed 5–7 cm player displacement is itself unacceptable;
- that the Owner will judge the episode as strongly negative in final play.

It also does not justify widening A1 movement authority.

---

## 9. Why PH-02 is closed enough

We now have:

- exact semantic expiry;
- participant-visible temporal phenomenon;
- live retained-policy provenance after expiry;
- same-state/same-physics query-only counterfactuals;
- material command-direction divergence;
- materially better contact release under directionless alternatives;
- no solver-motion contamination of Owner semantics;
- no replacement-policy decision hidden inside the experiment.

Further PH-02 work should be driven by a later architecture or Owner decision, not curiosity.

Carry this pathology forward as a real design constraint:

> semantic freshness and policy continuity must not be conflated.

---

## 10. Next route

Proceed to **PH-03 — pace and separation without chase pressure**.

Highest-value question:

> when the player moves slowly or settles, does the companion choose a pace appropriate to the relationship, or do upstream pace floors / target-chasing pressure create unnecessary motion that downstream smoothing merely hides?
