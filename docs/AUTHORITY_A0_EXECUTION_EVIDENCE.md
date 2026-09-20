# Authority-A0 — Execution Evidence Checkpoint

Status: **A0 PASS · ZERO NEW MOVEMENT AUTHORITY · A1 RE-PLAN ENABLED**

This document closes the Authority-A0 contract-extraction stage defined by:

- `docs/COORDINATION_AUTHORITY_REPLAN.md`
- `docs/AUTHORITY_A0_CONTRACT_PLAN.md`

It is an evidence checkpoint, not a claim that the companion is behaviorally improved.

---

## 1. Exact qualified runtime

Branch:

`planning/coordination-authority-replan`

Exact application/runtime head:

`f006e3c4c60d3882482aad98b5807612da076a36`

Pull request:

PR #20 — `Authority-A0: post-forensics coordination contracts · zero authority`

Validation:

- workflow: `validate`
- run: **#713**
- run id: `34914382606`
- conclusion: **PASS**
- merge candidate checked by CI: `e6fe7ddfa94e0fa8a7c218d795f4ee3a2ed63579`

The exact runtime pin above is intentionally separate from later documentation-only commits.

---

## 2. Stage verdict

**PASS.**

A0 answered its stage question:

> Can the runtime expose the factual contracts required by the first real teammate-authority experiment without changing existing movement behavior?

Current evidence says **yes**.

A0 did not promote any CCC-0 WHERE, PACE, player-flow, hard-route, outcome-attribution or cooperation result into movement authority.

It extracted factual/provenance seams beside the existing behavior and defended zero behavioral interference through deterministic differential tests and real-browser qualification.

This PASS enables a fresh A1 design pass. It does **not** authorize blindly promoting the existing CCC-0 shadow outputs.

---

## 3. Mechanical qualification

Exact #713 result:

- TypeScript strict check: **PASS**
- Vitest: **58 / 58 test files PASS**
- Vitest: **246 / 246 tests PASS**
- production Vite build: **PASS**
- npm audit during install: **0 vulnerabilities**
- existing CCC-0 Chromium audit: **PASS**
- Authority-A0 Chromium audit: **PASS**

Foundation survival regressions remained green under both DIRECT and NATURAL execution.

---

## 4. Zero-authority differential result

The strongest A0 boundary is not "we did not intend to change behavior". It is differential evidence that behavior-bearing execution remained identical.

### 4.1 Existing CCC-0 differential torture

All eight adversarial 360-World-step comparisons remained byte-identical:

- Open DIRECT — PASS
- Open NATURAL — PASS
- Pillar DIRECT — PASS
- Pillar NATURAL — PASS
- Doorway DIRECT — PASS
- Doorway NATURAL — PASS
- Head-on DIRECT — PASS
- Head-on NATURAL — PASS

The comparison defends authoritative commands, World outcomes and recovery behavior rather than merely checking survival.

### 4.2 World-boundary differential

The instrumented `LabWorld` was also compared against a raw `RapierPhysicalWorld` under the same 180-step intent stream.

Physical actor outcomes remained exactly equal.

This is important because A0 now captures pre-step and post-World evidence at the World boundary. The instrumentation therefore has direct proof that observing the step does not alter the step.

### 4.3 Observer failure isolation

The opt-in A0 observer path is failure-isolated:

- each observer receives a defensive evidence copy;
- mutating one observer's copy does not contaminate another observer or stored World evidence;
- an observer exception is caught after World execution and cannot change or abort World authority.

The browser bridge therefore remains instrumentation, not a hidden control channel.

---

## 5. Capability truth

A0 introduced `MovementCapability` sourced from the same actor specification truth used to create physical World actors.

Evidence:

- normal World player capability reports `maxSpeed = 3` and World requested velocity uses that same scale;
- a synthetic companion configured with `speed = 5` reports exactly `maxSpeed = 5`, radius `0.42`, source `actor-spec`;
- no brain-side hard-coded `3` is required to construct this capability contract.

