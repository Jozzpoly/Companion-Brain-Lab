# First Teammate Situation — S0/S1 Plan

Status: **S1–S4 MACHINE-QUALIFIED BOUNDED STACK · PARTICIPANT PATH MACHINE PASS / PRE-OWNER FAIL · READINESS GATE ACTIVE**
Date: **2026-09-20**

Parent authority:

- [CURRENT.md](CURRENT.md)
- [COMPANION_EXECUTION_CONTROLLER.md](COMPANION_EXECUTION_CONTROLLER.md)
- [INITIAL_RESEARCH_SKELETON.md](INITIAL_RESEARCH_SKELETON.md)
- [RETROSPECTIVE_T4_T5_MECHANISM_AND_MISSING_BRAIN_AUDIT.md](RETROSPECTIVE_T4_T5_MECHANISM_AND_MISSING_BRAIN_AUDIT.md)

---

## 1. The question

The next specimen is not trying to prove “combat AI”.

It is trying to create the first situation in which the companion must be more than a movement relationship.

Primary question:

> **Can player and companion participate in the same material problem strongly enough that attention, responsibility, initiative and correction become real research questions rather than labels attached to movement?**

---

## 2. Situation comparison

### Candidate A — another movement/chokepoint + commands

Advantages:
- cheap;
- strong existing donor support;
- easy to measure.

Rejection as first situational-teammate specimen:
- accepted Foundation organism can already produce much of the visible behavior;
- commands would mostly steer relationship/movement;
- high risk of another “movement era” Owner gate;
- weak pressure for attention, responsibility and material assistance.

Disposition: **keep as regression/supporting scenario, not primary specimen.**

### Candidate B — further Stage B advancing threat proxy

Advantages:
- already implemented;
- exercises external responsibility selection.

Rejection:
- Owner explicitly rejected its product expression;
- success is proximity/time based;
- threat is outside the ordinary embodied World actor/action contract;
- too easy to deepen because the code already exists.

Disposition: **regression fixture / donor only.**

### Candidate C — invented non-combat cooperative task

Examples might include carrying, activating, guarding or manipulating a shared object.

Advantages:
- can expose cooperation without combat;
- could later broaden the laboratory.

Why not first:
- requires inventing a new task/gameplay domain largely for methodological cleanliness;
- weaker connection to the Owner's long-standing combat/pre-combat interest;
- likely comparable or greater world-interaction cost;
- risks spending time proving a task whose importance to the target game is still speculative.

Disposition: **legitimate future rival; not first choice.**

### Candidate D — compact shared danger with a pre-contact window

Advantages:
- directly aligned with original combat + preparation-for-combat intent;
- naturally creates “something besides the player deserves attention”;
- supports before/during/after episode structure;
- player and companion can both participate;
- initiative can help or interfere;
- low-cost correction can become meaningful;
- provides a real place to investigate readiness, engagement and disengagement without committing to a combat framework.

Risk:
- easy to overbuild into combat architecture;
- easy to recreate Stage B as a fancier red object;
- can let companion steal the encounter if the first action is too powerful.

Disposition:

> **PROMOTE TO S1 APPARATUS HYPOTHESIS.**

This promotion authorizes building/qualifying the situation substrate only. It does not authorize a combat AI, final hostile representation, final command system or final action vocabulary.

---

## 3. Required episode shape

The apparatus must be capable of this causal sequence before any autonomous companion brain is added:

`CALM → WARNING/APPROACH → HOSTILE COMMITMENT/WINDUP → PLAYER OR COMPANION CAN INTERVENE → WORLD OUTCOME → RECOVERY/RE-APPROACH OR EPISODE END`

Important property:

> there must be a meaningful interval before consequence in which behavior can communicate preparation/readiness.

If the episode reduces to “object enters radius → result”, reject the apparatus.

---

## 4. Minimum material world vocabulary

S1 should add only the concepts needed to host the situation.

### Dynamic problem source

One material embodied problem source in the same authoritative World progression.

Working role name: **hostile**.

This is a test-domain label, not a final game taxonomy.

Requirements:
- has a physical position/body;
- can approach through the same world geometry;
- participates in contacts/visibility/debug as a real entity;
- has a deterministic apparatus policy during S1;
- does not use the future companion brain.

