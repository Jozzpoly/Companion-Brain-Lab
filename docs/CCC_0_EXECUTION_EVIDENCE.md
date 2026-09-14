# CCC-0 Shadow Coordination — Execution Evidence

Status: **MECHANICAL SHADOW CHECKPOINT PASS · BROWSER DELIVERY PASS · OWNER OBSERVATION GATE OPEN · ZERO MOVEMENT AUTHORITY**

Date: 2026-09-14

Base checkpoint:

`5e809fc61433b3eceefde088243ad736da0e5b1b`

Exact qualified CCC-0 application runtime:

`bfe30df9298c1aa36dd4db43de70a049804255bc`

Primary exact-head validation:

- workflow `validate`;
- run `34893657450`;
- **39/39 test files PASS**;
- **189/189 tests PASS**;
- strict TypeScript PASS;
- production Vite build PASS;
- npm install audit: 0 vulnerabilities.

Pinned browser delivery:

- Pages authority commit on `main`: `1829804cfa7969775714810c42a0638ac6abbe2f`;
- composite Pages run `34893943934`: build PASS + deploy PASS;
- Foundation root pinned to `b217943e027e66993f0010643b2933b01d4b1e6d`;
- `/ccc0/` pinned to `bfe30df9298c1aa36dd4db43de70a049804255bc`;
- deployed environment: `https://jozzpoly.github.io/Companion-Brain-Lab/`;
- CCC-0 Owner preview: `https://jozzpoly.github.io/Companion-Brain-Lab/ccc0/`.

The uploaded Pages artifact was independently inspected. It contains separate root and `/ccc0/` builds with separate asset bundles; CCC-0 markers occur only in the `/ccc0/` bundle. The Foundation root therefore remains preserved rather than being silently replaced by research instrumentation.

Owner protocol:

`docs/CCC_0_BROWSER_GATE_CHECKLIST.md`

This document does **not** claim that current WHERE/PACE/PLAYER FLOW behavior is ready for movement authority. It records that the shadow research substrate is mechanically coherent enough for Owner falsification.

---

## 1. Stage question and current answer

CCC-0 asked:

> Before changing companion movement, can the current runtime produce bounded, causal, inspectable evidence for WHERE, PACE and PLAYER FLOW beside the legacy decision, while proving that the new research substrate has zero movement authority?

Mechanical answer:

**PASS at the current bounded scope.**

Owner/browser semantic answer:

**OPEN.** The current question is whether the evidence is understandable, stable enough to criticize and cheap enough to observe live.

Movement-authority answer:

**ZERO by design.** CCC-0 cannot change authoritative companion `MotionIntent`.

---

## 2. Current responsibility decomposition

The decomposition remains provisional research vocabulary, not frozen architecture.

### WHERE — shadow relationship region

Current bounded field:

- 32 directions × 3 radii = 96 player-relative samples;
- hard body validity separate from comfort quality;
- local scoring before route work;
- at most 12 route-qualified shortlist candidates;
- current static router/query contracts, not copied S5 geometry;
- route-aware coherent near-best component containing the best reachable sample;
- weighted representative only inside that coherent component;
- representative hard/route revalidation;
- explicit `NO_HARD_VALID_SAMPLE` vs `ROUTE_SHORTLIST_EXHAUSTED` uncertainty;
- no player-center fallback.

The representative anchor is an adapter/debug artifact. The coherent region remains the research object.

### PACE — temporal relationship pressure

Current evidence exposes:

- companion physical speed capability;
- player and companion observed speed;
- distance to the useful region;
- route distance where available;
- relative opening/closing motion;
- duration outside the useful region;
- continuous urgency;
- provisional desired speed;
- diagnostic labels such as `SETTLED`, `FOLLOWING`, `CATCH_UP`, `RECOVERING`.

Duration is measured in **World ticks**, not number of CCC cognition evaluations.

### PLAYER FLOW — short-horizon player-space evidence

Current corridor/evidence exposes:

- actual player velocity when meaningful, otherwise requested velocity;
- no fabricated heading when no motion evidence exists;
- bounded short prediction horizon;
- separate physical and comfort widths;
- confidence/persistence evidence;
- reversal uncertainty;
- distinct conflict channels for legacy preferred velocity and final authoritative velocity.

The distinction between preferred and authoritative conflict is deliberate: it can expose temporal/downstream transformation of an upstream-safe motion without installing any repair.

---

## 3. Multi-rate cognition and causal provenance

