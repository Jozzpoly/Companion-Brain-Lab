# S0 Physical Cooperation Apparatus — Qualification State

Status: **FULL PASS FOR RESEARCH APPARATUS / NOT A MOVEMENT-QUALITY PASS**  
Date qualified by Owner/browser evidence: 2026-09-13  
Live preview application source SHA: `0ee6450aea121a1c3d2c59fc2fceda37539ab9f6`  
Live preview: https://jozzpoly.github.io/Companion-Brain-Lab/

This document records what S0 has actually demonstrated and what remains unproven. It is intentionally stricter than a normal prototype status note: later companion-brain conclusions are only useful if the physical apparatus beneath them is trustworthy enough not to manufacture false AI failures.

The experiment branch received documentation/deployment-workflow commits after the live application source SHA. Those commits did not change the runtime that was Owner-tested.

## Qualification decision

S0 is now qualified as a **research apparatus**, not as a final movement or character-control solution.

The Owner described the presentation and movement prototype as extremely raw, while judging the collision itself to appear okay. Two browser recordings were reviewed after the live test. They include repeated actor contact, doorway contention, obstacle interaction and wall/boundary pressure. No visually obvious solver explosion, teleportation, runaway oscillation or catastrophic contact instability was observed in those recordings.

That evidence is sufficient for the next bounded local-brain positioning experiment because the current contact substrate is stable and legible enough that obvious positioning failures should remain attributable to the positioning logic rather than to a broken collision system.

It is **not** evidence that:

- direct desired-velocity dynamic bodies are the final character controller;
- current pushing/contact feel is good enough for a finished game;
- circles accurately model final character body semantics;
- crowding with several companions will remain acceptable;
- the current apparatus is polished visually or ergonomically.

Those remain open and should be revisited when the research question actually requires them.

## Automated evidence established

The S0 source and physical contracts passed repeated GitHub Actions qualification on the experiment line.

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

A Pages workflow on `main` ran with deployment authority from the default branch while explicitly checking out the exact S0 application source SHA `0ee6450aea121a1c3d2c59fc2fceda37539ab9f6`.

That pinned workflow established:

- exact S0 checkout: **PASS**;
- install: **PASS**;
- `npm run check`: **PASS**;
- Pages configuration: **PASS**;
- Pages artifact upload: **PASS**;
- Pages deployment: **PASS**;
- GitHub-reported environment URL: `https://jozzpoly.github.io/Companion-Brain-Lab/`.

The deployment workflow itself lives on `main`; the application code published by it does not. This preserves the experiment/main separation while respecting GitHub Pages deployment authority.

The build produces a large single JS artifact (~3.53 MB minified / ~1.17 MB gzip), largely attributable to Phaser plus the deterministic Rapier/WASM path. This remains accepted as research-apparatus cost, not a shipping-performance decision.

## Soft-contact hypothesis recovered from Owner feedback

The Owner raised a long-standing interest in a collision model where stronger pressure allows characters to enter one another slightly more instead of behaving as perfectly hard discs.

This is worth preserving as a separate hypothesis, but **must not replace the current hard-contact baseline before an A/B experiment**.

The current-best cheap model to investigate later is not a full deformable/soft-body simulation. It is a two-scale actor contact model:

1. a smaller **hard core** that remains non-penetrable and prevents tunnelling/complete overlap;
2. a larger **soft envelope** that may overlap and generates increasing spring/damping resistance as compression grows.

The visible character footprint may correspond more closely to the soft envelope, allowing stronger pressure to create limited apparent/physical compression while the hard core preserves robust collision truth.

This can remain computationally cheap: for the intended one-to-few companion scale, pairwise work is trivial; if the system later scales, the soft envelope should use the physics broadphase/sensor/contact-query mechanisms rather than an unconditional O(n²) all-agent scan. Rapier exposes sensor intersections, contact graphs/manifolds and contact-force events that can support such experiments without implementing general soft-body dynamics.

Possible later A/B questions:

- Does limited compression reduce the rigid-disc feel without creating ambiguous body ownership?
- Does it make doorway/crowding behavior more natural or merely hide poor positioning?
- Is force/penetration response stable under sustained opposing intent?
- Should softness be physical, visual-only squash, or a combination?
- Can debug rendering expose soft-envelope compression clearly enough that brain failures remain legible?

**Decision now:** preserve this as an explicit follow-up experiment. Do not block Stage B and do not teach the first local brain to depend on soft overlap.

## Evidence boundary after S0

S0 authorizes the next bounded experiment in autonomous relational positioning.

It does **not** authorize a full companion architecture, combat system, command system, LLM cognition, planner framework or shared runtime extraction.

The next experiment should preserve the hard-contact S0 baseline and make the companion's positioning policy inspectable so that body/contact failures, navigation failures and decision failures remain separable.
