# CCC-0 — Owner Browser Observation Gate

Status: **OWNER GATE READY · AUDITED SHADOW ONLY · ZERO MOVEMENT-OUTPUT AUTHORITY**

Date: 2026-09-14

Exact **application runtime** under observation:

`857620b758bdaafcbfbab48da06ff89e7fc238cd`

Exact clean-runtime validation:

- repair push run `34904396219` — SUCCESS;
- fresh PR #17 merge-ref run `34904538403` — SUCCESS;
- **52/52 test files PASS**;
- **221/221 tests PASS**;
- strict TypeScript PASS;
- production build PASS;
- npm audit: 0 vulnerabilities;
- real Chromium black-box audit PASS.

Pinned Owner preview:

`https://jozzpoly.github.io/Companion-Brain-Lab/ccc0/`

Historical Foundation root remains separately preserved at:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

Current Pages authority:

- `main` authority commit `fac371ef4d5b21ae17dc0a83219ed9cecab316bf`;
- composite Pages run `34904811263` — build PASS + deploy PASS;
- `main` validation run `34904811235` — PASS;
- root build pinned to exact Foundation `b217943e027e66993f0010643b2933b01d4b1e6d`;
- `/ccc0/` build pinned to exact CCC-0 runtime `857620b758bdaafcbfbab48da06ff89e7fc238cd`;
- uploaded `github-pages` artifact `10371678833`, digest `sha256:69426ec25dffa8f9c8ccfe71d312d04cb5ca8e7d038c76283784737df2ef9a5b`.

Independent artifact inspection confirmed:

- root still loads historical Foundation bundle `./assets/index--Hpz3nOi.js`;
- `/ccc0/` loads repaired CCC bundle `./assets/index--b-VEI1S.js`;
- Foundation bundle contains no CCC markers;
- `/ccc0/` bundle contains CCC shadow markers and the repaired heading/disclosure implementation.

---

## 1. What this gate is actually testing

CCC-0 still cannot change companion movement output.

The Owner gate therefore does **not** ask whether the companion is finally smart, useful in combat or ready for authority.

It asks whether the shadow research substrate is good enough to design the next experiment:

- **WHERE** — does the coherent player-relative region represent plausible useful space around the player?
- **PACE** — does urgency / desired pace react to the changing relationship rather than merely raw distance?
- **PLAYER FLOW** — does the corridor represent space the player is actually using, including stop/reversal uncertainty?
- **CAUSALITY** — when shadow and legacy disagree, can we tell whether the cause is region choice, pace, player flow, topology, cached evidence or downstream authoritative motion?
- **RUNTIME COST** — on the Owner's real browser/machine, is the current ~10 Hz synchronous shadow cognition perceptibly disruptive?

Bad shadow decisions are useful evidence. Do not protect the implementation from a FAIL.

Automated Chromium has already removed several infrastructure uncertainties: the production build boots, all four scenarios switch, DIRECT/NATURAL toggles, WASD produces live evidence, CCC sections remain interactable during live updates, no runtime-fault surface appears, and no >250 ms rendering stall appeared in the qualified CI runs. **That is not a substitute for Owner perception.**

---

## 2. Setup

1. Open the `/ccc0/` preview above, not the Foundation root.
2. Keep companion mode on the normal spatial workbench path.
3. Enable **Coordination** when you want the geometry overlay; it is intentionally default OFF.
4. Open the CCC sections as needed:
   - `CCC-0 shadow · WHERE`
   - `CCC-0 shadow · PACE`
   - `CCC-0 shadow · PLAYER FLOW`
5. Opened sections should now **stay open while the simulation runs**. The audit found and repaired the old per-frame DOM reconstruction bug that previously made live sections effectively unclickable/unreadable.
6. Use Open / Pillar / Doorway / Head-on freely.
7. Capture an incident whenever something looks causally suspicious instead of trying to reconstruct it from memory.

Expected multi-rate behavior:

- CCC-0 evaluates every 6 World ticks (~10 Hz at the current fixed step);
- `sample t...` identifies the cognition observation that produced the cached shadow frame;
- `age ...t` can rise between evaluations;
- this is expected and must not be mistaken for same-tick evidence;
- evaluator failure is tick-local evidence and should not persist as a fresh error on intervening motor ticks.

---

## 3. Short deliberate rehearsal

### A — open-space WHERE / PACE

Move naturally around the companion: steady travel, slow travel, stop, move away, return, arc around it.

Look for:

- region remains around the player rather than collapsing through player center;
- no arbitrary front/back bias when player direction evidence is genuinely absent;
- small ordinary velocity changes do not cause repeated violent target thrashing;
- topology-change / overlap / anchor-displacement evidence broadly agrees with what the overlay did;
- PACE pressure grows when useful space is escaping and falls as the relationship closes;
- desired speed remains bounded rather than acting like a binary catch-up switch.

### B — stop / memory fade / reversal / jitter

Travel steadily, stop for about a second, reverse 180°, then make several short left/right reversals.

Look for:

- steady motion produces a readable short corridor;
- recent direction survives a brief stop rather than disappearing instantly;
- old velocity direction then fades out rather than becoming permanent pseudo-facing;
- abrupt reversal reduces confidence / exposes uncertainty before confidently committing to the new direction;
- repeated tiny jitter does not create a wildly long high-confidence corridor.