Early CCC-0 evaluation ran the expensive shadow frame every physics tick. Instrumentation then made the hidden cost explicit: one 12-candidate WHERE shortlist can expand into many static traversal calls because route graphs themselves perform multiple traversal queries.

Current runtime therefore evaluates the expensive CCC-0 shadow frame every:

`CCC0_SHADOW_INTERVAL_TICKS = 6`

At the current 60 Hz World cadence this is approximately 10 Hz.

This cadence is **not a frozen brain frequency**. It is a measured current response to the cost of the present WHERE implementation.

### Causal safeguards

A cached shadow frame retains the tick at which it was actually evaluated.

Causal trace records:

- `shadowTick` — the World observation tick used to compute the shadow frame;
- `ageTicks` — current observation tick minus `shadowTick`.

Therefore cached evidence never masquerades as same-tick evidence.

PACE temporal history also stores the previous evaluation tick and advances outside-region duration by the actual elapsed World-tick difference. A six-tick cognition interval therefore contributes six ticks of duration, not one pseudo-step.

Automated tests bind this behavior.

---

## 4. Measured WHERE cost instead of fake boundedness

CCC-0 originally exposed only the number of route candidates. That was insufficient evidence of computational cost because each route qualification may issue many static traversal queries.

Current WHERE evidence reports both:

- `routeEvaluatedCount`;
- `staticTraversalQueryCount`.

The scenario campaign independently wraps the traversal query and verifies that the internal reported count exactly matches externally observed calls.

Current bounded characterization:

- open geometry: more than the shortlist count but <= 40 static traversal calls in the fixture;
- pillar geometry: >100 and <=500;
- doorway geometry: >100 and <=500.

These are characterization bounds for the current implementation, **not performance targets** and not architectural constants.

The high topology-dependent cost is precisely why browser cadence/performance observation is part of the Owner gate.

---

## 5. Region temporal/topological continuity evidence

CCC-0 now exposes continuity without installing a hidden behavior FSM:

- previous/current region presence;
- previous/current topology key;
- explicit topology-key change;
- coherent-sample overlap ratio;
- representative-anchor displacement.

A deterministic test verifies that a small heading change retains overlapping coherent evidence and bounded anchor displacement rather than appearing as a region teleport.

This evidence is diagnostic only. It does not smooth or constrain authoritative movement.

---

## 6. Zero-authority evidence

CCC-0 remains integrated **after** authoritative DIRECT/NATURAL movement selects `MotionIntent`.

The order is intentional:

`authoritative movement decision -> capture immutable command evidence -> optional slower CCC-0 shadow evaluation -> return the original command`

Shadow evaluation is fault-contained. A shadow exception becomes research/debug evidence and cannot replace or recompute the already selected command.

### One-step equivalence

For DIRECT and NATURAL independently, workbench command equals the corresponding pre-shadow authoritative brain command exactly.

### Parallel-World equivalence

For DIRECT and NATURAL independently, two deterministic Worlds are driven for 120 steps with the same scripted moving player:

- one by the pre-shadow authoritative brain;
- one by the CCC-0-enabled workbench.

Every step requires:

- exact companion command equality;
- exact World snapshot equality;
- exact progress/recovery decision equality.

### Fault isolation

A synthetic shadow evaluator that throws immediately is injected for both actuators.

The authoritative command remains equal to baseline while the error appears only as `shadowCoordinationError`.

Mechanical conclusion:

> **No semantic movement authority has leaked into CCC-0.**

Remaining Owner question:

> semantic zero-authority does not prove zero browser-time cost; visible hitching must be observed separately.

---

## 7. Falsifier coverage currently preserved

Automated coverage includes, among other cases:

- identical input/history/query evidence -> deterministic shadow frame;
- finite sample/evidence values;
- 96-sample field bound;
- 12-candidate route-shortlist bound;
- true static traversal-cost instrumentation;
- explicit no-region uncertainty;
- disconnected near-best regions not globally averaged;
- historical S5 centroid-collapse class prevented;
- representative hard/route revalidation;
- stationary player does not inherit arbitrary +X heading;
- previous meaningful heading may persist through a temporary stop;
- stationary corridor does not fabricate flow;
- abrupt reversal reduces corridor confidence/horizon;
- repeated player-flow cases remain finite and explicit;
- same-distance moving-away vs stationary PACE differs;
- moving-toward/reversal reduces catch-up urgency relative to moving away;
- desired speed stays within physical capability;
- small heading change retains region overlap rather than teleporting;
- outside-region duration advances by real World ticks across 6-tick cognition gaps;
- preferred and authoritative player-flow conflict can disagree and remain separately visible.

