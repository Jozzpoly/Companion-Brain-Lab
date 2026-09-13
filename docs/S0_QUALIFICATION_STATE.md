# S0 Physical Apparatus — Qualification State

Updated: 2026-09-13

Status: **MECHANICAL QUALIFICATION PASS · OWNER/BROWSER GATE OPEN**

This document records the exact evidence boundary for S0. It is deliberately not a claim that the physical apparatus already feels good enough for companion research.

## Exact candidate

Branch: `experiment/s0-physical-apparatus`

Head at this checkpoint:

`823371c42140ac5ecc04c53bbfa7430a7265b0e1`

Draft PR: #2 — `S0: physical cooperation apparatus spike`

## What S0 currently contains

- fixed 60 Hz domain step;
- fresh `LabWorld` independent of Phaser;
- `@dimforge/rapier2d-deterministic-compat` `0.20.0` behind the physical boundary;
- zero-gravity dynamic circular player + companion bodies;
- desired velocity reapplied each fixed tick;
- CCD enabled for actors;
- solid actor↔actor and actor↔static contact;
- authored world boundaries;
- `open`, `pillar`, `doorway`, `head-on` scenarios;
- manual player and companion controls;
- requested-vs-actual velocity and contact diagnostics;
- reset, pause and single-step controls;
- Phaser used only for browser presentation/input;
- host-portable Vite build using relative asset base.

No autonomous companion behavior exists.

## Automated evidence

Latest exact-head PR workflow:

GitHub Actions run `34786166242` — **PASS**.

Environment observed by CI:

- Node `22.23.2`;
- npm `10.9.8`;
- TypeScript strict compile — **PASS**;
- Vitest — **9/9 PASS**;
- Vite `8.2.2` production build — **PASS**;
- dependency audit at install time — `0 vulnerabilities`.

The 9 S0 tests establish, within the exact CI environment:

1. one domain tick per World step and exact authored reset by reconstruction;
2. non-finite motion rejected before physical state mutation;
3. duplicate actor-control authority rejected without advancing state;
4. pillar collision prevents passage and exposes contact + requested/actual divergence;
5. authored world boundary prevents passage and exposes boundary contact;
6. head-on actors remain non-deeply-interpenetrating and report reciprocal contact;
7. narrow-doorway conflict remains bounded, non-interpenetrating and causally visible;
8. identical scripted fixed-step input produces exactly equal final state across repeated runs in the same CI environment;
9. blocked movement produces observable requested-vs-actual motion error.

## Explicit non-claims

This evidence does **not** prove:

- that direct dynamic-body velocity control feels good to the player;
- that companion↔player pushing is desirable;
- that doorway contact is free from visually annoying jitter under arbitrary manual play;
- cross-browser or cross-machine whole-application determinism;
- final physics architecture;
- final character controller architecture;
- good autonomous positioning;
- good navigation;
- good combat behavior;
- readiness for S1.

## Known apparatus costs / risks

### Dynamic-body control

S0 deliberately uses dynamic zero-gravity bodies instead of immediately introducing a sequential kinematic character controller. This gives the solver simultaneous player↔companion contact, but may feel overly physical or pushy.

That is the main qualitative S0 hypothesis still under test.

If the Owner finds the control/contact behavior materially unpleasant, the next step is an apparatus A/B or repair — not AI compensation.

### Bundle weight

The current Vite build emits a single JavaScript chunk of roughly `3.53 MB` minified / `1.17 MB` gzip, mainly due to Phaser plus the embedded deterministic Rapier/WASM path.

This is acceptable for the bounded research spike and is not treated as shipping performance qualification.

### Dependency lock

The spike currently has pinned top-level versions but no committed lockfile. CI uses `npm install`, not `npm ci`.

This is acceptable for the current isolated S0 experiment but should be repaired before the repository begins accumulating longer-lived implementation layers.

## Browser / Owner gate required for S0 closure

The remaining evidence is deliberately experiential.

The exact build should be played directly and attacked with:

- head-on body contact;
- doorway squeezing and attempted passing;
- pinning one actor against a wall/obstacle;
- repeated direction reversals;
- wall and corner scraping;
- pause during contact;
- single-step during contact;
- repeated scenario reset.

The Owner should judge:

1. Is player control still direct and predictable?
2. Does body contact remain stable enough to reason about?
3. Is pushing useful physical truth or does it dominate the feel?
4. Do any jitter/solver artifacts make later AI evaluation unreliable?
5. Can requested-vs-actual movement/contact diagnostics explain surprising motion?

## S0 closure rule

**PASS only after automated evidence and Owner/browser evidence agree that the apparatus is sufficiently stable and interpretable for studying companion behavior.**

If browser feel fails, S0 remains FAIL/OPEN even though all automated checks pass.

Do not implement autonomous S1 by inertia before this gate.
