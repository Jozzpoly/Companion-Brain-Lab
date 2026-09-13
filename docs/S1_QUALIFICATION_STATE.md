# S1 Relational Positioning — Qualification State

Status: **AUTOMATED PASS / OWNER-BROWSER GATE OPEN**  
Application evidence SHA: `7dca836985f4023cd2166222e67ab754d99c2e9b`  
Base physical apparatus: qualified S0 merge `448ca9c86f219d9c18a8898dfa36d0b9a82cdce1`

## Current claim

S1 is ready for browser comparison, not qualified as a successful companion behavior yet.

The exact application evidence SHA passes the full repository check:

- strict TypeScript compile: **PASS**;
- S0 physical/domain tests: **9/9 PASS**;
- S1 relational-brain tests: **8/8 PASS**;
- total tests: **17/17 PASS**;
- Vite production build: **PASS**;
- npm install audit in the qualifying CI run: **0 vulnerabilities**.

Qualifying push run: `34787946799`.

Observed production artifact on that run:

- JS: ~3,541.26 kB minified;
- gzip: ~1,175.85 kB.

The bundle remains dominated by the existing Phaser + deterministic Rapier/WASM apparatus. S1 does not materially change the current research-bundle cost.

## What is implemented

Three directly comparable companion-control modes share the same World and physics:

1. **MANUAL** — human arrow-key control; brain bypassed.
2. **CHASE** — deliberately naive direct point-following toward the player.
3. **RELATIONAL** — deterministic local probe selecting among eight relationship slots around the player.

The relational probe:

- consumes only public `WorldSnapshot` state;
- outputs only a normal `MotionIntent`;
- has no Rapier/renderer access;
- reconsiders at 10 Hz while physical/motor execution remains at 60 Hz;
- remembers the last meaningful player direction when the player is stationary;
- scores front obstruction, travel cost, slot switching/hysteresis and static candidate validity;
- keeps a previous slot for near-ties;
- exposes selected target, player direction, candidates, scores, reconsideration count and compact selection reason.

## Automated contracts established

The exact-head tests establish:

- identical snapshot + brain state yields identical candidate evaluation/selection;
- front relationship slots are penalized relative to back alternatives when the player is moving;
- near-tie alternatives do not defeat hysteresis;
- materially superior alternatives can defeat hysteresis;
- candidate points colliding with static geometry are invalidated;
- relational motor output stays bounded;
- naive chase does not mutate World snapshot state;
- tactical reconsideration is held between its scheduled ticks rather than rerunning at 60 Hz;
- S0 physical contracts remain intact.

## Deliberate omissions

S1 contains no:

- pathfinding;
- reciprocal local avoidance beyond the qualified physical contact substrate;
- combat or enemies;
- command system;
- LLM/higher cognition;
- general utility-AI framework;
- soft-contact behavior.

These omissions are intentional falsification tools. Pillar and doorway failures should reveal whether the next missing competence is navigation/yielding rather than being hidden by more machinery.

## Owner/browser gate

S1 should not be merged until browser evidence answers the comparison question:

> Does RELATIONAL produce a visibly more useful and stable spatial relationship with the player than naive CHASE, and are its failures causal enough to tell us what to build next?

Useful observations include:

- whether RELATIONAL settles beside/behind the player rather than trying to occupy the player;
- whether reversing or changing movement direction causes sensible adaptation or slot thrashing;
- whether stationary player state settles cleanly;
- how CHASE and RELATIONAL differ in head-on contact;
- whether pillar/doorway failures are clearly attributable to missing path competence;
- whether 10 Hz tactical reconsideration feels responsive enough;
- whether debug candidates/reasons correspond to the visible behavior.

## Preserved soft-contact hypothesis

The Owner-proposed hard-core + compressible-envelope idea remains explicitly deferred. The S1 browser runtime keeps S0 hard contact unchanged so relational-positioning evidence is not contaminated by a new collision model.

After S1 evidence, soft contact may become the next bounded A/B only if rigid body contact is materially limiting cooperation rather than merely looking visually raw.
