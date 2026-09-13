# S2-B Direct Traversal — Qualification State

Status: **AUTOMATED PASS / OWNER DEBUG GATE OPEN**  
Qualified application SHA: `152fc799bd87d0fdd57198d3a825df295bf29799`  
Qualifying CI run: `34789371195`

## Claim earned

The lab can now answer one bounded question without changing companion behavior:

> Can the companion's whole circular body move directly from its current position to the current autonomous target without intersecting authored static environment geometry?

The answer is exposed as a read-only World query and as causal Owner-facing debug evidence.

This does **not** mean the companion can find an alternate route, yield to the player, or detect lack of progress.

## Automated evidence

Exact application SHA passes the full repository check:

- strict TypeScript compile: **PASS**;
- S0 physical/domain tests: **9/9 PASS**;
- S1 relational-brain tests: **8/8 PASS**;
- S2-A trace tests: **4/4 PASS**;
- S2-A workbench tests: **2/2 PASS**;
- S2-B direct-traversal tests: **6/6 PASS**;
- total: **29/29 PASS**;
- Vite production build: **PASS**;
- npm install audit in the qualifying run: **0 vulnerabilities**.

Production artifact on the qualifying run:

- JS: ~3,553.00 kB minified;
- gzip: ~1,179.29 kB.

## S2-B query contract

The public query lives behind `LabWorld.directTraversal(...)`; callers do not access Rapier directly.

The query:

- sweeps a circle matching the queried actor radius;
- reports clear vs blocked;
- ignores player/companion dynamic colliders on purpose;
- reports the first static blocker label;
- reports total distance, hit distance and normalized hit fraction;
- reports hit-center, contact point and contact normal;
- does not advance the domain tick or mutate World state.

Keeping dynamic actors out is deliberate. Static route feasibility and player/companion right-of-way are separate research questions and should not be conflated.

## Important Rapier compatibility finding

`@dimforge/rapier2d-deterministic-compat` 0.20 does not expose the generic JavaScript `QueryPipeline` API used by current general Rapier documentation. The lab therefore stays on the supported `World.castShape(...)` surface.

In this compat build, scene-query broad-phase data becomes usable after a physics step. The physical substrate performs one zero-gravity, zero-velocity internal warm-up step during construction while `LabWorld` remains at domain tick 0. Existing S0 reset and repeatability tests pass unchanged, qualifying this workaround for the current research apparatus.

The compat wrapper's returned witness/normal coordinates are preserved directly by the adapter and tied to authored geometry by regression tests instead of being re-transformed speculatively.

## Owner workbench additions

The qualified S2-B browser workbench adds:

- whole-body corridor visualization, not a center ray;
- green clear vs red blocked direct traversal;
- target body outline;
- blocked hit-center body outline;
- contact-point marker;
- contact-normal vector;
- blocker name, hit distance/fraction and geometric values in HUD;
- semantic `nav.direct.clear` / `nav.direct.blocked` events only on state transitions;
- the same NAV values embedded in the bounded incident bundle produced by `I`.

`B` still cycles `PLAY -> BRAIN -> NAV -> MOTION -> ALL`.

## Explicitly not solved

S2-B contains no:

- alternate route search;
- waypoint following;
- progress/stuck classifier;
- dynamic obstacle prediction;
- doorway right-of-way or yielding;
- local avoidance/crowd system;
- soft collision;
- combat, command or LLM logic.

The known S1 doorway failure is therefore expected to remain reproducible. The purpose of the S2-B Owner gate is to make that failure substantially more legible before S2-C changes behavior.

## Next gate

Use the known `pillar` and `doorway` failures in NAV or ALL debug and verify that the displayed corridor/blocker evidence agrees with what is visually happening.

If the workbench evidence is trustworthy, S2-C may begin minimal deterministic static routing using the same direct-traversal primitive. Routing should be rejected if it cannot expose its graph/segments/waypoints and rejection reasons through this workbench.
