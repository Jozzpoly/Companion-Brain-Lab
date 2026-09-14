# R1-5A — Dynamic Final-Command Authority Red Evidence

Status: **RED REPRODUCTION PASS / MATERIAL WORLD CONSEQUENCE DEMONSTRATED / NO PRODUCTION REPAIR SELECTED**

Date: 2026-09-14

Branch: `planning/r1-5-player-conflict-authority`

Primary red evidence commit: `df6c3e7382f350252a76e346900bd6121a43da19`

Primary CI run: `34864314897`

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

CI run `34864314897`:

- historical audited R1-4 suite: **108/108 PASS**;
- new R1-5A tests: **2/2 RED as designed**;
- total: 108 PASS / 2 FAIL.

The new failure therefore does not invalidate the historical R1-4 qualification claims within their exercised scope. It demonstrates a previously unqualified R1-5 boundary.

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

## 7. Repair families now worth comparing

No family is selected yet.

### A — post-continuity dynamic revalidation + safe upstream fallback

Analogous in responsibility shape to R1-3 static final validation:
- evaluate the realized final command against player-conflict evidence;
- if unsafe, use a dynamically safe refined/coarse preferred fallback when one exists;
- otherwise produce an explicit bounded conflict response rather than silently sending the unsafe command.

Potential benefit: narrow and causally inspectable.

Risk: abrupt fallback may destroy NATURAL continuity, create visible snapping, or treat the moving player too much like static geometry.

### B — dynamic constraint-aware temporal realization

Allow continuity to shape acceleration/turning inside a dynamic admissible set rather than fixing the command afterwards.

Potential benefit: better preservation of motion quality.

Risk: significantly more coupling between temporal actuation and player-conflict prediction; harder A/B and harder debugging.

### C — hybrid emergency boundary + higher-level right-of-way/commitment

Use a narrow final emergency contract only for imminent material player conflict, while ordinary passing/yielding remains a higher-level R1-5 responsibility in the candidate field.

Potential benefit: avoids asking one layer to solve both safety and cooperation.

Risk: threshold interactions can become opaque unless workbench evidence is explicit.

## 8. Next bounded research move

Before production repair, build a **test-only repair comparison** against the exact red fixtures:

1. safe-upstream fallback candidate;
2. measure whether it removes predicted violation and physical contact;
3. measure the command discontinuity / motion-quality cost it introduces;
4. compare against an actuator-aware alternative only if the simple fallback is materially destructive.

This preserves the evidence-led sequence:

`RED authority reproduction -> test-only repair comparison -> repair selection -> isolated implementation -> regression campaign -> Owner gate`.

The current public R1-4 runtime remains unchanged.