### Hostile episode state

Minimum world-owned public state sufficient to create a pre-contact window:

- `APPROACHING`;
- `WINDUP`;
- `RECOVERING/STAGGERED` or equivalent;
- factual attack/impact outcome.

Exact enum names are implementation-open.

Do **not** add:
- general behavior tree;
- health/stats system;
- inventory/weapons framework;
- factions;
- aggro tables;
- multiple enemy types.

### Explicit material action

Movement alone must not count as success.

S1 needs one short-range explicit action attempt available symmetrically to:

- player;
- manually/trivially controlled companion.

Working semantic name: **DISRUPT / INTERVENE**.

The exact visible fiction may later become strike, block, shove, guard-break or something else.

Contract:
- actor attempts;
- target is explicit;
- World checks factual spatial/state preconditions;
- attempt can succeed or fail;
- result is recorded;
- successful attempt changes hostile episode state;
- proximity without attempt is insufficient.

This is the first deliberate seam:

`movement intent ≠ action attempt ≠ World outcome`.

---

## 5. Why not HP/damage yet

The first question is whether shared material intervention creates a useful teammate situation.

HP would introduce:
- tuning;
- damage ownership;
- death;
- DPS;
- health UI;
- repeated attack loops;
- incentives unrelated to the first teammate question.

S1 therefore prefers episode-state consequence over a general damage model.

Possible bounded factual consequences:
- hostile action interrupted;
- hostile action lands;
- hostile forced into recovery/stagger;
- attempt misses / invalid / too far / wrong phase.

A visible “player was hit” event is enough for the apparatus if it is materially legible; health need not exist yet.

If this proves too consequence-light to create meaningful player judgement, that is evidence for the next replan—not permission to silently add an RPG combat stack.

---

## 6. World-step contract to design before code

The eventual API shape is open, but responsibilities must remain separate.

Conceptually:

`external movement intents + external action attempts + deterministic world problem state → ONE World step → physical snapshot + action outcomes + episode outcome`

Required invariants:

1. exactly one authoritative World progression per simulation tick;
2. cognition never declares hit/interruption/success;
3. hostile apparatus cannot advance on a separate side-loop clock;
4. movement and action attempts may coexist in the same tick;
5. action validation uses authoritative World state/geometry;
6. outcome records enough provenance to explain success/failure;
7. physics/body truth remains source of spatial legality;
8. historical player/companion movement regressions remain available.

### Ordering decision that S1 must make explicitly

Before implementation, choose and test the within-tick order for:

- movement realization;
- action validation;
- hostile windup/attack resolution.

Do not let incidental code order define last-moment intervention semantics.

---

## 7. Manual/simple baseline

Before any autonomous responsibility selector:

### Player
- normal WASD movement;
- one explicit intervention key/button.

### Companion
Use an existing manual/trivial control path for S1 qualification.

The companion must be able to:
- move;
- issue the same intervention attempt;
- succeed/fail under the same World rules.

No “smart” targeting is needed.

### Hostile
Deterministic apparatus policy only:
- approach;
- telegraph/wind up;
- resolve if uninterrupted;
- recover/restart/finish according to a fixed bounded script.

### Baseline qualification questions

Can a human/operator intentionally produce all of these?

- player intervenes successfully;
- manual companion intervenes successfully;
- intervention fails because of range/state;
- nobody intervenes and hostile consequence lands;
- both attempt and World resolves deterministically;
- the episode remains understandable without reading debug labels.

If not, **do not add AI**.

---

## 8. Debug requirements for S1

Full workbench remains available.

Add only public causal state needed by the apparatus:

- hostile position/body;
- hostile episode phase;
- current factual target if one exists;
- action attempt actor/kind/target;
- validation result;
- rejection reason where applicable;
- World outcome;
- recent episode transition.

Player-facing display should not become a debug dashboard.

The world itself should communicate:
- approach;
- windup/commitment;
- interruption/recovery;
- landed consequence.

If those are only understandable in the panel, S1 fails its readability gate.

---

## 9. Claim budget

### S1 may claim

If qualified:

> the laboratory now contains one authoritative shared situation in which player and companion can each materially act on the same problem and World determines the consequence.

### S1 may not claim