**Known limitation to look at deliberately:** automated qualification observed a maximum shadow-anchor change of about **0.815 m in one 6-tick cognition observation** during the stop/fade transition. A previous audit oracle demanding `<0.5 m` was falsified as too strict; the transition is strongly cadence-dependent and is still substantially smaller than the ~2.051 m one-step legacy reversal snap measured in the same research sequence. Do not ignore the 0.815 m transition: tell us whether it is visually meaningful or objectionable in real play.

### C — preferred vs authoritative PLAYER FLOW

In Open or Head-on, cut across the companion and reverse while it is moving.

PLAYER FLOW exposes separate channels for:

- upstream preferred movement;
- final authoritative command.

Interesting evidence includes disagreement in either direction. CCC-0 should report the split; it must not silently repair movement.

### D — pillar / topology

Move around and across the pillar so useful player-relative space changes sides.

Look for:

- coherent region does not average disconnected sides through the obstacle;
- representative anchor stays inside the displayed coherent component;
- genuine topology changes are explicit;
- trivial motion does not constantly claim catastrophic topology churn;
- browser remains responsive.

The repaired WHERE path first proves direct static traversal and escalates to the full router only when needed. Therefore the old expectation that ordinary pillar geometry must always show >100 traversal queries is obsolete.

### E — doorway / constrained passage

Approach, enter, stop in, reverse through and clear the doorway several times.

Look for:

- WHERE respects passage topology rather than only Euclidean proximity;
- region/anchor does not collapse through player or walls;
- PLAYER FLOW remains readable through reversals in the choke;
- full-router fallback, when genuinely required, does not create an obvious rhythmic hitch;
- wrong shadow evidence remains inspectable rather than mysteriously wrong.

---

## 4. Runtime-cost / cadence gate

This remains a first-class Owner question even after automated Chromium PASS.

Qualified CI browser runs showed no >250 ms or >1000 ms rendering stalls, but hosted headless Chromium is not your machine and not your perception.

During all scenarios watch for a rhythm around the ~10 Hz cognition cadence:

- input hitch;
- animation hitch;
- panel hitch;
- frame-pacing pulse;
- interaction lag synchronized with shadow updates.

WHERE exposes both route-target count and actual static traversal count. Directly reachable research fixtures are now defended at **26 traversal queries** even with irrelevant distant obstacles, but full-router fallback can still cost more when geometry requires it.

If a hitch appears, capture an incident and note the scenario / motion. Do not solve it by blindly increasing the cognition interval.

---

## 5. Causal legibility gate

When something looks wrong, panel/incident evidence should let us distinguish at least:

- current World observation vs cached shadow observation (`shadowTick`, `ageTicks`);
- recent velocity-memory influence vs no remaining direction evidence;
- region topology change vs ordinary anchor movement;
- shortlisted route targets vs actual traversal work;
- preferred player-flow conflict vs final authoritative-command conflict;
- shadow reasoning vs legacy authoritative movement;
- tick-local shadow evaluator failure vs a runtime/brain failure.

A visually bad region with strong causal evidence can still be valuable CCC-0 research.

A visually plausible region whose cause cannot be reconstructed is more serious.

---

## 6. PASS / FAIL boundary

### Owner PASS for the CCC-0 research substrate

Reasonable if, across ordinary and adversarial play:

- WHERE/PACE/PLAYER FLOW are readable enough to criticize;
- their mistakes have visible causal explanations;
- topology and reversal uncertainty are represented rather than hidden;
- stop/fade memory behavior is acceptable or at least clearly diagnosable;
- cached age/provenance is understandable;
- no material periodic browser hitch is perceptible;
- no evidence suggests shadow computation changed authoritative movement output;
- incidents contain enough truth to investigate interesting disagreements.

### Owner FAIL / remain in CCC-0

Any material instance of:

- region repeatedly teleporting for trivial motion without explanatory topology evidence;
- the known stop/fade transition being visibly unacceptable;
- systematic region collapse through obstacles/player center;
- PACE behaving mainly as raw-distance mapping despite motion evidence;
- corridor hallucinating stable flow through stop/reversal/jitter;
- preferred/final conflict channels being misleading or unreadable;
- cached evidence looking indistinguishable from fresh evidence;
- stale shadow failures appearing fresh on intervening ticks;
- obvious periodic cognition hitching;
- CCC panel/overlay making the system harder rather than easier to understand.

A material FAIL does not mean the audit failed. It means CCC-0 did its job by exposing a bad representation before authority.

---

## 7. What a PASS still does not authorize

Even a clean Owner PASS means only:

> CCC-0 is a sufficiently useful research substrate to design the next coordination experiment.

It does **not** freeze or authorize:

- 32 × 3 sampling;
- current radii/weights;
- 12-target shortlist;
- 6-tick cadence;
- WHERE/PACE/PLAYER FLOW decomposition;
- current representative-anchor algorithm;
- current router as long-term WHERE substrate;
- current player corridor;
- any current shadow output as movement authority.

Post-gate work must be replanned from actual Owner observations. Major parts of CCC-0 may be deleted or replaced if the evidence says so.
