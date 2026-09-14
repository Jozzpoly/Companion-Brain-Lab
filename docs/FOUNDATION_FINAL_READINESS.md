# Foundation Final Readiness Verdict

Status: **FOUNDATION PASS · REWORK-READY**

This document closes the pre-rework foundation-hardening campaign. It does **not** claim that the current companion behavior is final, polished, or even close to the intended long-term companion experience. It claims something narrower and more important for the next stage: the currently known substrate-level survival, authority, causal-observability, and recovery blockers have been resolved or bounded well enough that the project can now tolerate an intentionally aggressive redesign.

## Qualified runtime and evidence boundary

Owner-tested public runtime:

`b217943e027e66993f0010643b2933b01d4b1e6d`

Public Pages deployment:

- workflow commit: `67c37d8145cdbcbf4044db0a6736418d8c9c6258`;
- Pages run: `34876484531` — exact checkout / validation / upload / deploy PASS;
- public URL: `https://jozzpoly.github.io/Companion-Brain-Lab/`.

The public runtime passed:

- 31/31 test files;
- 137/137 tests;
- strict TypeScript;
- production build;
- npm audit with 0 vulnerabilities.

The later foundation branch adds a **test-only** DIRECT full-chain survival rehearsal at:

`7c2d25dead58ca26d3bb195bc1b91911c60d32a5`

Validation run `34879978993`:

- 32/32 test files PASS;
- 138/138 tests PASS;
- TypeScript PASS;
- production build PASS;
- npm audit: 0 vulnerabilities.

This later commit does not change the browser runtime behavior; it closes the remaining DIRECT coverage gap mechanically.

## Real Owner browser evidence

### Catastrophic fault containment

The earlier public candidate `81877d7fab6b52d4ea683c870074cf12e0793c43` was used for a deliberate real-browser fault rehearsal.

Observed:

- the expected `FOUNDATION_FAULT_PROBE` reached the independent fault surface;
- the Phaser game loop fail-stopped;
- downloadable `companion-brain-lab-runtime-fault-v1` evidence was produced;
- first-fault evidence remained available.

That rehearsal also exposed a serious research-apparatus UX defect: the probe query parameter survived `Reload workbench`, causing the deliberate fault to re-arm every ~1.5 s. That failure is preserved in `FOUNDATION_OWNER_FAULT_PROBE_EVIDENCE.md`.

The current public runtime `b217943e...` fixes the probe as one-shot by removing only the probe parameter before the deliberate throw and labels the recovery action `Reload normally`. The fix is regression-covered.

Classification:

**fault containment PASS · original probe recovery UX FAIL preserved · repaired current runtime**.

### Ordinary-runtime torture run

The Owner then exercised the ordinary `b217943e...` public runtime for approximately 123 seconds across multiple scenarios and constrained interactions.

Review of the recording found:

- no spontaneous fault surface;
- no unexplained whole-runtime freeze;
- no permanent companion shutdown;
- no sticky `NO_SAFE_VELOCITY` state visible in the run;
- no persistent recovery loop;
- actor motion continued across the full recording except for scenario resets and intentional stops;
- the longest suspicious both-actors-still segment was approximately 1.6 s, but the causal panel explicitly reported `ARRIVED`, direct/clear route state, zero command and zero actual velocity, after which normal movement resumed;
- transient `UNKNOWN` states appeared around resets / active transitions but did not become sticky or terminate progress.

The Owner explicitly reported that they were unable to destroy the current normal runtime during this run.

Primary Owner mode was NATURAL. The remaining DIRECT survival gap was closed by the dedicated 180-step full-chain test described above.

Classification:

**ordinary Owner torture gate PASS**.

## Substrate properties now considered defended

The foundation now has explicit, regression-bound behavior for ordinary constrained-world states:

- `NORMAL`;
- `HARD_EGRESS`;
- `NO_SAFE_VELOCITY`;
- `NO_VALID_RELATIONAL_SLOT`.

Ordinary candidate exhaustion, hard contact/penetration egress, exact boundary contact, desired-clearance violation, route loss, relationship-vocabulary exhaustion, and bounded local recovery no longer depend on uncaught exceptions as normal control flow.

Other defended properties:

- hard physical feasibility is separated from desired/comfort clearance;
- browser traversal callbacks preserve full `StaticTraversalOptions` rather than truncating headless-tested semantics;
- route start edges are egress-aware while target/corner nodes remain ordinarily constrained;
- NATURAL hard-egress bypasses continuity when necessary to restore physical legality;
- final hard-command safety exists after temporal realization;
- progress/recovery runs post-World and distinguishes intentional hold, movement, blocking, route-invalid/unreachable, and bounded retry;
- relationship-slot exhaustion cannot masquerade as `ARRIVED`;
- causal trace separates pre-step decision from post-step outcome;
- retry counters have self-describing scopes;
- catastrophic programmer/runtime faults fail-stop through an independent sentinel instead of silently freezing a stale `RUNNING` screen;
- current browser authority is explicitly mapped, while historical S0-S5/R1 strata remain donor/regression evidence rather than implicit authority.

## What this PASS does not claim

This PASS is deliberately **not** a movement-quality or final-companion pass.

The following remain material product limitations and are intentionally promoted into the next aggressive redesign rather than polished inside the foundation campaign:

### 1. Legacy relationship objective

The current eight-slot relationship model is visibly too crude. It can feel arbitrary and can choose positions that interfere with player flow. The next system should reason about useful player-relative **regions / fields**, not a single fixed-radius discrete slot vocabulary.

Older S5 continuous-field research is donor evidence only. Its useful finding — including the topological repair for centroid collapse — should be transplanted selectively onto the new foundation rather than merged wholesale from its old substrate.

### 2. Pace / urgency / catch-up

Player and companion currently share the same experiment speed ceiling. A companion that falls behind cannot meaningfully catch up during sustained player motion. The next architecture needs explicit pace/urgency or desired-speed authority rather than treating all spatial movement as one fixed speed budget.

### 3. Player right-of-way / movement corridor

The current stack can survive contention but does not yet own a polished semantic model of player priority, chokepoint yielding, predicted player corridor occupancy, or cooperative passage.

### 4. Proven R1-5A dynamic final-command player-conflict gap

Preserved red research on PR #15 demonstrates that NATURAL temporal continuity can transform a player-safe preferred/refined movement into a final command that produces real player/companion contact, because current post-continuity command validation protects hard static geometry but not the same dynamic player-separation contract.

This is a **known next-stage design input**, not a reason to reopen foundation survival. The next coordination redesign should decide how dynamic player-conflict authority interacts with continuity, right-of-way, and intentional close contact rather than blindly adding a hard clip.

### 5. MotionIntent / speed authority

The current MotionIntent shape and fixed actor-speed boundary were useful experimental seams. They are not frozen as final architecture and may be redesigned aggressively.

## Readiness conclusion

The project has reached the intended transition point:

> **Ordinary constrained-world states are survivable, the known freeze-class semantics are regression-bound, browser and headless contracts are aligned, catastrophic faults remain observable, causal evidence survives the important failure classes, and the current public runtime survived the Owner torture gate without an unexplained substrate failure.**

Therefore:

**FOUNDATION PASS · REWORK-READY.**

The next stage should not continue incrementally polishing the legacy eight-slot companion. It should begin a deliberate Companion Coordination Core redesign from this substrate, with permission to make large architectural changes to relationship reasoning, pace/catch-up, player cooperation, and movement-command authority while preserving the defended World/physics/evidence boundaries unless new evidence justifies replacing them too.
