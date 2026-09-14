# R1-5A — Dynamic Final-Command Authority Red Evidence

Status: **RED REPRODUCTION PASS / MATERIAL WORLD CONSEQUENCE DEMONSTRATED / REPAIR SHAPE UNDER TEST**

Date: 2026-09-14

Branch: `planning/r1-5-player-conflict-authority`

Primary red evidence commit: `df6c3e7382f350252a76e346900bd6121a43da19`

Primary RED CI run: `34864314897`

Projection comparison run: `34865156296`

## 1. Question

R1-5A tested the code-grounded hypothesis that the player-conflict contract is authoritative only before temporal motion realization:

`player-safe spatial/refined preferred move`

`-> NATURAL continuity changes the command`

`-> final hard-static gate sees no static violation`

`-> dynamically player-conflicting command reaches World`.

This was deliberately tested before implementing any dynamic final-command gate or yielding policy.

## 2. Isolation-level red reproduction

Test: `src/brain/r1-player-conflict-authority.red.test.ts`

Fixture:
- open world / no static blocker involved;
- player stationary at `{5, 4}`;
- companion at `{4, 4}`;
- player and companion radius `0.30 m`;
- current companion velocity `3 m/s` rightward toward player;
- new relationship target directly upward at `{4, 6}`;
- current player safety buffer `0.18 m`;
- current player-conflict prediction horizon `0.55 s`.

The full R1 path is exercised through:
- static route planning;
- R1 hard/comfort spatial choice;
- preferred-velocity refinement;
- NATURAL continuity;
- existing final hard-static command constraint.

### Evidence

DIRECT / coarse spatial move:

`{ x ~= 0, y = 0.7 }`

Predicted dynamic player clearance:

`+0.22 m`

Refined preferred move:

`{ x ~= 0, y = 0.69447 }`

Predicted dynamic player clearance:

`+0.22 m`

NATURAL continuity output:

`{ x = 0.9878317107, y = 0.0084505310 }`

Existing final static gate:
- `source = continuity`;
- `constrained = false`;
- blocker = none;
- reason = `final continuity command is hard-body safe`.

Final predicted dynamic player clearance:

`-0.7714456868 m`

Therefore the accepted player-safe spatial/refinement decision is not preserved through the final motion-realization boundary.

## 3. Real World material-consequence reproduction

Test: `src/brain/r1-player-conflict-world.red.test.ts`

Two independent Rapier worlds receive the same authored initial state, one warm-up frame and the same relationship target. The only experiment variable is movement realization:

- DIRECT: repaired R1 spatial output goes directly to World;
- NATURAL: the same responsibility chain includes temporal continuity plus the existing final static gate.

The player requests zero motion throughout the trial.

### DIRECT result

- minimum player-companion center distance: `1.0006123072 m`;
- player-contact frames: `0`;
- maximum player displacement: `0`;
- maximum player motion error: `0`;
- companion end: `{ x = 4.0, y = 5.2073574066 }`;
- player end: `{ x = 5.0, y = 4.0 }`.

### NATURAL result

- minimum player-companion center distance: `0.6004696487 m`;
- physical body diameter threshold: `0.6000000000 m`;
- player-contact frames: **5**;
- maximum player displacement: `0.0069762264 m`;
- maximum player motion error: `0.2275645856 m/s`;
- companion end: `{ x = 4.2625188828, y = 4.9054861069 }`;
- player end: `{ x = 5.0068798065, y = 3.9988441467 }`.

This demonstrates a material World consequence: NATURAL converts a DIRECT-clean encounter into actual player/companion contact and measurable player disturbance.

## 4. Regression isolation

Primary RED run `34864314897`:

- historical audited R1-4 suite: **108/108 PASS**;
- new R1-5A tests: **2/2 RED as designed**;
- total: 108 PASS / 2 FAIL.

The new failure therefore does not invalidate the historical R1-4 qualification claims within their exercised scope. It demonstrates a previously unqualified R1-5 boundary.

The R1-5 planning branch intentionally remains red while these two reproductions are preserved.

## 5. Promoted finding

The prior R1-5 planning hypothesis can now be promoted:

> **MATERIAL FINDING — NATURAL temporal realization can invalidate a player-safe preferred-motion decision, and the existing final command authority only protects against hard static geometry.**

The finding is stronger than a forecast mismatch because a deterministic real-World A/B reproduces physical player contact under NATURAL while DIRECT remains contact-free.

## 6. What this does not yet prove