- companion notices threats intelligently;
- companion knows when to help;
- combat AI exists;
- readiness AI exists;
- command system works;
- autonomy is good;
- teammate feel improved;
- the selected hostile/action fiction is final.

---

## 10. S1 falsifiers

Stop/replan if:

1. hostile is still effectively a visual marker with a timer;
2. merely standing near it counts as intervention;
3. action outcome is declared outside World;
4. player cannot materially affect the same problem;
5. manual companion participation is awkward enough that the situation itself is unclear;
6. apparatus requires health/inventory/animation/faction framework before it is playable;
7. existing Foundation movement must be rewritten without a concrete incompatibility;
8. debug explains the situation better than visible world behavior;
9. interaction cannot produce both useful and failed outcomes;
10. deterministic hostile policy becomes an accidental “enemy AI architecture”.

---

## 11. Implementation tranches after this design

### S1-A — contract-only

Design and test:
- embodied hostile/world entity representation;
- action-attempt type;
- World action-outcome type;
- within-tick ordering;
- zero brain authority.

No browser/Owner claim yet.

### S1-B — physical apparatus

Add:
- one Open-like authored situation;
- deterministic hostile body/state progression;
- action validation/effects;
- player/manual-companion input path;
- visual telegraph and outcome.

### S1-C — apparatus qualification

Machine/browser evidence must demonstrate every baseline outcome and preserve Foundation survival regressions.

Then inspect the recording participant-first.

Only if S1 passes, re-plan S2 from actual evidence.

---

## 12. What S2 would ask — not authorize

If S1 passes, the next likely research question is:

> **What is the smallest situated public state that lets the local brain decide that this problem deserves attention and that it should own some responsibility for it?**

That may require:
- perception/attention evidence;
- focus identity;
- responsibility state;
- preparation/engage/disengage transitions.

Do not implement those during S1 merely because they are foreseeable.

---

## 13. Promotion decision

**S0 result:** compact shared danger with a pre-contact window is promoted from leading idea to the bounded situation hypothesis for S1.

**Authority granted:** design and qualify apparatus only.

**Authority not granted:** autonomous threat cognition, combat system, command grammar, HP, final enemy representation or Owner test.

Reopen S0 if S1 falsifiers show that this situation cannot create a clean, low-scope shared problem.


---

## 14. S1 qualification result — 2026-09-20

Qualified head:

`ae7d6bc5394194840dbb9a0b29a4924be406eaeb`

Browser gate:

`s1-shared-danger-browser #7 · SUCCESS`

### Evidence actually earned

The implemented apparatus now demonstrates:

- hostile state progresses inside the authoritative World step;
- movement happens before action validation, then all attempts are validated against the same post-physics frame and pre-resolution phase;
- attempt ordering cannot select the winner;
- proximity alone does not interrupt;
- player and manual companion use the same `INTERVENE` attempt/outcome contract;
- invalid phase and out-of-range attempts fail factually;
- no intervention can produce `PLAYER_HIT`;
- player motion during commitment can produce `ATTACK_MISSED`;
- successful intervention produces `INTERRUPTED`;
- encounter completion and provenance survive later ticks/reset;
- the full causal workbench can remain available while participant screenshots are captured with it collapsed.

### Promotion

S1 is **MACHINE-QUALIFIED as apparatus**.

It is **not** Owner-qualified teammate behavior and does not claim combat AI, readiness AI, useful autonomy or command quality.

### Important claim limits discovered during falsification

1. The hostile currently uses a non-solid Rapier sensor and deterministic direct-to-player motion in an open field. This is sufficient for the current action/outcome seam, but not evidence for solid embodied contact, obstacle negotiation or enemy architecture.
2. The participant presentation is abstract by design.
3. In the manual-companion success artifact the companion can be visually occluded under the hostile. The causal workbench proves who acted, but participant-first action provenance is not yet product-grade.
4. These limitations must not silently become permanent architecture merely because S1 passed.

### S2 authorization

Proceed only to a **zero-action-authority** situated-attention/responsibility spike.

S2 must separate:

`external problem observed → focus candidate → responsibility judgement → public reason`

from:

`movement/action execution`.

The companion must be able to notice without owning, own without immediately acting, and withdraw responsibility when its causal basis disappears. The player remains a first-class situated reference.

