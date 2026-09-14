# CCC-0 Shadow Coordination — Execution Evidence

Status: **MECHANICAL SHADOW CHECKPOINT PASS · BROWSER DELIVERY PASS · OWNER OBSERVATION GATE OPEN · ZERO MOVEMENT-OUTPUT AUTHORITY**

Date: 2026-09-14

Base checkpoint:

`5e809fc61433b3eceefde088243ad736da0e5b1b`

Exact qualified CCC-0 application runtime:

`a2a0e793f01a6fe3b435e473cb9912347f2fcb0d`

Primary exact-runtime validation:

- workflow `validate`;
- run `34894184145` (`#551`);
- **39/39 test files PASS**;
- **191/191 tests PASS**;
- strict TypeScript PASS;
- production Vite build PASS;
- npm install audit: **0 vulnerabilities**;
- Foundation NATURAL 180-step survival PASS;
- Foundation DIRECT 180-step survival PASS.

Pinned browser delivery:

- Pages authority commit on `main`: `5054ffabbe72bc6dedb46196b00da2a32c9b7c29`;
- composite Pages run `34894499080`: build PASS + deploy PASS;
- `main` validation run `34894499229`: PASS;
- Foundation root pinned to `b217943e027e66993f0010643b2933b01d4b1e6d`;
- `/ccc0/` pinned to `a2a0e793f01a6fe3b435e473cb9912347f2fcb0d`;
- Foundation root: `https://jozzpoly.github.io/Companion-Brain-Lab/`;
- CCC-0 Owner preview: `https://jozzpoly.github.io/Companion-Brain-Lab/ccc0/`.

The current uploaded Pages artifact (`github-pages`, artifact `10368360480`, digest `sha256:df14912e288add10751cc8270f9746c8da802dd1fd42e72e048405961288631c`) was independently inspected after build. It contains separate root and `/ccc0/` applications:

- root `index.html` references `./assets/index--Hpz3nOi.js`;
- `/ccc0/index.html` references `./assets/index-Dxal7vJP.js`;
- the root bundle contains no CCC-0 markers;
- the `/ccc0/` bundle contains `CCC-0 shadow`, `CCC0_SHADOW_COORDINATION` and `Coordination` markers.

`vite.config.ts` uses `base: "./"`, so the `/ccc0/` HTML resolves its own relative asset bundle rather than silently loading the Foundation root bundle.

Owner protocol:

`docs/CCC_0_BROWSER_GATE_CHECKLIST.md`

This document does **not** claim current WHERE/PACE/PLAYER FLOW behavior is ready for authority. It qualifies the shadow research apparatus mechanically and its browser delivery path. Visual/semantic usefulness and browser-time cost remain Owner evidence.

---

## 1. Stage question and current answer

CCC-0 asked:

> Before changing companion movement, can the trusted Foundation runtime produce bounded, causal and inspectable evidence for WHERE, PACE and PLAYER FLOW beside legacy authority, while proving that the research substrate does not change authoritative movement output?

Mechanical answer:

**PASS at the current bounded scope.**

Browser-delivery answer:

**PASS.** The exact qualified runtime is separately pinned under `/ccc0/` without replacing the Foundation root.

Owner/browser semantic answer:

**OPEN.** The question is now whether this evidence is understandable, truthful enough to criticize and cheap enough to observe live.

Movement-output authority answer:

**ZERO by design and mechanically defended.**

Timing non-interference answer:

**UNPROVEN.** The authoritative command value is selected before shadow evaluation, but CCC-0 still runs synchronously on cognition ticks and may add wall-clock latency before that already-selected command returns to the caller.

---

## 2. Current responsibility decomposition

The decomposition remains provisional research vocabulary, not frozen architecture.

### WHERE — shadow relationship region

Current bounded field:

- 32 directions × 3 radii = 96 player-relative samples;
- hard body validity separate from comfort quality;
- local scoring before route work;
- at most 12 route-qualified shortlist targets;
- current static router/query contracts rather than copied historical S5 execution code;
- route-aware coherent near-best component containing the best reachable sample;
- weighted representative restricted to that coherent component;
- representative hard/route revalidation;
- explicit `NO_HARD_VALID_SAMPLE` vs `ROUTE_SHORTLIST_EXHAUSTED` uncertainty;
- no player-center fallback.