Real World geometry campaign remains:

- open;
- pillar;
- doorway;
- head-on;
- deliberately shifted player-relative field against the pillar.

---

## 8. Workbench and incident evidence

CCC-0 extends the existing Foundation/R1 workbench rather than creating a second diagnostic runtime.

### Coordination overlay

Default OFF to avoid overwhelming the playfield.

It can visualize:

- all bounded WHERE samples;
- hard-invalid samples;
- route-evaluated reachable/unreachable samples;
- coherent region membership;
- representative anchor;
- legacy target -> shadow-anchor disagreement;
- player-flow line;
- physical and comfort corridor envelopes.

### Panel

Collapsed sections:

- `CCC-0 shadow · WHERE`;
- `CCC-0 shadow · PACE`;
- `CCC-0 shadow · PLAYER FLOW`.

WHERE now includes:

- route candidates;
- actual static traversal count;
- topology-change evidence;
- coherent overlap;
- representative-anchor displacement.

PLAYER FLOW exposes preferred-vs-authoritative conflict separately.

### Causal incident schema

Current incident schema:

`companion-brain-lab-ccc0-causal-incident-v4`

Shadow evidence is explicitly typed `CCC0_SHADOW_COORDINATION` inside decision evidence and carries `shadowTick` + `ageTicks`.

Recorded shadow vectors are defensively cloned.

---

## 9. Material findings discovered during CCC-0

### Finding A — stationary player cannot inherit a fake world-axis heading

Initial fallback to +X would have turned missing motion evidence into fake semantic front/back information.

Corrected to:

- no evidence -> source `none`;
- direction `{0,0}`;
- front/back penalty disabled;
- previous meaningful heading may persist through a temporary stop.

### Finding B — shortlist exhaustion is not global unreachable truth

Only the bounded shortlist is route-qualified. Current evidence explicitly distinguishes:

- no hard-valid sample in the field;
- bounded shortlist exhausted without a reachable result.

Untested samples are not claimed unreachable.

### Finding C — route candidate count hid real WHERE cost

A 12-candidate shortlist can generate >100 traversal queries in obstacle-rich geometry because each route plan evaluates a graph. Current evidence exposes actual traversal count and CCC-0 moved to a slower 6-tick cognition cadence rather than pretending the original per-tick cost was negligible.

### Finding D — player-flow conflict has two causal boundaries

The legacy preferred local velocity and final authoritative command can have different player-flow conflict classifications. Combining them into one signal would hide whether conflict originates upstream or appears during later movement realization.

Current shadow frame therefore keeps both channels.

---

## 10. Current non-claims

CCC-0 does **not** prove:

- current scoring weights produce the best companion relationship;
- 32 × 3 samples are optimal;
- 12 route candidates are optimal;
- 6 ticks / ~10 Hz is the right long-term cognition cadence;
- current router is the right long-term WHERE substrate;
- representative anchor is the eventual movement target interface;
- WHERE/PACE/PLAYER FLOW is the final architecture decomposition;
- current player corridor is a final predictor;
- shadow evidence should receive authority unchanged;
- multi-companion coordination is solved;
- command/combat behavior is in scope for CCC-0.

All current constants remain throwaway-ready.

---

## 11. Promotion boundary

### Mechanically

**PASS for the CCC-0 shadow checkpoint.**

The current exact runtime is deterministic/bounded within its tested scope, topology-aware, causally provenance-aware, fault-contained and mechanically zero-authority while preserving the Foundation suite.

### Delivery

**PASS.**

The exact CCC-0 runtime is available under `/ccc0/` while the historical Foundation root remains independently pinned and unchanged.

### Owner/browser

**OPEN.**

The Owner gate must now evaluate:

- semantic legibility of WHERE/PACE/PLAYER FLOW;
- region stability vs justified topology changes;
- corridor confidence under stops/reversals/jitter;
- usefulness of preferred-vs-authoritative conflict disagreements;
- clarity of cached `ageTicks` provenance;
- visible runtime cost / periodic ~10 Hz hitching;
- whether incidents make bad shadow decisions explainable.

Protocol:

`docs/CCC_0_BROWSER_GATE_CHECKLIST.md`

### Movement authority

**NOT AUTHORIZED.**

A CCC-0 Owner PASS would qualify the research apparatus, not the current coordination policy for movement.

After Owner evidence, CCC-1 must be replanned from observed failures/disagreements. A material Owner FAIL keeps the work in CCC-0 and may justify deleting or replacing substantial parts of this implementation.