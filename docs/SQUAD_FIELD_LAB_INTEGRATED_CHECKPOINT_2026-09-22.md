# Squad Field Lab Integrated Checkpoint — 2026-09-22

Status: **MACHINE-QUALIFIED BROAD MANUAL SQUAD SUBSTRATE · NOT OWNER-READY · AUTONOMY NOT PROMOTED**

Qualified source:

`199c3d07d587660c5902b0fc3c7562d1850c545b`

Qualification run:

`squad-field-lab-browser · run 35719945581 · SUCCESS`

Artifact:

`squad-field-lab-browser-199c3d07d587660c5902b0fc3c7562d1850c545b`

## What is now demonstrated

One persistent Field Lab runtime can materially support:

- 1–4 real Rapier companion bodies;
- real roster shrink/grow rather than UI-only visibility;
- single selection, additive multi-selection and focused companion;
- direct manual control as a distinct authority source;
- selection-scoped FOLLOW / HOLD / MOVE;
- world-space movement responsibility;
- editable formation geometry;
- presets as geometry generators, not opaque formation enums;
- live spacing / response / tolerance dynamics;
- slot dragging in world space;
- multiple physical layout fixtures as an independent experiment axis;
- preservation of squad control state across layout changes;
- preservation of live body positions across experimental World rebuilds;
- TRAINING → PRESSURE transition without discarding the authored squad setup;
- continuous cooperative pressure in the same runtime;
- material REPEL contribution from an extra squad member;
- material joint contribution from multiple selected squad members;
- player-owned material outcome while a squad is present;
- no-action PLAYER_HIT consequence;
- recovery into later pressure cycles without resetting squad assignments;
- selection-aware group/focused debug and pressure provenance.

The exact browser rehearsal summary reports all qualification outcomes true and no page, console or request errors.

The full repository compile/unit/build gate also passed in the same run.

## What the artifact red-team says

The three-column composition:

`controls | world | focused debug`

is materially clearer than the earlier overlay-HUD version. Controls no longer cover the playable world.

Selection/focus and spatial targets are readable in the world without requiring the debug panel.

Pressure has participant-visible material state:

- a visible threat body and active-pressure cue;
- green contribution provenance after REPEL;
- red player consequence after no action;
- repeated cycles rather than reset ceremony.

The runtime is still intentionally technical and abstract. That is acceptable for the laboratory stage.

One deliberate rough edge remains visible: permissive authored formation/order targets can become invalid or unreachable. The Field Lab exposes this as `INVALID_TARGET` rather than silently correcting the Owner's command. This remains research evidence for later adaptive formation behavior.

## Important falsifications encountered while qualifying

Several red runs were evidence problems rather than reasons to mutate gameplay blindly:

1. A companion-contact test incorrectly required contact to still exist at the final tick. It was corrected to temporal contact + motion-error evidence.
2. A pressure rehearsal assumed FOLLOW would magically place C2 in REPEL range. It was corrected to author C2's intercept position through the real squad-control surface.
3. A preservation assertion compared PRESSURE against an older coordinate even though C4 had legally moved after unpause. It was corrected to compare against the immediate pre-rebuild physical state.

These corrections preserve the principle:

> do not change runtime merely to satisfy a bad test oracle.

## Claim budget

May claim:

- broad manual multi-companion substrate exists and is machine-qualified;
- additional companion bodies are physically real;
- squad control affects real embodied motion;
- formation geometry is directly editable;
- several spatial layouts can reuse the same authored squad state;
- continuous cooperative pressure can be exercised with the same squad;
- C2–C4 can participate in the cooperative material action contract without widening historical S1–S4 ActorId semantics;
- player/group/no-action outcomes are world-owned and repeat across cycles.

Must not claim:

- good multi-companion AI;
- teammate feel;
- autonomous formation adaptation;
- tactical intelligence;
- final command UX;
- final formation system;
- combat AI;
- polished game presentation;
- Owner PASS.

## Current research frontier

Do not collapse back to another narrow mechanism demo.

The next work should make the Field Lab increasingly useful as a **free exploratory instrument**, not merely extend the scripted qualification sequence.

Priority pressure now shifts toward:

- richer manual setup and faster re-authoring of squad experiments;
- robust formation behavior through narrow spaces / obstacles without magic correction;
- clearer separation between authored order, temporary direct correction and future autonomy;
- experiment capture / restore / comparison so useful Owner-authored configurations become reproducible evidence;
- only then progressively hand repeated manual responsibilities to local autonomy.

Owner testing should happen when the sandbox is broad enough to support unscripted exploration, not because this machine gate is green.
