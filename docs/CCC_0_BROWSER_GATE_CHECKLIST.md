# CCC-0 — Owner Browser Observation Gate

Status: **OWNER GATE OPEN · SHADOW ONLY · ZERO MOVEMENT AUTHORITY**

Date: 2026-09-14

Exact application runtime under observation:

`bfe30df9298c1aa36dd4db43de70a049804255bc`

Pinned browser preview:

`https://jozzpoly.github.io/Companion-Brain-Lab/ccc0/`

Historical Foundation root remains separately preserved at:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

Pages composite deployment:

- workflow run `34893943934` — build + deploy PASS;
- Pages authority commit `1829804cfa7969775714810c42a0638ac6abbe2f`;
- root build pinned to Foundation `b217943e027e66993f0010643b2933b01d4b1e6d`;
- `/ccc0/` build pinned to CCC-0 `bfe30df9298c1aa36dd4db43de70a049804255bc`.

---

## 1. What this gate is actually testing

CCC-0 still cannot change companion movement.

The Owner gate therefore does **not** ask whether the companion feels smarter or behaves better.

It asks whether the new research evidence is useful enough to design the first authority experiment:

- **WHERE** — does the coherent player-relative region look like a plausible place a useful companion could occupy?
- **PACE** — does urgency / desired pace rise and fall in ways that match the changing relationship rather than only raw distance?
- **PLAYER FLOW** — does the corridor represent where the player is actually using space, including uncertainty after reversals?
- **CAUSALITY** — when the shadow disagrees with legacy movement, can we see whether the disagreement is upstream preferred motion, downstream authoritative motion, topology, pace or stale multi-rate evidence?
- **RUNTIME COST** — does the 6-tick (~10 Hz) shadow evaluation cause visible periodic hitching or degraded interaction despite having zero semantic authority?

Bad shadow decisions are useful evidence. Do not protect the implementation from a FAIL.

---

## 2. Setup

1. Open the `/ccc0/` preview, not the Foundation root.
2. Keep companion mode on the normal spatial workbench path.
3. Enable the **Coordination** overlay when you want to inspect geometry; it is intentionally default OFF.
4. Expand the three CCC-0 panel sections as needed:
   - `CCC-0 shadow · WHERE`
   - `CCC-0 shadow · PACE`
   - `CCC-0 shadow · PLAYER FLOW`
5. Use the existing open / pillar / doorway / head-on scenarios.
6. Capture an incident whenever something looks causally suspicious rather than trying to reproduce it from memory.

Expected multi-rate behavior:

- CCC-0 evaluates every 6 World ticks;
- `sample t...` identifies the cognition tick that produced the cached shadow frame;
- `age ...t` may therefore rise between evaluations;
- this is expected and must not be confused with same-tick evidence.

---

## 3. Short deliberate rehearsal

### A — open-space WHERE / PACE

Move naturally around the companion: steady travel, slow travel, stop, move away, return toward it.

Look for:

- region remains around the player rather than collapsing through the player center;
- no arbitrary front/back bias while the player has no meaningful heading;
- small heading changes usually produce overlapping/coherent regions rather than violent anchor teleporting;
- topology-change / overlap / anchor-displacement evidence agrees with what the overlay visibly did;
- PACE pressure grows when the useful region is escaping and falls as the companion/region relationship closes;
- desired speed remains bounded rather than behaving like a binary catch-up switch.

### B — reversal / jitter PLAYER FLOW

Travel steadily, stop, reverse 180°, then make several short left/right reversals.

Look for:

- steady motion produces a clear short corridor;
- a real stop does not fabricate a new world-axis flow direction;
- abrupt reversal visibly reduces confidence / produces uncertainty before confidently committing to the new direction;
- repeated jitter does not produce a wildly long high-confidence corridor;
- corridor physical core and comfort envelope remain visibly distinct.

### C — preferred vs authoritative conflict

In open/head-on play, cut across the companion and reverse while it is moving.

