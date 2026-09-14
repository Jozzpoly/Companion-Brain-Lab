# R1-5A — Final Player Physical Authority Qualification

Status: **MECHANICAL QUALIFICATION PASS · OWNER BROWSER EVIDENCE NOT YET RUN · R1-5B NOT STARTED**

Date: 2026-09-14

Branch: `planning/r1-5-player-conflict-authority`

Exact qualified application/runtime checkpoint: `c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`

Final qualification CI run: `34872858900`

Historical public R1-4 runtime remains separately pinned at `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`.

## 1. Qualification claim

R1-5A qualifies one narrow responsibility:

> After NATURAL temporal realization and the existing static hard-command gate, the companion has a separate final physical player-authority boundary that prevents its own next-step command from materially taking control away from the player, while leaving ordinary player-aware steering and right-of-way quality upstream.

This is **not** a qualification of general player cooperation, yielding, passing quality, doorway etiquette, or all of R1-5.

The qualified responsibility chain is:

`relationship objective`

`-> static route / corridor`

`-> player-aware local candidate policy / comfort evidence`

`-> preferred-velocity refinement`

`-> NATURAL temporal continuity`

`-> final static hard authority`

`-> final player physical authority`

`-> World / Rapier physical outcome`.

## 2. Why R1-5A existed

The original deterministic RED demonstrated that an upstream player-safe move was not authoritative after temporal realization.

Historical RED evidence is preserved in:

`docs/R1_5A_DYNAMIC_FINAL_COMMAND_RED_EVIDENCE.md`

Primary RED CI run: `34864314897`.

The isolation fixture showed:
- DIRECT/coarse move approximately `{x=0, y=0.7}`;
- refined move approximately `{x=0, y=0.69447}`;
- upstream S3 comfort-horizon clearance `+0.22 m`;
- NATURAL continuity output `{x=0.9878317, y=0.0084505}`;
- existing static final gate correctly reported no static blocker;
- the same broad dynamic comfort metric after continuity was `-0.7714457 m`.

A real Rapier World A/B then demonstrated material consequence before repair:

### DIRECT baseline
- minimum player-companion center distance: `1.0006123 m`;
- contact frames: `0`;
- player displacement: `0`;
- maximum player motion error: `0`.

### NATURAL before R1-5A repair
- minimum center distance: `0.6004696 m`;
- contact frames: `5`;
- maximum player displacement: `0.0069762 m`;
- maximum player motion error: `0.2275646 m/s`.

The important failure was not merely that colliders touched. NATURAL materially disturbed the player while DIRECT did not.

## 3. Falsification changed the contract before implementation

R1-5A did **not** simply install the original `0.55 s + 0.18 m` player-conflict metric as a final hard gate.

That candidate was tested and rejected.

### Broad final comfort projection

The existing S3 policy uses:
- player prediction horizon: `0.55 s`;
- player comfort buffer: `0.18 m`.

When this broader envelope was projected as final authority:
- the head-on moving-player case required `17` emergency corrections;
- the cross-front case required only one correction but ended at target distance `3.48209 m` from a start of `3.46500 m`, losing net objective progress;
- clean moving-player cases were therefore being governed by the emergency boundary rather than by normal upstream policy.

This falsified the idea that S3 comfort clearance and final physical authority are the same responsibility.

Preserved evidence:

`src/brain/r1-player-conflict-projection-matrix.test.ts`

### Contact manifold was also rejected as the hard failure definition

Physical-only horizon sweeps at 1/2/3/4/6 physics steps showed Rapier contact-manifold counts were not monotonic with predicted physical clearance.

A companion could remain about `0.602 m` from a stationary player with combined body diameter `0.600 m`, produce several contact-manifold frames, yet cause **zero** player motion error.

Therefore R1-5A does not define success as “never share a Rapier contact manifold.”

The defended hard concern is:
- no material physical penetration attributable to the companion command;
- no material requested-vs-actual player motion disturbance caused by that command;
- no silent invalidation of static hard safety while repairing player authority.