At least one counterfactual must hold where hostile phase is the same but responsibility differs because relevant spatial/relational facts differ. Otherwise S2 is only a renamed phase table and should be rejected.

No command grammar or autonomous intervention is authorized until S2 earns this bounded claim.


---

## 15. S2 qualification result — 2026-09-20

Qualified code/evidence path:

- `situated-responsibility.ts`;
- counterfactual unit tests;
- `s2-situated-responsibility-browser #1 · SUCCESS`.

### Claim earned

For the one known shared-danger problem, the local brain can keep **attention** separate from **responsibility**.

The same hostile `WINDUP` does not imply the same judgement:

- player at material risk + companion can reach intervention range before consequence → `OWNED`;
- player at material risk + companion cannot get there in time → `NONE`;
- player already outside attack range → `NONE`.

`APPROACHING` is monitored without premature ownership; `RECOVERING` remains relevant while active responsibility is withdrawn.

S2 has zero movement/action authority.

### Claim not earned

- general attention selection;
- multiple-problem prioritization;
- path-aware tactical reachability;
- threat understanding beyond this bounded apparatus;
- broad cognition or teammate quality.

The straight-line reach estimate is an explicit open-field fixture approximation.

---

## 16. S3 qualification result — 2026-09-20

Qualified head:

`9aec423bbadf2aa7bb6794d5a7c6d970fe17b958`

Browser gate:

`s3-material-contribution-browser #1 · SUCCESS`

Supporting regressions on the shared code state `2a46a03…`:

- `s1-shared-danger-browser #12 · SUCCESS`;
- `s2-situated-responsibility-browser #3 · SUCCESS`;
- `command-autonomy-browser #12 · SUCCESS`.

### Claim earned

An explicitly enabled, fixture-local S3 authority can consume S2's **earned responsibility** and produce one material contribution:

- while `OWNED` and out of range, companion uses a provisional open-field approach;
- once in authoritative intervention range, it submits the same companion `INTERVENE` World attempt used by S1;
- World, not cognition, declares `INTERRUPTED`.

The inverse cases were also demonstrated:

- unearned/unreachable responsibility → S3 proposal `NONE`, no action, possible `PLAYER_HIT`;
- player leaves attack range → S2 responsibility is withdrawn → S3 becomes `NONE` → World can resolve `ATTACK_MISSED` with no companion interruption.

This is the first bounded machine evidence that local situated judgement can cause a useful material change in the same situation without necessarily stealing the player's outcome.

### Claim not earned

- teammate feel;
- combat AI;
- final approach/movement policy;
- general engagement/disengagement;
- final hostile/action fiction;
- trust, initiative quality or Owner acceptance.

S3 remains apparatus-scale autonomy.

### Evidence caveat

The artifact frame named `01-owned-before-contribution` advanced past the intended temporal point before screenshot capture. It must not be used as image proof that the frame is pre-action. The browser assertion and later World-outcome evidence remain valid.

---

## 17. S4 authorization — corrigibility without puppeteering

S4 is now authorized because there is finally autonomous behavior worth correcting.

Do not begin with a full command system.

First research question:

> **Can the player withhold the current autonomous companion contribution while the companion's own situated judgement and raw proposal remain intact?**

Use one bounded correction control:

`WITHHOLD THIS COMPANION INTERVENTION`

Desired causal separation:

`S2 responsibility → S3 raw proposal → S4 correction/arbitration → effective contribution → World outcome`

Required counterfactuals:

1. **No correction:** S3 can autonomously help.
2. **Correction active:** S2 may still be `OWNED`, raw S3 may still propose help, but effective companion movement/action is suppressed.
3. **Player acts while correction holds:** player can resolve the same problem; companion must not steal the result.
4. **Correction released before consequence:** if S2 still owns responsibility, the autonomous contribution can resume without a second player instruction.

This control is research apparatus, not final command vocabulary or UX.

Do not promote the old F1/F2/F3 / `AT_WILL / FOLLOW_ME / HOLD_HERE` spike until richer player-direction questions actually require it.


---

## 18. S4 qualification result — 2026-09-20

Browser gate:

`s4-corrigibility-browser #1 · SUCCESS`

### Claim earned

Player correction can sit after situated judgement/raw autonomous proposal and before execution.

The machine-qualified causal chain is now:

`S2 responsibility → S3 raw proposal → S4 correction constraint → effective movement/action → World outcome`.

A correction can block effective companion execution while:

- S2 remains `OWNED`;
- raw S3 contribution remains inspectable;
- player still acts through the same World contract;
- release restores still-valid autonomy.

This is a corrigibility seam, not a final command system.

---

## 19. Integrated participant path result — 2026-09-20

Route:

`?teammate=1`

Qualified run:

`teammate-participant-browser #4 · SUCCESS`

Machine evidence proves:

- specimen starts directly in the shared situation;
- bounded autonomy is active without debug toggling;
- manual participant control of the companion is removed from the normal surface;
- hold-`Q` temporarily constrains contribution;
- player can own the outcome while correction holds;
- release restores autonomy;
- the full workbench remains expandable in the same runtime.

### Pre-Owner verdict

**FAIL / NOT READY FOR OWNER GATE.**

Participant artifact review shows that the experience still presents mostly as three colored circles on an empty field. This would repeat the failure mode already rejected by the Owner: a materially richer hidden mechanism whose visible product delta is too weak.

Do not route this build to the Owner merely because the participant browser gate is green.

---

## 20. Readiness authorization — make awareness visible before commitment

Next question:

> **Can the companion visibly prepare for an approaching shared problem before it owns an intervention, while staying player-local and without turning preparation into premature combat?**

Bounded candidate:

- `APPROACHING`;
- S2 `TRACKING`;
- S2 responsibility `NONE`;
- one player-anchored hostile-facing intercept flank;
- movement/preparation only;
- no `INTERVENE` attempt;
- hold after reaching the off-axis flank;
- `WINDUP` remains the transition into the existing S2→S3 contribution path.

This tranche also authorizes only the minimal semantic world rendering needed to make readiness and action provenance participant-readable. It does not authorize a general art pipeline or cosmetic milestone.


### Readiness representation correction — artifact falsification

The first machine-qualified readiness implementation placed the companion directly on the player→hostile axis. Browser mechanics passed, but participant artifact review rejected that representation: the S1 hostile is a sensor and can pass through the companion, so an on-axis posture visually promises a body-block that does not materially exist.

This is a representation FAIL, not a reason to promote solid-body combat physics prematurely.

The revised bounded hypothesis is an **off-axis player-local intercept flank**:

- slightly forward from the player toward the hostile;
- laterally displaced from the hostile's direct player-bound path;
- close enough that a later committed hostile can still be explicitly interrupted within the existing World action range;
- preparation movement cannot itself block or resolve the hostile;
- reaching the flank becomes `HOLDING_READY` until the causal situation changes.

This correction preserves the key S1 invariant `movement ≠ intervention` while making pre-contact preparation spatially distinct.

---

## 21. Readiness qualification and S7 promotion — 2026-09-21

The off-axis readiness hypothesis has passed its bounded machine gate.

Qualified behavior:

`TRACKING / responsibility NONE → GUARDING → HOLDING_READY → player moves → player-local flank re-anchors → WINDUP → readiness NONE → S2/S3/S4 authority → factual World outcome`

The rehearsal proves:

- readiness is visible movement, not only a label;
- it stays player-local instead of chasing the hostile;
- flank side remains stable through player movement;
- preparation emits no `INTERVENE`;
- correction `Q` constrains intervention rather than globally freezing readiness;
- release restores still-valid autonomous contribution;
- the shared World remains final outcome authority.

The corresponding immutable public candidate is:

`cef9028c5cbc825ed43197da605c10e2251c53c1`

Public deployment:

`https://jozzpoly.github.io/Companion-Brain-Lab/teammate-readiness/?teammate=1`

Run `35634004556` passed build, exact candidate checks, Pages deploy, historical-surface preservation and public candidate smoke with exact provenance.

### Promotion

S1–S4 plus readiness are now sufficient for the first integrated Owner teammate gate.

This is **not** promotion to combat AI, tactical AI, final commands or product-ready teammate behavior.

The next question is experiential:

> **Does the integrated causal chain read and feel like a companion sharing the player's situation, or does it still collapse perceptually into an instrumented follower?**

Until that judgement exists, do not expand the situation merely to accumulate more machine-qualified mechanisms.