The representative anchor is an adapter/debug artifact. The coherent region is the research object.

### PACE — temporal relationship pressure

Current evidence exposes:

- companion physical speed capability;
- player and companion observed speed;
- distance to useful region;
- best route distance where meaningful;
- relative opening/closing motion;
- duration outside useful region;
- continuous urgency;
- provisional desired speed;
- diagnostic labels `SETTLED`, `FOLLOWING`, `CATCH_UP`, `RECOVERING`.

Labels are explanation only, **not a behavior FSM contract**.

### PLAYER FLOW — short-horizon player-space evidence

Current corridor/evidence exposes:

- meaningful actual player velocity first, otherwise requested velocity;
- no fabricated heading when no motion evidence exists;
- bounded short prediction horizon;
- distinct physical and comfort envelopes;
- confidence/persistence evidence;
- reversal uncertainty;
- separate conflict channels for legacy preferred velocity and final authoritative velocity.

The preferred/final split is deliberate: it can expose a later temporal/downstream transformation of an upstream-safe motion without installing a repair.

---

## 3. Multi-rate cognition and causal provenance

Initial CCC-0 work evaluated the expensive shadow frame every physics tick. Cost instrumentation falsified the assumption that a 12-candidate WHERE shortlist is cheap: each route plan can itself execute many static traversal queries while evaluating route graph edges.

Current runtime therefore evaluates the whole CCC-0 shadow frame every:

`CCC0_SHADOW_INTERVAL_TICKS = 6`

At the current 60 Hz World step this is approximately 10 Hz.

This cadence is **provisional and throwaway-ready**. It is a measured response to the current WHERE implementation, not a permanent brain frequency.

The whole shadow frame currently shares one cognition observation so WHERE/PACE/PLAYER FLOW remain coherent. Cheap PLAYER FLOW could later run faster, but CCC-0 deliberately avoids premature multi-rate fragmentation until Owner evidence justifies it.

### World-time semantics

PACE duration uses elapsed **World ticks**, not number of cognition calls. A six-tick cognition gap therefore advances separation duration by six world ticks, not one pseudo-step.

### Cached successful evidence

Each causal shadow block records:

- `shadowTick` — World observation tick used to compute the shadow frame;
- `ageTicks` — current observation tick minus `shadowTick`.

Cached evidence therefore cannot masquerade as same-tick evidence.

### Shadow failures are tick-local events

A later review found a provenance bug: a failed shadow evaluation could have remained cached as an error and been serialized on an intervening motor tick as though the failure were fresh.

Current contract fixes this by treating evaluator failure as **event evidence from the cognition tick that produced it**:

- failure is visible on its originating cognition tick;
- causal trace preserves that failure frame;
- the next non-cognition motor tick clears the debug error;
- no old failure is relabelled as fresh same-tick evidence.

DIRECT and NATURAL fault-isolation tests bind this behavior.

---

## 4. Measured WHERE cost instead of fake boundedness

WHERE reports both:

- `routeEvaluatedCount` — shortlisted route targets evaluated;
- `staticTraversalQueryCount` — actual static traversal queries used by the full WHERE evaluation, including route graph work and representative revalidation.

Scenario tests independently wrap the traversal query and require internal reported cost to equal externally observed calls **1:1**.

Current characterization:

- open fixture: > shortlist count and <= 40 static traversal calls;
- pillar fixture: >100 and <=500;
- doorway fixture: >100 and <=500.

These are characterization bounds, not performance targets.

This hidden topology-dependent cost is the reason CCC-0 moved to a slower 6-world-tick cognition cadence and why runtime hitching remains a first-class Owner question.

---

## 5. Region continuity evidence

CCC-0 exposes temporal/topological continuity without installing a region FSM:

- previous/current region presence;
- previous/current topology key;
- explicit topology-key change;
- coherent-sample Jaccard overlap ratio;
- representative-anchor displacement.