The PLAYER FLOW section exposes separate conflict channels for:

- legacy preferred velocity;
- final authoritative command.

Interesting evidence includes either direction of disagreement. In particular, note cases where preferred is clear but authoritative becomes conflicting, or vice versa. CCC-0 must report this difference; it must not repair it.

### D — pillar / topology

Move around and across the pillar so good player-relative space exists on changing sides.

Look for:

- coherent region does not average disconnected sides through the obstacle;
- representative anchor stays inside the displayed coherent component;
- topology change is explicit when the good region genuinely changes component;
- small ordinary motion does not constantly report catastrophic topology churn;
- static traversal/query count rises relative to open space but the browser remains responsive.

### E — doorway / constrained passage

Approach, enter, stop in, reverse through and clear the doorway several times.

Look for:

- WHERE respects passage topology rather than only Euclidean proximity;
- region/anchor does not collapse into the player because samples exist on both sides;
- corridor remains readable through reversals in the choke;
- higher route/static-query cost does not create obvious rhythmic hitching;
- shadow evidence can be wrong, but its wrongness should be inspectable.

---

## 4. Runtime-cost / cadence gate

This is a first-class Owner question because automated semantic zero-authority cannot prove presentation-time smoothness.

During all scenarios, watch specifically for a ~10 Hz periodic disturbance:

- input hitch;
- animation hitch;
- panel hitch;
- noticeable frame pacing pulse;
- interaction lag synchronized with shadow updates.

The WHERE panel now shows both:

- route candidate count;
- actual static traversal query count.

Open geometry should be much cheaper than pillar/doorway geometry. High query count is not automatically a failure; visible runtime disturbance is.

If a hitch appears, capture an incident and note scenario + approximate player motion. Do not solve it by silently increasing the interval before understanding the cost.

---

## 5. Causal legibility gate

When something looks wrong, the panel/incident should let us distinguish at least:

- current World observation vs cached shadow observation (`shadowTick`, `ageTicks`);
- region topology change vs ordinary anchor movement;
- route candidate count vs real static traversal cost;
- preferred player-flow conflict vs authoritative-command conflict;
- shadow reasoning vs legacy authoritative command;
- shadow failure vs runtime/brain failure.

A visually bad region with good causal evidence can still be useful CCC-0 research.

A visually plausible region whose cause cannot be reconstructed is a more serious CCC-0 failure.

---

## 6. PASS / FAIL boundary

### Owner PASS for CCC-0 research substrate

Reasonable if, across ordinary and adversarial play:

- WHERE/PACE/PLAYER FLOW are readable enough to criticize;
- their mistakes have visible causal explanations;
- topology and reversal uncertainty are represented rather than hidden;
- multi-rate age/provenance is understandable;
- no obvious periodic browser hitch is introduced;
- no evidence suggests shadow computation changed authoritative movement;
- incidents contain enough information to investigate interesting disagreements.

### Owner FAIL / continue CCC-0

Any material instance of:

- region repeatedly teleporting for trivial motion without explanatory topology evidence;
- systematic region collapse through obstacles/player center;
- PACE behaving mainly as raw-distance mapping despite motion evidence;
- corridor hallucinating stable flow during stop/reversal/jitter;
- preferred/final conflict channels being misleading or unreadable;
- cached evidence looking indistinguishable from fresh evidence;
- obvious ~10 Hz runtime hitching;
- debug density making the system harder, not easier, to understand.

Do not promote CCC-1 authority after a material FAIL.

---

## 7. What a PASS still does not authorize

Even a clean Owner PASS means only:

> CCC-0 is a sufficiently useful research substrate to design the next experiment.

It does **not** freeze:

- 32 × 3 sampling;
- current radii/weights;
- 12-candidate shortlist;
- 6-tick cadence;
- WHERE/PACE/PLAYER FLOW decomposition;
- current representative anchor algorithm;
- any future movement authority shape.

Post-gate CCC-1 must be replanned from actual Owner observations and may delete or replace major parts of CCC-0.