This closes the specific forensics risk where planning/safety reasoning could silently assume 3 u/s while World executes a different actor capability.

### World-unit command proof

`VelocityCommand` derives world velocity from the authoritative capability.

Qualified examples include:

- move `{0.6,-0.2}` at max speed 5 → velocity `{3,-1}`;
- move `{0.7,0.1}` at max speed 5 → velocity `{3.5,0.5}`;
- representative MotionIntent round trips stay below `1e-15` reconstruction error;
- actor/capability mismatches throw instead of silently rescaling the wrong actor.

**Non-claim:** existing World submission was deliberately **not** routed through the new adapter in A0. The command representation is qualified as a factual seam, not yet promoted plumbing.

---

## 6. Situated player truth and temporal provenance

The most important A0 correction is that "player velocity" is no longer treated as one semantic fact.

The qualified causal phases are now explicitly:

`same-step owner control @ t`

→ `body-before / prior World outcome @ t`

→ `World`

→ `body-after / immediate World outcome @ t+1`

A0 exposes those phases separately.

### 6.1 Same-step control

`PlayerControlEvidence` carries:

- source tick;
- normalized control move;
- active/inactive state.

It comes from the exact MotionIntent submitted for the current World step, not reconstructed from body velocity.

### 6.2 Body evidence

Raw body channels remain separate:

- requested velocity;
- actual velocity;
- motion error;
- contacts;
- source tick.

A0 does not collapse them into a single canonical player heading.

### 6.3 Conservative provenance

Available classifications:

- `OWNER_DIRECTED`
- `OWNER_CONSTRAINED`
- `EXTERNAL_MOTION_EVIDENT`
- `MIXED_OR_UNCERTAIN`
- `STATIONARY`

The classification remains an inference with a reason, never a claim of exact force decomposition.

### Important falsification during A0

