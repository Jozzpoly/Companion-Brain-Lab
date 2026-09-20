# Authority-A1.0 — Execution Evidence

Status: **PASS · STRUCTURAL AUTHORITY SHELL QUALIFIED · ZERO NEW MOVEMENT POLICY AUTHORITY**

Canonical parent plan:

`docs/AUTHORITY_A1_STAGE_PLAN_V2.md`

Exact qualified application/runtime head:

`7c0efd86f8c4808754f3e984e7af104854afcd3c`

Validate:

- run **#751**
- run id `34916876663`
- job id `104216317912`
- result: **PASS**

This runtime pin is intentionally separate from later documentation/planning commits.

---

## 1. Stage verdict

Authority-A1.0 passes its bounded stage question:

> the workbench now has an isolated experimental A1 selector and a true decision-time `A1Situation@t` factual seam before companion command selection, while every A1.0 selector variant remains behavior-equivalent pass-through and the existing baseline runtime remains defended.

A1.0 does **not** prove useful-region, PACE, player-cooperation, temporal A1 movement, final player guard or teammate behavior quality.

No new movement policy authority was granted in this stage.

---

## 2. Exact mechanical qualification

At `7c0efd86...` / validate #751:

- npm install audit: **0 vulnerabilities**;
- strict TypeScript: **PASS**;
- Vitest: **61 / 61 test files PASS**;
- Vitest: **281 / 281 tests PASS**;
- production Vite build: **PASS**;
- existing CCC-0 Chromium audit: **PASS**;
- Authority-A0 Chromium audit: **PASS**;
- Authority-A1.0 Chromium audit: **PASS**.

Existing Foundation survival, routing, hard/comfort, recovery and CCC-0 differential suites remained green.

---

## 3. A1.0 contracts now executable

### 3.1 Orthogonal experimental selector

`A1AuthorityRuntime` exposes:

- `OFF`;
- `DIRECT`;
- `TEMPORAL`.

The selector is orthogonal to `COMPANION_MODES` and does not alter the existing MANUAL → CHASE → RELATIONAL → SPATIAL mode cycle.

A1 is active only while base mode is SPATIAL and an A1 variant is explicitly selected.

Switching A1 variants resets only A1-owned state/history.

### 3.2 Pass-through-only stage boundary

During A1.0:

- OFF bypasses A1 decision-time execution;
- DIRECT builds/stores A1 factual evidence but returns the baseline companion `MotionIntent` unchanged;
- TEMPORAL does the same.

Therefore the selector and factual seam can be qualified before policy complexity is allowed to change movement.

### 3.3 Decision-time `A1Situation@t`

`A1Situation` is constructed before companion submission from:

- the live decision snapshot at tick `t`;
- the current same-step player `MotionIntent` at `t`;
- World-backed player/companion `MovementCapability`;
- the previous completed A0 World-step outcome only when it ends exactly at `t`.

This explicitly separates:

- current Owner request at `t`;
- current decision-boundary body state;
- previous completed World outcome `t-1 → t`.

### 3.4 Decision snapshot phase truth

A material implementation finding was discovered during A1.0 qualification:

`LabWorld.snapshot()` / physical snapshot intentionally returns a kinematically neutral snapshot for requested/actual velocity and motion error. The rich kinematic decision snapshot after tick zero is the snapshot returned by the immediately preceding `World.step()`.

A1 now rejects a fresh neutralized snapshot at `t > 0` when it does not match the previous completed World outcome.

This prevents a consumer from silently erasing prior-step physical evidence and interpreting the player/body as stationary.

### 3.5 Tick / scenario / capability alignment

A1Situation now rejects or structurally prevents:

- previous outcome whose `outcomeTick != current tick`;
- non-adjacent previous observation/outcome phase;
- previous evidence from a different scenario even when tick numbers happen to match;
- player/companion capability actor-id mismatch;
- non-finite current Owner motion input.

The current same-step control source tick is created from the current decision tick rather than reconstructed from prior body state.

### 3.6 World normalization binding

A1 same-step requested player velocity uses the same unit-disk input semantics as World.

A real World regression with an over-unit input `{1.2, 0.9}` proves the A1 requested velocity equals the actual post-World requested velocity scale rather than overestimating speed.

---

## 4. Exact zero-authority differential

`src/coordination/a1-zero-authority.integration.test.ts` qualifies:

- Open;
- Pillar;
- Doorway;
- Head-on;
- existing DIRECT actuator;
- existing NATURAL actuator;
- A1 OFF;
- A1 DIRECT pass-through;
- A1 TEMPORAL pass-through.

Matrix:

`4 scenarios × 2 legacy actuators × 3 A1 selector states = 24 deterministic trials`

Each runs 120 World steps.

Required exact equality includes:

- baseline companion `MotionIntent`;
- selected A1.0 companion `MotionIntent`;
- World snapshot/outcome;
- progress/recovery evidence.

All 24 trials PASS.