A deterministic small-heading falsifier requires meaningful overlap and bounded anchor displacement rather than a region teleport. It currently passes, so no extra hysteresis has been added merely to make the output look smooth.

---

## 6. Zero movement-output authority evidence

CCC-0 remains integrated **after** authoritative DIRECT/NATURAL movement selects `MotionIntent`.

The order is:

`authoritative movement decision -> capture already-selected command evidence -> optional CCC-0 evaluation -> return original command`

Shadow evaluation cannot replace or recompute the already-selected command. A shadow exception is fault-contained.

### One-step equivalence

For DIRECT and NATURAL independently, the workbench command equals the corresponding pre-shadow authoritative brain command exactly.

### Parallel-World equivalence

For DIRECT and NATURAL independently, two deterministic Worlds run for 120 steps with the same scripted moving player:

- one uses the pre-shadow authoritative brain;
- one uses the CCC-0-enabled workbench.

Every step requires:

- exact companion command equality;
- exact World snapshot equality;
- exact progress/recovery decision equality;
- correct 6-world-tick CCC cognition cadence.

### Fault isolation

Synthetic shadow evaluators throw for DIRECT and NATURAL.

Tests require:

- authoritative command remains equal to baseline;
- shadow frame becomes null;
- originating cognition tick exposes the error;
- intervening motor tick does not cache that error as fresh evidence.

### Final-command velocity is bound to World truth

CCC-0 player-flow conflict needs final command velocity in the same scale World actually applies.

Current lab actors and S3 workbench use speed `3`, but this is defended by contract rather than assumption: dedicated DIRECT and NATURAL tests execute the command through `LabWorld` and require the CCC captured authoritative velocity to equal World’s post-step `requestedVelocity` exactly.

If those scales drift in a future refactor, the evidence test must fail rather than silently lie.

Mechanical conclusion:

> **No semantic movement-output authority has leaked into CCC-0 within the tested workbench contract.**

Important non-claim:

> Synchronous shadow work can still affect wall-clock frame time even when command values and World trajectories remain identical.

---

## 7. Falsifier coverage currently preserved

Automated coverage includes, among other cases:

- identical input/history/query evidence -> deterministic output;
- finite evidence;
- 96-sample field bound;
- 12-target route-shortlist bound;
- exact traversal-cost instrumentation;
- explicit no-region uncertainty;
- disconnected near-best regions not globally averaged;
- historical S5 centroid-collapse class prevented;
- representative hard/route revalidation;
- stationary player does not inherit arbitrary +X heading;
- previous meaningful heading may persist through a temporary stop;
- stationary corridor does not fabricate flow;
- abrupt reversal reduces corridor confidence/horizon;
- repeated reversal / low-speed jitter remain explicit and bounded;
- same-distance moving-away vs stationary PACE differs;
- moving-toward/reversal lowers urgency relative to moving away;
- closing on useful region lowers pressure before overshoot;
- desired speed stays within physical capability;
- small heading change retains coherent overlap instead of teleporting;
- outside-region duration advances by real World ticks across 6-tick cognition gaps;
- preferred and authoritative player-flow conflict can disagree and remain separately visible;
- final-command velocity scale matches actual World requested velocity;
- failed shadow evidence cannot masquerade as a fresh cached failure.

Real World geometry campaign remains:

- open;
- pillar;
- doorway;
- head-on;
- deliberately shifted player-relative field against pillar topology.

---

## 8. Workbench and incident evidence

CCC-0 extends the existing Foundation/R1 workbench rather than creating a second telemetry runtime.

### Coordination overlay

Default OFF.

It can visualize:

- bounded WHERE samples;
- hard-invalid samples;
- route-evaluated reachable/unreachable samples;
- coherent region membership;
- representative anchor;
- legacy target -> shadow-anchor disagreement;
- player-flow line;
- physical and comfort corridor envelopes;
- final-command closest-approach relationship.

### Panel

Collapsed sections:

- `CCC-0 shadow · WHERE`;
- `CCC-0 shadow · PACE`;
- `CCC-0 shadow · PLAYER FLOW`.

WHERE includes:

- route target count;
- real static traversal count;
- topology change;
- coherent overlap;
- representative-anchor displacement;
- cognition tick and cached age.

