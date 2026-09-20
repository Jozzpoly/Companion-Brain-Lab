# First Teammate Situation — S0/S1 Plan

Status: **S1 MACHINE-QUALIFIED APPARATUS · S2 SITUATED-RESPONSIBILITY DESIGN AUTHORIZED · NO AUTONOMOUS ACTION AUTHORITY**
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
