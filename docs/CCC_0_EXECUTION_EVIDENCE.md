# CCC-0 Shadow Coordination — Execution Evidence

Status: **AUDITED MECHANICAL PASS · AUTOMATED REAL-BROWSER PASS · OWNER OBSERVATION GATE OPEN · ZERO MOVEMENT-OUTPUT AUTHORITY**

Date: 2026-09-14

Base planning checkpoint:

`5e809fc61433b3eceefde088243ad736da0e5b1b`

Exact qualified CCC-0 **application runtime**:

`857620b758bdaafcbfbab48da06ff89e7fc238cd`

Clean repair-branch validation:

- run `34904396219` (`validate` #628) — SUCCESS;
- **52/52 test files PASS**;
- **221/221 tests PASS**;
- strict TypeScript PASS;
- production Vite build PASS;
- npm install audit: **0 vulnerabilities**;
- real Chromium black-box audit PASS.

Fresh PR #17 merge-ref validation of the same exact application runtime:

- run `34904538403` (`validate` #630) — SUCCESS;
- **52/52 test files PASS**;
- **221/221 tests PASS**;
- strict TypeScript PASS;
- production build PASS;
- real Chromium audit PASS.

This file is a documentation descendant of the exact application runtime above. Documentation commits must not be confused with the runtime that was mechanically qualified.

## Public preview state during this documentation update

The composite Pages deployment is independently pinned on `main`.

At the moment this evidence update was written:

- Foundation root remained pinned to exact Owner-qualified Foundation `b217943e027e66993f0010643b2933b01d4b1e6d`;
- public `/ccc0/` was still the **older** qualified checkpoint `a2a0e793f01a6fe3b435e473cb9912347f2fcb0d`;
- Pages authority was still `5054ffabbe72bc6dedb46196b00da2a32c9b7c29` / deployment `34894499080`.

Therefore the public `/ccc0/` URL must not yet be treated as the new `857620b...` Owner-gate runtime until the separately pinned Pages workflow is updated, deployed and verified.

Owner protocol:

`docs/CCC_0_BROWSER_GATE_CHECKLIST.md`

The broad falsification provenance remains on PR #18 / `audit/ccc0-owner-readiness-falsification`. The clean PR #17 line contains only retained repairs and durable regression gates.

---

## 1. Stage question and current answer

CCC-0 asks:

> Before changing companion movement, can the trusted runtime produce bounded, causal and inspectable evidence for WHERE, PACE and PLAYER FLOW beside legacy authority, while proving that the research substrate does not change authoritative movement output?

Current answers:

- **mechanical substrate: PASS**;
- **automated production-browser integration: PASS**;
- **Owner semantic / real-machine performance observation: OPEN**;
- **movement-output authority: ZERO / NOT AUTHORIZED**.

The automated browser gate materially reduces uncertainty about integration and catastrophic frame stalls. It does **not** prove subjective legibility, teammate quality, Owner-machine smoothness or that the present policy deserves authority.

---

## 2. Current responsibility decomposition

The vocabulary remains provisional and throwaway-ready.

### WHERE — shadow relationship region

Current bounded field:

- 32 directions × 3 radii = 96 player-relative samples;
- hard body validity separate from comfort quality;
- continuous rather than binary low-speed heading influence;
- local scoring before route work;
- at most 12 route-qualified shortlist targets;
- direct static-traversal fast path when direct reachability can be proved;
- full static router fallback when direct traversal cannot prove the target;
- route-aware coherent near-best component rather than global centroid averaging;
- weighted representative restricted to the coherent component;
- representative hard/route revalidation;
- stable sample-id tie-break for near-equal scores;
- explicit `NO_HARD_VALID_SAMPLE` vs `ROUTE_SHORTLIST_EXHAUSTED` uncertainty;
- no player-center fallback.

The representative anchor is an adapter/debug artifact. The coherent region is the research object.

### PACE — temporal relationship pressure

Current evidence exposes:

- companion physical speed capability;
- player and companion observed speed;
- distance / route distance to useful region where meaningful;
- relative opening/closing motion;
- duration outside useful region in real World ticks;
- continuous urgency and provisional desired speed;
- diagnostic labels such as `SETTLED`, `FOLLOWING`, `CATCH_UP`, `RECOVERING`.

Labels remain explanation, not a behavior FSM contract.

### PLAYER FLOW — short-horizon player-space evidence

Current corridor/evidence exposes:

- meaningful actual player velocity first, otherwise requested velocity;
- no fabricated world-axis heading when no motion evidence exists;
- finite, explicitly aged recent velocity-direction memory;
- smooth fading of old direction evidence during a stop;
- bounded short prediction horizon;
- distinct physical and comfort envelopes;
- confidence / reversal uncertainty;
- separate preferred-motion and final-authoritative-command conflict channels.

---

## 3. Multi-rate cognition and provenance

CCC-0 shadow cognition currently runs every:

`CCC0_SHADOW_INTERVAL_TICKS = 6`

At the current 60 Hz World step this is approximately 10 Hz.

This cadence is **provisional**. It is not a permanent brain frequency.

Causal safeguards remain:

- successful shadow frames preserve their original `shadowTick`;
- causal evidence exposes `ageTicks` rather than pretending cached evidence is same-tick;
- PACE duration advances in World ticks rather than cognition-call count;
- failed shadow evaluations are tick-local event evidence and are not cached as fresh failures on intervening motor ticks.

Recent velocity direction is also explicitly aged. Short stops may retain useful trajectory context; prolonged stops expire it instead of converting old motion into permanent pseudo-facing.

---

## 4. WHERE cost repair and equivalence evidence

The first implementation exposed a real hidden-cost problem: a 12-target shortlist did **not** imply bounded routing work because each candidate could invoke the full visibility router.

The retained repair performs a hard static direct-traversal check first and invokes the full router only when direct reachability is not established.

Durable evidence:

- randomized direct-fast-path vs full-router equivalence: **1,040 open + 1,040 pillar + 1,040 doorway = 3,120 PASS**;
- directly reachable regression fixture uses **26 static traversal queries** with 0, 1, 2, 4, 8 and 12 distant semantically irrelevant obstacles;
- representative selection and hard/route revalidation remain intact.

This means the earlier current-state claim that ordinary pillar/doorway WHERE necessarily costs >100 traversal queries is obsolete. Full-router fallback may still be expensive when geometry genuinely requires it, but directly reachable samples no longer rebuild global route graphs just because obstacles exist elsewhere.

---

## 5. Temporal continuity findings

### Low-speed threshold

The binary low-speed heading switch was replaced by continuous heading strength plus stable near-tie ordering.

Sequential real-history evidence:

- 0.001 m/s speed ramp maximum shadow-anchor step: **0.2113809669 m**;
- alternating ±0.001 m/s jitter around 0.20 m/s maximum step: **0.1054184395 m**;
- very small threshold perturbations now produce proportionally small semantic displacement.

### Velocity-memory fade

The first audit oracle demanded `<0.5 m` maximum anchor displacement per 6-tick cognition observation during stop/fade. Further falsification showed that threshold was not defensible as a blocker.

Current exact qualification records:

- maximum 6-tick stop/fade step: **0.8151463205 m**;
- direction strength decays monotonically to zero;
- old velocity direction expires instead of persisting indefinitely;
- the durable coarse regression prevents return to a whole-meter single-observation expiry jump.

Audit characterization showed strong cadence sensitivity and a worse legacy comparison: the old S1 target could snap roughly **2.051 m** on the same `east → stop → west` sequence.

Therefore **0.815 m remains a known Owner-visible limitation**, not something hidden by another layer of hysteresis merely to satisfy an arbitrary test.

Rejected during audit and intentionally absent from the clean line:

- previous-region candidate carry-over;
- soft representative / extra representative hysteresis.

---

## 6. Zero movement-output authority

CCC-0 remains integrated after authoritative DIRECT/NATURAL command selection:

`authoritative movement decision -> capture selected command evidence -> optional CCC-0 evaluation -> return original command`

The shadow layer cannot replace that command.

Durable evidence now includes an expanded differential torture campaign:

- open DIRECT / NATURAL;
- pillar DIRECT / NATURAL;
- doorway DIRECT / NATURAL;
- head-on DIRECT / NATURAL;
- 360 World steps per case;
- **2,880 adversarial World steps total**.

Authoritative command / World outcome equivalence remains byte-identical across the tested control and CCC-enabled paths.

Legacy Foundation survival, hard/comfort, progress/recovery and forensics regressions also remain green.

Mechanical conclusion:

> **CCC-0 has no semantic movement-output authority within the tested workbench contract.**

This is not a claim that synchronous shadow computation has zero timing cost.

---

## 7. Real-browser workbench finding and repair

The Owner-readiness audit found a genuine workbench defect that unit/simulation tests had not exposed.

`CausalPanel.update()` recreated every dynamic `<details>` node every frame. Consequences:

- a user-opened CCC section immediately collapsed on the next render;
- merely remembering the `open` boolean was insufficient because the `<details>/<summary>` element itself was repeatedly detached;
- a normal browser click could not reliably acquire a stable live target.

Retained repair:

- keyed in-place reconciliation by `section.id`;
- stable `<section>`, `<details>` and `<summary>` identity across live frames;
- only dynamic text content is refreshed;
- explicit user disclosure state persists;
- legacy default-open sections retain their previous defaults;
- CCC WHERE/PACE/PLAYER FLOW remain collapsed initially but stay open once the user opens them.

This behavior is defended by both deterministic disclosure-state tests and a real Chromium black-box gate using ordinary `<summary>` clicks.

---

## 8. Automated real-browser qualification

### Clean runtime push qualification — run `34904396219`

Chromium `153.0.8010.12`:

- initial tick 5; final tick **604**;
- Open / Pillar / Doorway / Head-on switched through the real panel UI;
- DIRECT / NATURAL toggled through the real control;
- WASD produced live PLAYER FLOW evidence;
- Coordination overlay enabled through the real checkbox;
- WHERE and PLAYER FLOW disclosures remained open across live updates;
- runtime fault sentinel: absent;
- page errors: **0**;
- console errors: **0**;
- failed requests: **0**;
- rAF p50 ~33.3 ms, p95 ~33.4 ms, p99 50.0 ms, max 133.3 ms;
- >250 ms stalls: **0**; >1000 ms stalls: **0**.

### Fresh PR #17 merge-ref qualification — run `34904538403`

Same exact application runtime, merged against current `main`:

- initial tick 5; final tick **538**;
- all four scenarios exercised;
- persistent WHERE / PLAYER FLOW disclosure: PASS;
- errors page / console / request: **0 / 0 / 0**;
- rAF p50 **16.7 ms**, p95/p99 **33.4 ms**, max **116.6 ms**;
- >50 ms stalls 2; >100 ms stalls 1; >250 ms stalls **0**; >1000 ms stalls **0**.

Interpretation:

> **Automated production-browser readiness PASS.**

These CI timings are characterization, not a 60-FPS guarantee and not evidence about the Owner's machine. The Owner still decides whether periodic cognition work is perceptible and whether the evidence is usable.

---

## 9. Current falsifier coverage

Durable clean-line coverage now includes:

- deterministic / finite shadow evidence;
- 96-sample field and 12-route-target bounds;
- no arbitrary stationary +X heading;
- recent heading preserved briefly but expired after prolonged stop;
- explicit reversal uncertainty;
- continuous low-speed heading influence;
- stable near-tie sample ordering;
- sequential low-speed ramp and jitter continuity;
- direct-route cost regression;
- 3,120 fast-path/full-router equivalence cases;
- metamorphic invariants;
- 2,880-step zero-authority differential torture;
- output scale bound to actual World requested velocity;
- stale shadow failures cannot masquerade as fresh evidence;
- causal-panel disclosure persistence;
- real production-build Chromium interaction / fault / gross-stall gate.

Broader cadence/topology/legacy/cost characterization remains available on PR #18 as research provenance without bloating the clean promotion line.

---

## 10. Material findings retained as knowledge

1. Missing direction evidence is not direction.
2. Bounded shortlist exhaustion is not global unreachable truth.
3. Candidate count is not a valid proxy for actual route-query cost.
4. Direct static reachability can eliminate unnecessary global route work without changing route truth in the qualified cases.
5. Coordination cognition does not need to share the motor clock.
6. Temporal semantics must use World time, not cognition-call count.
7. Cached evidence requires explicit observation age.
8. Old velocity direction must decay rather than become permanent pseudo-facing.
9. Preferred and final player-flow conflict are different causal boundaries.
10. Semantic/output non-interference does not by itself prove presentation-time smoothness.
11. A browser-only interaction defect can make otherwise-good telemetry practically unreadable; workbench usability is part of research readiness.
12. Falsifiers themselves are provisional: the audit correctly rejected the initial `<0.5 m` continuity blocker instead of tuning policy to a bad oracle.

---

## 11. Rework freedom / non-claims

CCC-0 does **not** prove or freeze:

- current utility weights;
- 32 × 3 sampling;
- current radii;
- 12-target shortlist;
- 6-tick / ~10 Hz cognition cadence;
- current router as long-term WHERE substrate;
- representative anchor as future movement-target interface;
- WHERE/PACE/PLAYER FLOW as final architecture;
- current corridor as a final player predictor;
- current shadow policy as authority-ready;
- right-of-way / chokepoint negotiation;
- multi-companion coordination;
- command/combat behavior;
- imperceptible timing cost on the Owner's machine.

Current structures remain aggressively replaceable when better evidence appears.

---

## 12. Promotion boundary

### Mechanical substrate

**AUDITED PASS** on exact application runtime `857620b...`.

### Automated real-browser integration

**PASS** on exact application runtime `857620b...`.

### Public Pages delivery of the new runtime

**PENDING at the moment of this documentation commit.** The existing public `/ccc0/` still points at the older pinned checkpoint until the operational Pages workflow on `main` is deliberately updated and independently verified.

### Owner semantic / real-machine performance observation

**OPEN.**

Owner should challenge especially:

- WHERE/PACE/PLAYER FLOW legibility;
- justified topology changes vs meaningless instability;
- the visible ~0.815 m stop/fade transition;
- corridor confidence under stop/reversal/jitter;
- preferred-vs-authoritative conflict usefulness;
- cached age clarity;
- any perceptible periodic ~10 Hz hitching;
- whether incident evidence makes bad shadow decisions explainable.

### Movement authority

**NOT AUTHORIZED.**

A clean Owner PASS qualifies CCC-0 as a sufficiently useful research substrate for replanning the next experiment. It does not bless the present coordination policy for movement authority.