## 4. Qualified architecture

Production experiment component:

`src/brain/final-player-command-constraint.ts`

Key constant:

`R1_FINAL_PLAYER_HARD_MARGIN = 0.002 m`

The final player gate:
- predicts physical player/companion closest approach over the next physics step only;
- uses body radii, not the S3 `0.18 m` comfort buffer;
- observes current player velocity from actual motion when meaningful, otherwise requested motion;
- keeps a tiny numerical physical margin while normally separated;
- uses boundary/overlap **egress semantics** instead of creating a clearance prison;
- projects an unsafe final command toward already player-aware upstream preferred motion;
- requires any repaired command to remain statically hard-safe;
- falls back to a hard-safe preferred move or stop if the projected command would violate static geometry;
- uses a statically safe maximum-separation best effort when the player’s own motion makes the required clearance impossible that frame;
- resets only NATURAL temporal actuator history when final authority changes the command.

The gate is integrated in:

`src/brain/r1-natural-spatial-locomotion.ts`

Final execution order:

`NATURAL continuity -> static final gate -> player final gate -> World`.

## 5. Component-level invariants

Test:

`src/brain/final-player-command-constraint.test.ts`

Four defended invariants:
1. a physically hard-safe command remains unchanged;
2. an unsafe near-contact command can project toward an already-safe preferred move;
3. egress remains admissible when the current state is already at/inside the hard boundary;
4. dynamic player repair may not reintroduce a static blocker.

All four pass in the qualified runtime.

## 6. Material RED became GREEN without weakening its player-agency threshold

Test:

`src/brain/r1-player-conflict-world.red.test.ts`

After integrating the real final player-authority gate, the original material World regression passed **without lowering the player-agency requirement**.

The repaired abrupt-turn trial now shows:
- final player constraint interventions: `2` over `36` evaluated frames;
- sources: `34 x unchanged`, `2 x projected-preferred`;
- maximum normalized command correction: `0.1569098`;
- minimum center distance: `0.6019996 m`;
- minimum physical clearance: `0.0019996 m`;
- contact-manifold frames: `6` — diagnostic, not hard failure;
- maximum player motion error: **`0`**;
- stationary player end position remains exactly `{5,4}`;
- companion still makes useful target progress from `2.0 m` to about `1.12103 m`.

This is the central repair evidence: the reproduced player disturbance disappears while the final hard gate remains bounded.

## 7. Integrated World matrix — authority boundary, not hidden steering

Test:

`src/brain/r1-player-authority-integrated-matrix.test.ts`

The matrix uses the actual:

`R1NaturalSpatialLocomotionBrain -> static final authority -> player final authority -> Rapier World`.

### Stationary player / abrupt turn
- player hard-gate interventions: `2 / 36`;
- maximum player motion error: `0`;
- minimum physical clearance: `0.0019996 m`;
- useful objective progress preserved.

### Head-on moving player
- player hard-gate interventions: **`0 / 72`**;
- minimum physical clearance: `0.4803683 m`;
- maximum player motion error: approximately `0.0000549 m/s`;
- objective progress preserved.

### Cross-front moving player
- interventions: **`0 / 72`**;
- minimum physical clearance: `0.5043624 m`;
- maximum player motion error: approximately `0.0000229 m/s`;
- end target distance `3.33080 m` from start `3.46500 m`.

### Player reversal
- interventions: **`0 / 72`**;
- minimum physical clearance: `0.9414199 m`;
- maximum player motion error: approximately `0.0000549 m/s`;
- objective progress preserved.

Interpretation: the new layer behaves as a rare final authority boundary. It does not become a second local steering system in clean moving-player encounters.

## 8. Static/player authority composition

Test:

`src/brain/r1-player-authority-static-composition.test.ts`

### Same-frame hard wall + player pressure

An adversarial fixture gives the companion stale velocity toward hard static geometry while the player occupies the opposite relationship direction.

Observed contract:
- static final gate constrains the stale command;
- blocker is the authored hard wall;
- player gate accepts the already player-aware static fallback unchanged;
- the final endpoint remains statically traversable;
- no hard-wall contact is introduced.

