# OS-PREP-5 — Owner Sandbox Candidate Plan

Status: **PRE-IMPLEMENTATION PLAN · RUNTIME BASE SUBJECT TO FULL #1349 REGRESSION**
Date: **2026-09-19**

Planning branch:

`planning/os-prep4-owner-sandbox-transition`

Runtime base under qualification:

`6e1c605fa9574de8a1de0753c5b741ffd7611293`

This document is intentionally narrow. It does not redesign Companion behavior. It defines the smallest packaging step needed to turn the qualified research runtime into an honest Owner-facing sandbox.

## 1. Objective

Produce one exact browser build in which the Owner can:

- open one stable URL;
- move immediately with the current baseline companion;
- encounter the existing Open / Pillar / Doorway / Head-on spaces without terminal work;
- judge behavior before reading research explanation;
- capture an interesting moment in one action;
- leave causal reconstruction to the agent;
- deliberately enter research/P2 tooling only as a separate later mode.

The candidate must expose the organism we actually have, including known pathologies. It is not a polishing pass.

## 2. Runtime boundary

Packaging must preserve:

- authoritative gameplay baseline: `SPATIAL / NATURAL`;
- automatic A1 authority: **OFF**;
- P2 automatic authority: **NONE**;
- current World / Rapier truth;
- current relationship, routing, spatial locomotion, temporal realization and recovery behavior.

Do not fix as part of packaging:

- PH-02 retained-semantic stale-contact pathology;
- PH-07 deterministic router tie-bias;
- PH-01/PH-08 upstream discontinuities hidden by NATURAL realization;
- any other behavior merely because the Owner candidate exposes it clearly.

A packaging commit that changes teammate behavior invalidates the separation and must be treated as a gameplay experiment instead.

## 3. Participant surface

The ordinary Owner entrypoint should not open into the full R1 causal workbench.

Minimum candidate behavior:

- explicit participant query/mode, provisionally `?owner=1`;
- causal/debug panel collapsed or absent from the ordinary visual surface;
- current WASD movement remains unchanged;
- scenario selection remains quickly available;
- one-action incident/bookmark capture remains available;
- research vocabulary, A1 controls and P2 controls are not shown by default.

Prefer reuse of existing controls over a new UI system.

The candidate does not need final game UI. It needs a low-friction experimental surface.

## 4. Provenance / immutable identity

The current Pages workflow is not suitable:

- it deploys old Foundation SHA `b217943e...`;
- it does not bind `VITE_SOURCE_SHA` to the deployed application source.

The Owner candidate deploy must:

1. checkout one exact candidate SHA;
2. build with `VITE_SOURCE_SHA` equal to that exact SHA;
3. validate that the client reports `PINNED_SOURCE_SHA`;
4. ensure a downloaded incident carries the same SHA;
5. deploy that exact built artifact, not the moving branch head.

A convenient URL is not evidence of identity.

## 5. Candidate-specific browser qualification

Before deployment, add one bounded browser specimen for the participant entrypoint.

It should verify at minimum:

- participant mode loads without runtime/browser/request faults;
- gameplay begins on the intended baseline;
- A1 automatic authority is OFF;
- P2 is unavailable unless explicitly entering research mode;
- Owner movement advances the World normally;
- at least one scenario change/reset works;
- one-action incident capture succeeds;
- incident build identity exactly matches CI `GITHUB_SHA`;
- capture does not advance World state or mutate authority;
- participant presentation does not accidentally expose the research debugger.

Do not replay the entire OS-PREP campaign in this test.

## 6. Deployment boundary

Do not repoint the public Pages deployment until the candidate-specific specimen and ordinary validation are green.

Deployment should be a separate operational change from candidate implementation so that:

- runtime qualification has an exact immutable SHA;
- deployment can pin that already-qualified SHA;
- a Pages failure cannot be confused with gameplay qualification.

After deployment, perform an artifact-level/browser smoke check against the public URL and compare reported build identity with the pinned candidate.

## 7. Owner run boundary

The first Owner run is not a scripted QA checklist.

Sequence:

1. free encounter / natural movement;
2. only then a few short provocations if useful;
3. save/bookmark moments that are surprising, bad, good or hard to read;
4. preserve Owner interpretation before exposing causal explanation;
5. P2 intervention belongs to a later explicit research pass, not the first participant run.

Known phenomena worth allowing to arise naturally:

- slow movement / pace matching;
- turns, stops and reversals;
- open-space passing;
- doorway separation and reacquisition;
- pillar/topology route choice;
- stale post-expiry close-contact behavior.

## 8. Exit gate

OS-PREP-5 is complete when:

> the Owner can open one exact pinned build, play immediately on a clean participant surface, capture an interesting moment without technical work, and Browser GPT can later prove which exact runtime and causal window produced it.

That is the point at which further pre-Owner apparatus work should stop unless the package itself reveals a blocker.
