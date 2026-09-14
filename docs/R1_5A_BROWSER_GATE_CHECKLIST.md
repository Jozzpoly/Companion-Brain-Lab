# R1-5A — Owner Browser Gate Checklist

Status: **READY AS TEST PROTOCOL · EXACT R1-5A RUNTIME NOT YET PUBLISHED · OWNER PASS NOT YET RUN**

Date: 2026-09-14

Exact mechanically qualified application/runtime checkpoint:

`c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`

Mechanical qualification:

`docs/R1_5A_PLAYER_AUTHORITY_QUALIFICATION.md`

Important: the current public Pages deployment remains pinned to audited R1-4 (`8f08761...`). Do not use that public link as evidence for this R1-5A gate until the published runtime is deliberately changed to the exact qualified R1-5A checkpoint or an equivalent verified preview is provided.

## 1. Owner question

R1-5A is not asking whether the companion already cooperates intelligently in every encounter.

The narrow Owner question is:

> When NATURAL motion would otherwise carry the companion into a materially player-disturbing final command, does the final player-authority layer preserve player agency without turning ordinary movement into constant emergency clipping?

A clumsy pass can still be an R1-5A pass if player agency is preserved. Passing etiquette/right-of-way quality belongs to R1-5B.

## 2. Required setup

Use:
- companion mode `SPATIAL`;
- actuator `NATURAL` for the main gate;
- `DIRECT` as an A/B reference when useful;
- normal speed first, then slower time scale if a suspicious intervention needs inspection.

Controls:
- `N` — NATURAL / DIRECT;
- `P` — pause;
- `O` — single physics step while paused;
- `T` — time scale;
- `I` — capture causal incident JSON;
- `1` — Open;
- `2` — Pillar;
- `3` — Doorway;
- `4` — Head-on;
- `R` — reset current scenario.

## 3. What the workbench now means

Motion command arrow:
- **green** — neither final hard authority changed the command;
- **yellow** — static hard-command authority changed it;
- **red** — final player physical authority changed it.

Motion panel exposes the two final authority layers separately.

For the player hard gate inspect:
- source;
- `constrained=true/false`;
- current physical clearance;
- required hard clearance;
- original predicted physical clearance;
- final predicted physical clearance;
- reason.

The upstream S3 player buffer / longer conflict horizon remains comfort/right-of-way policy evidence. It is intentionally not the final hard physical threshold.

## 4. Core Owner rehearsals

### A — ordinary close passing

In Open and Head-on:
- cross the companion's intended path naturally;
- pass close in front of it;
- approach head-on then continue through;
- repeat from several angles.

Expected R1-5A behavior:
- player input remains physically authoritative;
- no obvious repeated companion-caused shove/push-through;
- final player hard gate should normally remain green/unchanged during clean passes;
- occasional red intervention is acceptable when genuinely needed, but continuous red clipping is a failure signal.

### B — abrupt reversal while companion carries velocity

In Open:
- let the companion establish motion;
- cross near its path;
- abruptly reverse direction or stop;
- repeat several independent episodes rather than one lucky encounter.

This is the Owner analogue of the deterministic material RED.

Expected:
- if the final player gate intervenes, it is brief and legible;
- the player should not feel physically commandeered by the companion;
- the companion should continue useful motion afterwards rather than entering a new sticky stop state.

### C — stationary obstruction / body interaction

Stand in or near the companion's current local path in Open.

Try:
- remain stationary;
- move into it late;
- release after contact/proximity;
- repeat on the same semantic relationship episode.

Expected:
- physical contact itself is not automatically a failure;
- companion-caused player displacement or obvious input loss is the important signal;
- ordinary release should recover without manual brain reset;
- `retry episode` / cumulative retry evidence should remain coherent with R1-4 behavior.

### D — static geometry + player proximity

Use Pillar and Doorway.

Move so the companion must simultaneously respect:
- hard static geometry;
- your body / requested movement.

Expected:
- a red player-authority correction must not send the companion through a wall;
- a yellow static correction must not be immediately undone by the player hard gate;
- no visible authority ping-pong;
- route/recovery remains live after the conflict clears.

### E — DIRECT vs NATURAL

Repeat at least one suspicious encounter in DIRECT.

Do not demand identical trajectories. The A/B question is whether NATURAL temporal realization introduces a player-agency failure absent under DIRECT.

R1-5A specifically exists to prevent that class.

## 5. PASS signals

R1-5A Owner PASS is justified if broad natural play supports all of:
- player movement remains under player control during ordinary conflict;
- no reproducible companion-caused push-through / motion takeover remains in the R1-5A class;
- final player hard authority is rare/bounded rather than continuous steering;
- interventions are visually/causally legible;
- static hard safety remains intact during player corrections;
- ordinary conflict release does not create a new sticky autonomous stop;
- DIRECT/NATURAL differences are actuator-quality differences, not a repeat of the material authority bug.

## 6. FAIL / reopen signals

Reopen R1-5A if any reproducible case shows:
- companion materially pushes/displaces the player despite a clean player request;
- sustained player requested-vs-actual disturbance caused by the companion;
- player hard gate continuously fires in otherwise ordinary passing;
- repeated red-command oscillation / visible clipping loop;
- player correction reintroduces hard-static collision;
- final player gate and static gate fight each other across frames;
- release from the conflict requires manual reset;
- incident trace reports player authority as safe/unchanged while the World visibly contradicts it.

Do not classify merely awkward side choice or social hesitation as an R1-5A failure unless player physical authority is actually implicated. Those observations belong in R1-5B evidence.

## 7. Incident capture

If anything suspicious occurs:
1. do not try to diagnose it manually;
2. press `I` as soon as practical;
3. preserve the downloaded incident JSON;
4. note naturally what looked wrong and, if useful, provide a screen/video recording.

Incident schema:

`companion-brain-lab-r1-causal-incident-v3`

The trace now records final player-authority source, constrained state, clearance values and reason on each causal frame.

## 8. Current release boundary

Mechanical qualification: **PASS**.

Owner/browser qualification: **NOT YET RUN**.

Public R1-5A preview: **NOT YET PUBLISHED**.

R1-5B cooperation/right-of-way authority: **NOT YET STARTED**.

Do not promote all of R1-5 from this gate alone.