Two intermediate CI runs (#687 and #690) exposed a mistaken assumption in the first A0 test design: material solver-induced motion is an immediate **post-World** fact and does not have to survive as the next pre-step body's simultaneous contact+velocity state.

A0 was not "fixed" by weakening a threshold.

The evidence model was corrected so observation-time body truth and post-World outcome truth are separate phases.

That corrected model passed #693 and all later gates.

---

## 7. Real-browser player provenance

Exact #713 Authority-A0 Chromium audit:

- browser: Chromium `153.0.8010.12`
- incident schema: `companion-brain-lab-authority-a0-incident-v1`
- real downloaded incident: `companion-authority-a0-head-on-tick-133.json`
- incident frames: **184**
- scenarios in incident: `open`, `head-on`

### Real owner input

A real keyboard `D` press reached same-step control evidence at observation tick 13:

- move: `{1,0}`
- control source tick matched the observation tick.

The pre-step body provenance at that instant was `STATIONARY`.

That is expected and is itself useful evidence: current owner intention and prior body outcome are separate facts rather than being forced to agree in the same frame.

### Real solver-induced motion

The audit then switched the real workbench to Head-on + MANUAL and held the companion's real `ArrowLeft` control while player WASD remained zero.

Qualified frame:

- observation tick: `60`
- outcome tick: `61`
- player requested speed after World: `0`
- player actual speed after World: `1.3570264553624418`
- contacts: `companion`
- provenance: **`EXTERNAL_MOTION_EVIDENT`**

The body motion caused by the physical interaction was therefore not mislabeled as Owner intention.

This directly closes the forensics provenance leak that had allowed solver-induced player motion to become semantic relationship-heading evidence.

---

## 8. Hard route truth vs desired comfort

A0 did not rewrite the authoritative router.

Instead it created a parallel factual contract that asks the hard-connectivity question separately from desired comfort quality.

`HardRouteTruthEvidence` now carries its own `sourceTick` and exposes:

- hard route status/reason/path/cost;
- desired-clearance route status/reason/path/cost;
- hard reachability;
- desired reachability;
- `comfortErasesHardConnectivity`.

### Qualified narrow-passage counterexample

The synthetic narrow-boundary fixture is qualified both in deterministic tests and inside real Chromium A0 incident generation.

Exact browser result in #713:

- fixture: `narrow-boundary-hard-only-passage-v1`
- hard status: **`routed`**
- desired-clearance status: **`unreachable`**
- `comfortErasesHardConnectivity = true`

Thus the runtime can explicitly represent:

> physically reachable, but not reachable under desired comfort construction

instead of flattening both facts into `unreachable`.

**Non-claim:** current movement/recovery still consume the legacy/default route in A0. A1 must decide whether and where hard truth receives authority.

---

## 9. Outcome attribution

A0 introduced a conservative post-World attribution contract with explicit adjacent temporal provenance:

- `observationTick`
- `outcomeTick = observationTick + 1`

Non-adjacent attribution inputs are rejected.

Available classifications:

- `SELF_ACTION_SUPPORTED`
- `SELF_ACTION_CONSTRAINED`
- `EXTERNAL_DISPLACEMENT_EVIDENT`
- `MIXED_OR_AMBIGUOUS`
- `NO_MEANINGFUL_MOTION`

Qualified fixtures include:

- healthy aligned action → `SELF_ACTION_SUPPORTED`;
- materially suppressed action with contact → `SELF_ACTION_CONSTRAINED`;
- nonzero command plus player contact → `MIXED_OR_AMBIGUOUS`;
- stationary zero command → `NO_MEANINGFUL_MOTION`;
- **zero command + player contact + ~0.074 u displacement + 1.483 u/s actual velocity → `EXTERNAL_DISPLACEMENT_EVIDENT`.**

The last fixture directly falsifies the legacy assumption that metric improvement necessarily proves the companion's chosen action worked.

**Non-claim:** attribution does not yet control `ProgressRecoveryMonitor` or spend/reset recovery budget.

---

## 10. Freshness contract

A0 now avoids implicit clock-phase assumptions:

- same-step player control → `sourceTick`;
- player/companion body evidence → `sourceTick`;
- world-unit velocity command → `sourceTick`;
- hard-route truth → `sourceTick`;
- World-step aggregate → `observationTick` + `outcomeTick`;
- outcome attribution → explicit adjacent `observationTick` + `outcomeTick`;
- existing CCC-0 multi-rate evidence retains `shadowTick` + `ageTicks`.

No universal freshness budget was invented in A0.

A1 must define freshness requirements per consumer instead of assuming that all evidence can safely be cached for the same duration.

---

## 11. Browser/debug transport

A0 deliberately did **not** partially extend the legacy CCC-0 `CausalFrameTrace` with an optional field that was never populated live.

A short-lived draft of that approach was removed during final hygiene review.

The qualified transport is instead one explicit stage-local channel:

`LabWorld World-step evidence`

→ opt-in failure-isolated observer

→ `?a0debug=1` bounded browser bridge

→ `companion-brain-lab-authority-a0-incident-v1`

The bridge is inactive without the query flag.

This keeps normal runtime free of an A0 debug subscriber and prevents two competing causal schemas from pretending to be the same source of truth.

---

## 12. Browser stability / existing CCC-0 preservation

The existing CCC-0 Chromium audit still passes on exact A0 runtime #713.

CCC-0 audit evidence:

- final World tick: 558
- all four existing scenarios exercised;
- WHERE and PLAYER FLOW disclosure persistence: PASS
- requestAnimationFrame samples: 637
- p50: ~16.7 ms
- p95: ~33.4 ms
- p99: ~33.5 ms
- max: ~116.7 ms
- stalls >250 ms: 0
- stalls >1000 ms: 0
- page errors: 0
- console errors: 0
- request failures: 0

Authority-A0 opt-in audit:

- timing samples: 194
- max frame: 116.6 ms
- page errors: 0
- console errors: 0
- request failures: 0

These are bounded CI browser observations, not a comprehensive performance benchmark.

---

## 13. Promotion blockers audit

A0 completion blockers from the stage plan are resolved as follows:

| Blocker | Result |
| --- | --- |
| Capability depends on duplicated brain constant | **CLEARED** — actor-spec capability contract |
| Same-step Owner input cannot be separated from body motion | **CLEARED** |
| Forced zero-input player motion becomes Owner-directed | **CLEARED** — live browser gives `EXTERNAL_MOTION_EVIDENT` |
| Non-3 actor capability cannot be represented consistently | **CLEARED** — synthetic 5 u/s proof |
| Hard connectivity only discoverable by ad-hoc manual clearance-zero reasoning | **CLEARED** — explicit `HardRouteTruthEvidence` |
| Zero-command external displacement becomes self-action-supported | **CLEARED** |
| Velocity representation materially changes current commands | **CLEARED for A0 boundary** — adapter remains shadow; no adoption performed |
| Existing SPATIAL behavior changes before A1 | **CLEARED** — exact differential suite |
| Browser control/body provenance remains stale/ambiguous in the old way | **CLEARED** — explicit t/body-before/t+1 phases |
| New evidence is an opaque blob with missing raw facts | **CLEARED** — raw channels and reasons retained |

No material A0 blocker remains open.

---

## 14. Remaining limitations / non-claims

A0 deliberately does **not** prove or implement:

- a final useful-region representation;
- final relationship positioning;
- authoritative PACE or catch-up;
- final cooperation/right-of-way behavior;
- final route-side continuity;
- a future NATURAL replacement;
- final player physical-agency guard composition;
- attribution-aware recovery policy;
- command UI;
- combat;
- multi-companion coordination;
- improved companion feel or intelligence.

Additional boundaries:

- `VelocityCommand` is qualified as a world-unit contract but existing World submission still uses the existing MotionIntent path.
- `HardRouteTruthEvidence` is evidence only; legacy/default route authority remains unchanged.
- `OutcomeAttributionEvidence` is evidence only; legacy progress/recovery authority remains unchanged.
- the A0 browser bridge is opt-in research instrumentation, not a production-facing API.
- public Pages was not repinned for A0.
- no Owner feel gate was required because A0 intentionally changes no behavior.

---

## 15. Architectural consequences for A1

A1 must not return to the old implementation order of:

`WHERE/PACE authority first → cooperation later → final/temporal semantics later`.

A0 now gives the next experiment better factual seams:

1. **Owner control and body motion are separate inputs.**
2. **Capability is authoritative and expressed in world units.**
3. **Hard reachability and comfort quality are separate facts.**
4. **A submitted action and its physical outcome are separate phases.**
5. **Outcome improvement can be externally caused.**
6. **Every promoted consumer must state its freshness budget.**

The first authority experiment should therefore be designed as a small **joint coordination loop**, not as wholesale promotion of CCC-0 shadow output.

It should combine, at minimum:

- region-first WHERE evidence;
- explicit PACE/capability reasoning;
- minimal asymmetric player cooperation from the start;
- a world-unit admissible local velocity representation;
- temporal realization;
- a rare final physical-agency authority boundary;
- post-World outcome attribution.

Exactly how those responsibilities divide is an A1 planning question, not an A0 conclusion.

---

## 16. Final A0 truth

**Authority-A0 = PASS.**

The project now has a materially better factual substrate for granting new companion authority without confusing:

- intention with solver motion;
- normalized input with physical capability;
- comfort with hard feasibility;
- movement with self-caused progress;
- cached evidence with current truth.

No new coordination authority was promoted.

The next valid action is a **fresh Authority-A1 stage plan from this evidence**, followed by falsification of that plan before any A1 runtime implementation.