PLAYER FLOW exposes preferred-vs-authoritative conflict independently.

### Causal incident schema

`companion-brain-lab-ccc0-causal-incident-v4`

Shadow evidence is explicitly typed `CCC0_SHADOW_COORDINATION` inside decision evidence and remains separate from authoritative command and post-World outcome phases.

Recorded nested vectors are defensively cloned.

---

## 9. Material findings produced by CCC-0

1. **Stationary player must not inherit arbitrary +X semantic heading.** Missing direction evidence is not direction.
2. **Bounded shortlist exhaustion is not global unreachable truth.** Evidence now reports exactly what was tested.
3. **Route-target count materially understates WHERE cost.** Obstacle-rich fixtures can exceed 100 traversal queries per evaluation.
4. **Expensive coordination cognition need not share the motor clock.** Current workbench now demonstrates fast authority + slower shadow cognition without trajectory divergence.
5. **Temporal semantics must use World time, not cognition-call count.** Otherwise changing cognition cadence changes meaning.
6. **Cached evidence requires explicit age provenance.** `shadowTick` / `ageTicks` prevent false same-tick causality.
7. **Evaluator failures are events, not persistent pseudo-state.** Old failures are not relabelled as fresh.
8. **Player-flow conflict needs two causal boundaries.** Preferred local motion and final authoritative command can disagree.
9. **Captured final velocity must be bound to World truth.** A dedicated contract now guards the current shared speed scale.
10. **Semantic/output non-interference is not timing non-interference.** Browser frame-time cost remains unproven until Owner observation.

These findings matter more than preserving the current implementation or constants.

---

## 10. Current non-claims / rework freedom

CCC-0 does **not** prove:

- current utility weights produce the best teammate relationship;
- 32 × 3 sampling is optimal;
- current radii are optimal;
- 12 route targets are optimal;
- 6 ticks / ~10 Hz is the right long-term cognition cadence;
- the current static router is the long-term WHERE substrate;
- representative anchor is the eventual movement-target interface;
- WHERE/PACE/PLAYER FLOW is final architecture;
- current corridor is a final player predictor;
- browser timing overhead is negligible;
- current shadow evidence should receive authority unchanged;
- right-of-way/chokepoint negotiation is solved;
- multi-companion coordination is solved;
- command/combat behavior belongs in CCC-0.

All current constants and decomposition choices remain throwaway-ready.

---

## 11. Browser delivery qualification

Pages remains a composite pinned artifact managed by `main`:

- Foundation root stays on exact Owner-qualified Foundation runtime `b217943e...`;
- `/ccc0/` uses exact qualified CCC-0 runtime `a2a0e793...`.

Current Pages authority commit:

`5054ffabbe72bc6dedb46196b00da2a32c9b7c29`

Deployment run:

`34894499080` — build PASS + deploy PASS.

The composite artifact independently verifies that root and `/ccc0/` use distinct relative asset bundles. This protects the historical Foundation preview while opening a separate Owner observation surface.

This is a **delivery PASS**, not an Owner observation PASS.

---

## 12. Promotion boundary

### Mechanical substrate

**PASS.**

### Browser delivery

**PASS.**

### Owner/browser semantic + performance observation

**OPEN.**

Owner gate should challenge:

- semantic legibility of WHERE/PACE/PLAYER FLOW;
- region stability vs justified topology changes;
- corridor confidence under stop/reversal/jitter;
- preferred-vs-authoritative conflict usefulness;
- cached `ageTicks` clarity;
- visible runtime cost / periodic ~10 Hz hitching;
- whether incidents make bad shadow decisions explainable.

Protocol:

`docs/CCC_0_BROWSER_GATE_CHECKLIST.md`

### Movement authority

**NOT AUTHORIZED.**

A clean Owner PASS would qualify the research apparatus for the next design stage, not bless the current policy for movement.

After Owner evidence, CCC-1 must be replanned from observed failures/disagreements. A material Owner FAIL keeps the work in CCC-0 and may justify deleting or replacing substantial parts of this implementation rather than tuning weights around a bad representation.
