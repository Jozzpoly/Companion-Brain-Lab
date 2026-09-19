# OS-PREP-3 PH-07 — Pillar Mirror / Deterministic Topology Bias Evidence

Status: **PHENOMENON CLOSED ENOUGH · MATERIAL BOUNDED ROUTER TIE-BIAS · FULL #1349 REGRESSION TAIL PENDING**
Date: **2026-09-19**

Runtime / specimen checkpoint:

`6e1c605fa9574de8a1de0753c5b741ffd7611293`

Validation:

- `npm run check` — PASS in Validate #1349;
- aggregate `browser:audit` — PASS in Validate #1349;
- PH-07 pillar mirror capture — PASS in Validate #1349;
- PH-07 artifact upload — PASS;
- inherited full regression tail was still running when this evidence note was first written.

Authority:

- gameplay = existing SPATIAL / NATURAL baseline;
- A1 research Twin = PASS_THROUGH_ONLY;
- P2 = not enabled;
- intentional side/personality claim = NONE.

## 1. Product question

Does a known deterministic/fake preference leak into a material world/topology choice around a symmetric obstacle?

The important distinction is:

> reproducibility is useful, but a stable implementation tie-break must not silently become companion personality or world preference.

## 2. Experiment

Use the existing symmetric central-pillar scenario.

Two mirrored participant stories:

- top: `+Y 48 -> +X 120 -> -Y 48`;
- bottom: `-Y 48 -> +X 120 -> +Y 48`.

For each story:

- participant Twin;
- research Twin;
- identical World reset and step schedule;
- A1 research remains pass-through only;
- no P2;
- no gameplay tuning between variants.

The mirror oracle compares world-space geometry around the horizontal world axis, not raw symbolic slot names.

## 3. Participant-first result

Neither story produces a jam, collision or obvious traversal failure.

However the two histories are not exact geometric mirrors during the early pillar episode.

The asymmetry is bounded and transient enough that a single isolated run could easily be interpreted as ordinary route choice. In paired mirror evidence it is material.

## 4. Twin integrity

Research observation does not create the finding.

Top Twin:

- maximum position error: **0**;
- maximum velocity error: **0**.

Bottom Twin:

- maximum position error: **0**;
- maximum velocity error: **0**.

Browser/page/request error sets are empty.

## 5. Mirror result

Numerical mirror errors over the story:

- player position: ~**0.000046 m**;
- relationship target: ~**0.000046 m**;
- companion position: ~**0.441389 m**;
- companion command velocity: ~**2.160813 m/s**;
- companion actual velocity: ~**2.160837 m/s**.

Player and relationship geometry therefore mirror to floating-point tolerance while companion routing/motion does not.

## 6. First divergence

The first physical divergence occurs at **tick 0**.

Relationship semantics are mirror-correct:

- top relationship label = `right`;
- bottom relationship label = `left`;
- mirrored bottom label = `right`;
- mirrored target error = 0 at the first decision.

But both runs initially choose the same literal route:

`start > pillar.center.ne > pillar.center.nw > target`

For the bottom story, the geometric mirror of that route is:

`start > pillar.center.se > pillar.center.sw > target`

The bottom run switches to the south route only around **t6**.

The initial same-side route therefore precedes and explains the later embodied divergence.

## 7. Causal localization

The existing static router resolves equal/near-equal route costs deterministically through lexical `pathKey` ordering.

The existing central-pillar router test also explicitly expects the north `.ne/.nw` route in the symmetric fixture.

This is strong evidence that:

> an old reproducibility tie-break has become an unearned topology-side preference in symmetric world states.

This finding is distinct from PH-01's relationship-slot lexical bias.

PH-07 does not show the relationship frame choosing the wrong mirrored side. It shows the route layer breaking symmetry after receiving mirror-correct relationship geometry.

## 8. Product interpretation

This is a **real bounded pathology**, not an apparatus defect.

It does not currently establish:

- that normal play is broadly obstructive;
- that the Owner will dislike the resulting motion;
- a correct replacement tie policy;
- that route symmetry should always be mandatory;
- that companions may never have intentional preferences.

The current episode has no contact and self-corrects after the initial routing interval.

A replacement rule would itself encode gameplay meaning: preserve previous route, prefer relationship-consistent side, preserve motion continuity, use contextual affordance, or eventually expose explicit personality. Selecting that policy before Owner evidence would exceed PH-07.

## 9. Decision

Do **not** repair the router as part of OS-PREP.

Carry PH-07 into Owner Sandbox as a known causal pathology.

If the Owner notices undesirable side/topology behavior, the exact failure is now recoverable and a later rework can be tested against a concrete participant judgement instead of replacing one arbitrary tie-break with another.

## 10. Route forward

PH-07 has answered its product question strongly enough.

OS-PREP-3 should not manufacture another topology story for completeness.

Remaining map handling:

- PH-06: no generic contact sweep; PH-02 already provides strong close-contact/egress pressure;
- PH-09: defer until a naturally earned bounded conflict state can use P2 without building an artificial state setter or weakening the `semanticpush` incompatibility guard;
- PH-10: participant-first interpretation has already been exercised throughout PH-01/02/03/04/05/07 and directly cross-checked in PH-08.

After the full #1349 regression tail closes, route to OS-PREP-4 synthesis by evidence reuse rather than a new harness.
