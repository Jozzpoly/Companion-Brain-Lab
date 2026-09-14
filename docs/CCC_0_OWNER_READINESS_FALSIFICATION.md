# CCC-0 Owner-readiness falsification campaign

Status: **AUTOMATED FALSIFICATION COMPLETE · REPAIRED AUDIT CHECKPOINT PASS · OWNER GATE STILL OPEN · ZERO MOVEMENT-OUTPUT AUTHORITY**

Date: 2026-09-14

Audit branch: `audit/ccc0-owner-readiness-falsification`

Exact repaired audit checkpoint:

`cfd37ecf26a22467af5d2d7eb63e7a96609a8e75`

Exact validation run:

`34903889302` (`validate` #623)

Qualified at that checkpoint:

- **58/58 test files PASS**;
- **228/228 tests PASS**;
- strict TypeScript PASS;
- production Vite build PASS;
- npm install audit: **0 vulnerabilities**;
- real headless Chromium audit PASS;
- Foundation regressions remain green;
- 2,880-step zero-authority differential torture remains byte-identical;
- 3,120 randomized direct-route/full-router equivalence cases PASS.

This document records the falsification campaign. It does **not** promote CCC-0 to movement authority and does **not** replace Owner judgement.

---

## 1. What this campaign challenged

The pre-audit CCC-0 checkpoint had already established a bounded shadow apparatus for WHERE / PACE / PLAYER FLOW with zero movement-output authority. The campaign deliberately tried to falsify its readiness for Owner observation rather than protect the implementation.

Primary targets were:

- symmetry and metamorphic consistency;
- threshold discontinuities;
- stale temporal evidence;
- cognition-cadence sensitivity;
- hidden routing cost;
- bounded-shortlist truthfulness;
- zero-authority preservation under long adversarial runs;
- real browser boot, interaction and timing;
- workbench observability under live rendering.

Exploratory probes were allowed to fail. Repairs were retained only when evidence justified their complexity.

---

## 2. Material findings and retained repairs

### 2.1 Direct WHERE routing had hidden global-graph cost

A 12-target shortlist did not bound real static traversal work because each shortlisted target could invoke the full static visibility router and repeatedly rebuild/evaluate graph connectivity.

Retained repair:

- directly traversable sample targets use the existing hard static traversal query first;
- full router remains the fallback when direct traversal is blocked;
- no route semantics are approximated when the fast path cannot prove direct reachability.

Evidence:

- randomized equivalence against the full router: **1,040 open + 1,040 pillar + 1,040 doorway = 3,120 PASS**;
- direct-query scaling stays at **26 static traversal queries** with 0, 1, 2, 4, 8 and 12 distant irrelevant obstacles;
- real Rapier fixture remains bounded at 26 queries; observed audit timings were roughly 1–2 ms after cold-start noise.

Conclusion: retained. This is a measured cost repair, not a change of coordination policy.

### 2.2 Binary low-speed heading influence was semantically discontinuous

Dense stateless speed sweeps exposed large changes around the old low-speed threshold. Stateless probes overstated real sequential severity, but the binary semantic boundary itself was unjustified.

Retained repair:

- heading influence is continuous rather than on/off;
- near-equal score ordering uses an explicit epsilon and stable sample-id tie-break.

Sequential evidence with real history:

- 0.001 m/s ramp maximum anchor step: **0.2113809669 m**;
- alternating ±0.001 m/s jitter around 0.20 m/s maximum anchor step: **0.1054184395 m**;
- fine perturbation produces proportionally tiny semantic displacement rather than a threshold teleport.

Conclusion: retained.

### 2.3 Velocity-derived heading memory could become stale

A previous meaningful player trajectory was useful during a short stop/reversal, but keeping it indefinitely made old motion masquerade as current semantic evidence.

Retained repair:

- previous velocity direction is explicitly aged;
- its influence fades smoothly over the same bounded memory window;
- it expires to no previous velocity direction after a prolonged stop;
- age/strength is available consistently to WHERE and PLAYER FLOW.

Regression evidence:

- short stop preserves a real reversal cue (`REVERSAL_UNCERTAIN`);
- prolonged stop removes previous direction instead of retaining stale east/west meaning.

Conclusion: retained.

### 2.4 The first `<0.5 m per cognition observation` continuity oracle was too strong

The campaign initially promoted a stop-memory transition into a RED contract requiring every 6-tick shadow-anchor update to stay under 0.5 m. Further evidence falsified that oracle.

Current 6-tick stop/fade characterization:

- maximum shadow-anchor step: **0.8151463205 m**;
- transition is distributed across multiple observations rather than one hard expiry teleport.

Cadence localization shows the observed step is materially sampling-sensitive:

- cadence 1: ~0.446 m max;
- cadence 2: ~0.623 m;
- cadence 3: ~0.685 m;
- cadence 6: ~0.815 m;
- cadence 12: ~1.008 m.

Legacy S1 target comparison on the same `east → stop → west` sequence:

- CCC-0 shadow maximum single step: **0.815 m**;
- legacy target maximum single step: **2.051 m**.

Conclusion: the 0.815 m transition remains a known Owner-visible limitation, but `<0.5 m` is **not** a valid blocker contract. The audit did not tune the implementation merely to satisfy a falsified oracle.

### 2.5 Previous-region candidate carry-over did not earn its complexity

A bounded carry-over experiment modestly reduced one transition (~0.815 → ~0.761 m) while increasing temporal coupling and route work.

Conclusion: **rejected and removed**. No carry-over heuristic remains in the repaired candidate.

### 2.6 Soft representative / score-window alternatives did not explain the transition

Alternative representative constructions reduced or shifted some steps but did not remove the underlying temporal migration. The evidence did not justify another layer of representative hysteresis.

Conclusion: **rejected**. Current coherent-region representation remains intentionally simple and throwaway-ready.

---

## 3. Zero-authority falsification

The audit substantially strengthened the existing zero-authority claim without granting any new authority.

Differential torture covers eight scenario/actuator combinations over 360 World steps each:

- open DIRECT;
- open NATURAL;
- pillar DIRECT;
- pillar NATURAL;
- doorway DIRECT;
- doorway NATURAL;
- head-on DIRECT;
- head-on NATURAL.

Total: **2,880 adversarial World steps**.

Every run requires authoritative command / World outcome equivalence with the pre-shadow control path.

Result: **PASS**.

Mechanical conclusion remains:

> CCC-0 has no semantic movement-output authority within the tested workbench contract.

---

## 4. Real-browser audit found a real workbench bug

The first Chromium harness failures were initially harness-oracle problems, but the campaign then exposed a genuine Owner-readiness defect in the causal panel.

### Failure

`CausalPanel.update()` rebuilt every dynamic `<details>` section every frame with `replaceChildren()`.

Consequences:

1. a user-opened CCC section was immediately recreated as collapsed on the next render;
2. after preserving the `open` boolean, the node was still replaced every frame, so a normal browser click could not acquire a stable target — Playwright repeatedly resolved `CCC-0 shadow · WHERE`, then saw the element detach before interaction.

This was not a CCC policy failure. It was a real observability/workbench architecture failure that would materially obstruct Owner inspection.

### Retained repair

The panel now uses keyed, in-place reconciliation by `section.id`:

- `<section>`, `<details>` and `<summary>` node identity remains stable across live frames;
- only live content is updated;
- explicit disclosure state survives updates;
- default-open legacy sections retain their historical defaults;
- CCC sections remain collapsed initially but stay open once the user opens them.

A deterministic disclosure-state regression and the real Chromium interaction gate both defend this behavior.

---

## 5. Final real Chromium qualification

Exact browser audit from run `34903889302`:

- Chromium: `153.0.8010.12`;
- initial World tick: 5;
- tick after initial running probe: 27;
- final tick after scenario/input campaign: **633**;
- Coordination overlay enabled through the real checkbox;
- CCC WHERE and PLAYER FLOW sections opened through normal `<summary>` clicks and stayed open across live updates;
- DIRECT/NATURAL switched through real panel controls;
- WASD produced live PLAYER FLOW evidence;
- Open, Pillar, Doorway and Head-on scenario switching succeeded;
- runtime fault sentinel never appeared;
- page errors: **0**;
- console errors: **0**;
- failed requests: **0**.

Scenario evidence:

| Scenario | Observed tick | Shadow anchor |
| --- | ---: | --- |
| Open field | 13 | (4.346, 3.985) |
| Central pillar | 33 | (4.293, 3.683) |
| Narrow doorway | 30 | (5.242, 4.000) |
| Head-on contact | 30 | (5.862, 3.879) |

Headless CI requestAnimationFrame characterization:

- samples: **544**;
- p50: **33.3 ms**;
- p95: **50.0 ms**;
- p99: **50.1 ms**;
- max: **116.6 ms**;
- >50 ms: 16;
- >100 ms: 1;
- >250 ms: **0**;
- >1000 ms: **0**.

Interpretation:

- **automated browser-readiness PASS**: no catastrophic hitch/fault class was observed, and the real workbench is now interactable;
- these numbers are **not a 60-FPS benchmark** and do not prove Owner-machine smoothness;
- Owner performance observation remains required, especially for cadence-correlated hitching and the visible 0.815 m stop/fade transition.

---

## 6. What should survive into the clean CCC-0 line

### Production repairs

- direct static-traversal fast path before full route planning for provably direct samples;
- continuous heading influence;
- finite/smooth velocity-direction memory with age;
- stable near-tie score ordering;
- keyed causal-panel reconciliation / persistent disclosure.

### Durable regressions / gates

Keep evidence that protects the repaired classes:

- long zero-authority differential torture;
- full-router fast-path equivalence;
- direct-query scaling;
- threshold/stale-heading repair regressions;
- sequential ramp/jitter continuity;
- metamorphic invariants;
- causal-panel disclosure regression;
- real Chromium black-box audit.

### Audit-only characterization

Keep the broader exploratory probes on the audit branch as provenance unless a later stage needs them as permanent gates:

- dense continuity sweep;
- cadence sensitivity;
- memory cadence localization;
- memory topology decomposition;
- legacy temporal A/B;
- exhaustive shortlist characterization;
- raw Rapier cost characterization.

Do **not** transplant rejected carry-over or alternative representative heuristics.

---

## 7. Promotion boundary after this campaign

Automated mechanical readiness: **PASS on `cfd37ecf...`**.

Automated real-browser readiness: **PASS on `cfd37ecf...`**.

Owner semantic/performance judgement: **OPEN**.

Movement authority: **NOT AUTHORIZED**.

The next repository operation must be a clean transplant of the retained repairs/regressions onto the current live PR #17 head, followed by exact-SHA requalification. The historical public `/ccc0/` Pages artifact must remain pinned until that clean runtime is qualified and deliberately redeployed.