This defends against final authority layers “ping-ponging” the command between incompatible repairs.

### Doorway contention / reversal / recovery

A full doorway run with player reversals produced:
- minimum player distance about `0.915887 m`;
- player hard-gate interventions: `0`;
- static final-gate interventions: `0`;
- doorway hard-contact frames: `0`;
- maximum player motion error about `0.0000458 m/s`;
- applied local retries: `1`;
- target reached;
- no persistent-unreachable failure.

This scenario does not directly stress the R1-5A emergency seam because upstream policy resolves it first. It is useful precisely as a non-interference regression.

## 9. Observability qualification

The final player authority is now visible through the same causal workbench as the rest of R1.

`R1WorkbenchSpatialDebug` exposes `finalPlayerConstraint` separately from the static `finalConstraint`.

The browser workbench shows:
- static hard-gate source/constrained/blocker;
- player hard-gate source/constrained state;
- current physical clearance;
- required hard clearance;
- original predicted physical clearance;
- final predicted physical clearance;
- player-gate reason.

Motion command coloring:
- green: neither final authority changed the command;
- yellow: static hard authority changed it;
- red: player physical authority changed it.

Causal incident schema is now:

`companion-brain-lab-r1-causal-incident-v3`

Each causal frame preserves separate player-authority source, constrained flag, clearance values and reason.

This is important because R1-5A is not considered owner-testable if the Owner cannot tell when the emergency authority actually took control.

## 10. Final qualification run

Exact qualified application checkpoint:

`c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`

GitHub Actions run:

`34872858900`

Result:
- **31 / 31 test files PASS**;
- **122 / 122 tests PASS**;
- TypeScript `tsc --noEmit` PASS;
- production Vite build PASS;
- npm install audit reports `0 vulnerabilities`;
- existing >500 kB client chunk warning remains non-blocking and outside the R1-5A behavioral claim.

The same final run includes passing evidence for:
- original material R1-5A World regression;
- broad-comfort projection rejection record;
- hard/comfort physical probe;
- integrated player-authority World matrix;
- static/player authority composition;
- R1-4 dynamic/recovery regressions;
- workbench DIRECT/NATURAL evidence transport;
- causal-frame trace preservation.

## 11. Qualification boundary / explicit non-claims

R1-5A does **not** prove:
- that open-space passing feels intelligent;
- correct human-like right-of-way;
- stable side commitment during extended conflict;
- optimal comfort buffer or prediction horizon;
- optimal `0.002 m` hard margin for production gameplay;
- that all physical contact with the player should be prevented;
- multi-companion collision responsibility;
- crowd navigation quality;
- combat movement;
- final production navigation architecture.

Those are separate questions.

Most importantly:

> R1-5A prevents the companion’s final NATURAL command from materially taking player agency after upstream player-aware reasoning. It does not decide what good cooperation should look like before that emergency boundary is reached.

The latter is R1-5B and later work.

## 12. Owner/browser gate

Mechanical qualification does not equal Owner qualification.

The R1-5A Owner/browser gate should focus on:
- naturally crossing in front of the companion while NATURAL is active;
- abruptly changing direction near the companion;
- stopping/reversing while it is already carrying velocity;
- pushing/body contact near open space and static geometry;
- confirming that ordinary close passes do not visibly feel like repeated emergency clipping;
- observing the motion panel for rare red player-hard-authority intervention rather than continuous red steering;
- capturing an incident with `I` if an intervention feels wrong and preserving the v3 trace.

A visually awkward pass may still be an R1-5A pass if player agency is preserved; higher-level cooperation quality belongs to R1-5B.

## 13. Promotion state

**Mechanics:** PASS.

**Evidence/observability:** PASS.

**Owner/browser evidence:** NOT YET RUN.

**Public Pages:** intentionally still pinned to audited R1-4.

**R1-5B:** NOT STARTED as active authority.

Do not call all of R1-5 complete from this document.
