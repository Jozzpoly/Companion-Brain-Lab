# S0 Physical Cooperation Apparatus — Qualification State

Status: **MECHANICAL PASS / OWNER BROWSER GATE OPEN**  
Live preview source SHA: `0ee6450aea121a1c3d2c59fc2fceda37539ab9f6`  
Live preview: https://jozzpoly.github.io/Companion-Brain-Lab/

This document records what S0 has actually demonstrated and what remains unproven. It is intentionally stricter than a normal prototype status note: later companion-brain conclusions are only useful if the physical apparatus beneath them is trustworthy enough not to manufacture false AI failures.

## Automated evidence established

The S0 source and physical contracts have passed repeated GitHub Actions qualification on the experiment line.

Current mechanical evidence includes:

- exactly one authoritative domain tick per `LabWorld.step()`;
- reset by World reconstruction returns the authored initial state;
- non-finite controller input is rejected before physical mutation;
- duplicate control authority for one actor is rejected without advancing state;
- solid static obstacles prevent actor traversal;
- authored World boundaries are physically authoritative;
- head-on player↔companion contact remains bounded without deep interpenetration;
- reciprocal actor contact is observable in snapshots;
- narrow-doorway conflict remains bounded and observable;
- requested-vs-actual motion divergence exposes obstruction;
- one scripted fixed-step run repeats exactly within the same CI environment;
- strict TypeScript compilation passes;
- Vite production build passes.

The successful re-attack suite contains 9 focused physical/domain tests. A deterministic Rapier compat build is used, but this does **not** by itself prove whole-application or cross-platform determinism.

## Browser publication evidence

A Pages build produced a real static artifact containing `index.html` and the production JS bundle. The branch-local deployment attempt successfully built and uploaded that artifact but GitHub rejected the deployment job before any deployment step executed.

A separate deployment workflow on `main` then ran with deployment authority from the default branch while explicitly checking out the exact S0 source SHA `0ee6450aea121a1c3d2c59fc2fceda37539ab9f6`.

That pinned workflow established:

- exact S0 checkout: **PASS**;
- install: **PASS**;
- `npm run check`: **PASS**;
- Pages configuration: **PASS**;
- Pages artifact upload: **PASS**;
- Pages deployment: **PASS**;
- GitHub-reported environment URL: `https://jozzpoly.github.io/Companion-Brain-Lab/`.

The deployment workflow itself lives on `main`; the application code published by it does not. This preserves the sibling lab's experiment/main separation while respecting GitHub Pages deployment authority.

The build currently produces a large single JS artifact (~3.53 MB minified / ~1.17 MB gzip), largely attributable to Phaser plus the deterministic Rapier/WASM path. This is accepted as S0 apparatus cost, not as a shipping-performance decision.

## What is still unproven

Automated and deployment evidence do **not** establish that the movement substrate feels appropriate for companion research.

Owner/browser qualification still needs to test directly:

- whether direct desired-velocity dynamic bodies feel excessively pushy, springy or rigid-body-like;
- whether head-on contact jitters or oscillates under real keyboard input;
- whether doorway contention feels stable and understandable;
- whether a player can pin or displace the companion in ways that would contaminate later AI evaluation;
- whether wall/corner sliding is acceptable;
- whether pause + single-step exposes contact honestly;
- whether requested-vs-actual velocity and contact visualization are useful enough to explain failures;
- whether any browser-only initialization/input/render defect escaped headless CI.

## Owner test controls

- `WASD` — player;
- arrow keys — manually controlled companion;
- `1` — open arena;
- `2` — pillar;
- `3` — doorway;
- `4` — head-on;
- `R` — reset current scenario;
- `P` — pause/resume;
- `O` — single simulation step (also forces pause);
- `B` — debug overlay on/off.

Debug semantics:

- green vector = requested velocity;
- red vector = actual velocity;
- red body outline = contact;
- HUD exposes position, motion error and contact counterparts/counts.

## Qualification rule

S0 becomes full **PASS** only if the Owner/browser run demonstrates that this physical substrate is sufficiently stable, legible and non-misleading to serve as apparatus for the first autonomous positioning experiment.

If it feels materially wrong, S0 is **FAIL / REPAIR**, even though all automated tests are green. We must repair or replace the movement/contact substrate before introducing companion intelligence rather than teaching AI to compensate for a flawed apparatus.

No autonomous companion behavior, command system, LLM cognition, planner architecture or shared runtime extraction is authorized by this qualification state.