Do not overgeneralize this result.

It does not prove:
- every NATURAL player encounter is bad;
- current player buffer/prediction horizon are optimal;
- all player contact is undesirable;
- the correct repair is to hard-reject every final command with negative predicted clearance;
- yielding/right-of-way semantics are already selected;
- ORCA/RVO or a new navigation system is needed;
- the public R1-4 Owner runtime should be changed before its current Owner gate.

The fixture deliberately isolates an abrupt temporal direction change with meaningful existing velocity. It proves the missing authority seam and one material consequence class.

## 7. First repair comparison — full fallback vs safe-boundary projection

Test-only probe: `src/brain/r1-player-conflict-repair-probe.test.ts`

No production brain behavior is changed. Both variants re-evaluate the post-continuity command against the same dynamic player-clearance contract and reset temporal acceleration state after intervention.

### Candidate A — full safe upstream fallback

When the realized command is dynamically unsafe, use the already accepted safe refined/coarse move.

Run `34864917729` / repeated in comparison run `34865156296`:

- intervention count: `1`;
- minimum final predicted clearance: `+0.22 m`;
- minimum physical center distance: `1.0006026715 m`;
- player-contact frames: `0`;
- maximum player displacement: `0`;
- maximum command correction: **`1.2026780451`** normalized move units;
- companion end: `{ x = 4.0, y = 5.2176551819 }`.

Finding: it is a strong emergency baseline — it removes the violation/contact with one intervention and preserves progress — but the one-frame command discontinuity is large.

### Candidate A2 — project toward nearest safe upstream boundary

Instead of jumping directly to the safe refined move, binary-search the segment from the unsafe NATURAL command toward that already safe upstream command and take the nearest point satisfying a small positive predicted-clearance target (`0.002 m`).

Comparison run `34865156296`:

- intervention count: `1`;
- minimum final predicted clearance: `+0.0020000041 m`;
- minimum physical center distance: `0.9263863056 m`;
- player-contact frames: `0`;
- maximum player displacement: `0`;
- maximum command correction: **`0.7688866800`** normalized move units;
- companion end: `{ x = 4.0510292053, y = 5.1651439667 }`.

Relative to full fallback, the projection reduces the maximum command correction by about **36%** while remaining contact-free in this fixture and preserving useful progress.

### Current interpretation

The projection is a materially better **candidate emergency boundary** than immediate full fallback for this reproduction. It is not yet selected for production because:

- the improvement is proven in one abrupt-turn/stationary-player fixture only;
- its chosen clearance sits intentionally close to the contract boundary;
- moving-player prediction may make the safe region shift rapidly between frames;
- repeated projection could still create visible oscillation or destroy temporal smoothness;
- the current bisection along one line segment is an experiment, not a final dynamic-constraint geometry.

## 8. Repair families still worth comparing

### A — post-continuity dynamic revalidation + safe upstream fallback

Demonstrated as mechanically safe in the current reproduction, but with high one-frame correction cost.

### A2 — nearest safe blend/projection toward upstream accepted motion

Current-best narrow candidate. It materially reduces correction cost in the existing fixture while preserving safety. It now requires adversarial multi-scenario characterization.

### B — dynamic constraint-aware temporal realization

Allow continuity to shape acceleration/turning inside a dynamic admissible set rather than fixing the command afterwards.

This becomes worth its additional coupling only if A2 fails across moving-player / varying-speed / reversal scenarios or requires repeated destructive intervention.

### C — hybrid emergency boundary + higher-level right-of-way/commitment

Use a narrow final emergency contract for imminent material player conflict, while ordinary passing/yielding remains a higher-level R1-5 responsibility in the candidate field.

This remains the strongest current responsibility shape: final safety consistency and higher-level cooperation are related but should not be forced into one algorithm.

## 9. Next bounded research move

Before production repair, broaden A2 against adversarial variants while retaining the exact red reproductions:

1. lower and medium carried companion velocity, not only `3 m/s`;
2. moving/cross-front player;
3. player sudden reversal / stop where the predicted dynamic safe set moves between frames;
4. repeated independent conflict episodes to detect projection/fallback oscillation;
5. report intervention count, minimum predicted clearance, physical contact, player disruption, command correction and companion progress.

Only after this matrix should we decide between:

- narrow post-continuity projection as emergency authority;
- a more deeply constraint-aware continuity controller;
- or evidence that the player-conflict representation itself must change.

The current public R1-4 runtime remains unchanged.