Existing stronger CCC-0 8×360 adversarial byte-identical differential also remains PASS.

---

## 5. Real Chromium evidence

Authority-A1.0 browser schema:

`companion-brain-lab-authority-a1-0-browser-v1`

Exact #751 audit:

- Chromium `153.0.8010.12`;
- 21 active A1 decision frames captured;
- no page errors;
- no console errors;
- no failed requests;
- no runtime fault sentinel;
- 91 requestAnimationFrame timing samples;
- maximum observed frame interval **66.6 ms**;
- no >1 s stall.

### 5.1 Same-tick real keyboard reversal

The audit uses real keyboard events plus a deterministic physics boundary:

1. hold real `D` until a completed +X World response exists;
2. pause simulation while `D` is still held;
3. release `D` and press real `A` while paused;
4. execute exactly one real workbench single-step.

Qualified frame:

- decision tick: `35`;
- current same-step requested player velocity: `{-3, 0}`;
- previous completed World requested velocity: `{+3, 0}`;
- previous World phase: `34 → 35`;
- previous outcome age: `0` ticks;
- selected companion command equals baseline companion command exactly.

This proves current Owner reversal is visible at the decision boundary without overwriting or confusing the previous physical outcome.

### 5.2 Selector reset

Real UI transition DIRECT → TEMPORAL:

- A1 epoch advances;
- first TEMPORAL pass-through step is exactly `1`;
- selected command remains equal to baseline.

### 5.3 OFF silence

After cycling TEMPORAL → OFF and executing a real single step:

- A1 browser evidence frame count remains unchanged.

This is browser evidence that the A1 decision path is not still executing while selector is OFF.

---

## 6. Intermediate browser falsifier

An earlier browser run (#745) failed the first reversal harness even though all mechanical tests passed.

Cause:

- non-paused Playwright `keyup(D) → keydown(A)` allowed a render/physics step between browser events;
- the previous completed World request could therefore become neutral before the -X decision was observed.

The assertion was not weakened.

The harness was strengthened to establish a +X outcome, pause the simulation, change real keyboard state while paused, then execute exactly one World step.

The strengthened gate passed in #747 and again after final alignment hardening in #751.

Lesson:

> decision-phase provenance tests need a deterministic motor boundary; browser event ordering alone is not a reliable simulation-step boundary.

---

## 7. Existing research gates remained intact

At final #751:

CCC-0 Chromium:

- PASS;
- max frame interval `83.3 ms`;
- zero page/console/request errors.

Authority-A0 Chromium:

- PASS;
- real external player motion still diagnosed;
- requested speed `0`;
- actual speed `1.5342013510851058`;
- contact `companion`;
- provenance `EXTERNAL_MOTION_EVIDENT`;
- hard route `routed` while desired comfort route `unreachable`;
- max frame interval `100.1 ms`;
- zero page/console/request errors.

The exact numerical solver-push speed is not a fixed product invariant; the provenance separation is the defended property.

---

## 8. Performance / instrumentation note

No A1.0 performance blocker was observed.

There is one small known diagnostic inefficiency:

- while A1 is active, workbench debug publication currently obtains a defensively cloned `debugState()` even when the optional `?a1debug=1` bridge is not installed.

This is not movement authority and did not produce a material browser timing failure in A1.0.

Do not let this grow unnoticed when A1.1 evidence becomes heavier. Before large candidate/region structures are stored in the runtime debug state, either make debug publication lazy or expose a lightweight metadata path.

---

## 9. A1.0 PASS boundary

A1.0 proves:

- the experimental authority selector is isolated;
- baseline mode-cycle semantics are preserved;
- A1-owned state has a clear reset boundary;
- same-step Owner intent exists at the companion decision boundary;
- previous physical outcome remains distinct and correctly phased;
- scenario/tick/capability mismatches are defended;
- current requested velocity is bound to World semantics;
- OFF/DIRECT/TEMPORAL scaffold remains behavior-equivalent;
- real Chromium sees the required same-tick reversal provenance.

A1.0 does **not** prove:

- player-relative useful-region semantics;
- relationship-orientation memory;
- moving-frame prediction;
- PACE;
- player cooperation;
- A1 local velocity authority;
- A1 temporal actuation;
- dual-hypothesis final player safety;
- attribution-driven invalidation;
- teammate feel.

Those remain later A1 packages under the canonical V2 plan.

---

## 10. Next stage

The next runtime package is **A1.1 — relative useful-region semantics**.

Do not start by promoting CCC-0 `ShadowRelationshipRegion` wholesale.

First re-plan A1.1 against the actual A1.0 seams, especially:

- decision-time current Owner input now exists independently of prior physical motion;
- the rich decision snapshot phase is explicit;
- A1 can own semantic memory without contaminating baseline brains;
- useful-region meaning must remain player-relative first and world projection second;
- future A1.2 will need moving-frame projection without converting the region back into one semantic anchor.

A1.1 should remain non-authoritative or pass-through until its representation is independently falsified and qualified.
