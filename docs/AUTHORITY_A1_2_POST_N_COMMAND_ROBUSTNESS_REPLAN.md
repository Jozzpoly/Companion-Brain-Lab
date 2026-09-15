# Authority-A1.2 — Post-n concrete-command robustness replan

Status: **CANONICAL POST-A1.2n REPLAN · FIRST G4 MILESTONE QUALIFIED · ZERO GLOBAL SELECTION / ZERO MOVEMENT AUTHORITY**

Date: 2026-09-15

Parent checkpoint:

- exact qualified A1.2n head: `ef8d1d2da942e7737181c684eb6d2160ad303bd6`
- validate #981: 92/92 test files, 462/462 tests, production build and inherited Chromium audit PASS
- A1.2n result: under one exact player counterfactual, asymmetric cooperation can prefer a generated G3-clear companion future over a generated future that creates avoidable reciprocal player contact, without family-label semantics, comfort radius or global selection authority

This replan exists because A1.2n changes the composition problem in two important ways:

1. G4 is currently a **relation between alternative futures**, not a scalar property of one candidate;
2. the current candidate generator is **conditioned on one player-future velocity**, so the same candidate family label under H1 and H2 can denote different concrete companion commands.

A selector built before resolving those facts would be structurally misleading even if its tests passed.

---

## 1. Current live truth

A1.2 now has separately qualified pieces for:

- explicit player-future hypotheses H1/H2/H3;
- causal future interventions with unresolved H2 preserved rather than substituted;
- compact companion velocity hypotheses;
- G0/G1/G2 static qualification;
- same-physics player+companion rehearsal;
- hard-body trace evidence;
- G3 hard-body policy;
- player-agency trajectory evidence;
- bounded pairwise G4 avoidance of new reciprocal player contact.

The major remaining composition questions are no longer “can we simulate?” or “can we detect contact?”. They are:

1. what exactly is the identity of the **one companion command** we may later execute;
2. how does that same command behave under several distinct, causally honest player futures;
3. how should pairwise cooperation relations coexist with relationship utility without becoming weighted score soup;
4. what uncertainty/robustness policy is justified for H1/H2/H3;
5. only then: how may one shadow winner be chosen and temporally embodied.

---

## 2. Critical finding: family identity is not command identity

`buildA1CompanionCandidateSet` consumes one `playerFuture.velocity`.

Therefore:

- `PLAYER_FEED_FORWARD` under H1 can differ from `PLAYER_FEED_FORWARD` under H2;
- every radial/tangent alternative is centered on the supplied player-future velocity and can therefore differ across H1/H2/H3;
- capability clipping can also cause differently generated desired velocities to collapse onto the same executable `commandVelocity`;
- the current seed `id` is derived from family name, so it is not sufficient cross-future command provenance.

Consequently, **robustness must never compare family labels across futures as if they were the same action**.

The object that robustness evaluates must be one concrete world-unit companion command held fixed while the player counterfactual changes.

---

## 3. Critical finding: unresolved future is not an adverse outcome

H1 and H2 are normally both present as hypotheses. H3 is additionally present when stop/reversal/body-causality uncertainty creates a transition reason.

After A1.2h:

- H1 is rehearsable as `OWNER_REQUEST_PERSISTS_COUNTERFACTUAL`;
- H3 is rehearsable as `TRANSITION_HOLD_COUNTERFACTUAL`;
- H2 is rehearsable only when body provenance is `OWNER_DIRECTED`;
- H2 remains explicitly unresolved for `STATIONARY`, `OWNER_CONSTRAINED`, `EXTERNAL_MOTION_EVIDENT` and `MIXED_OR_UNCERTAIN`.

A robustness profile must preserve three different states:

1. **REHEARSED** — this counterfactual can honestly be executed in the shadow World;
2. **UNRESOLVED** — evidence exists, but promoting it into repeated control would be causally dishonest;
3. **ABSENT** — this future family is not part of the current hypothesis set (notably H3 outside transition conditions).

`UNRESOLVED` must not count as a collision, a bad score, a zero, or a fallback to H1/H3.

---

## 4. G4 must remain relational

A1.2n proves one bounded pairwise rule:

- if one otherwise comparable future passes G3 and another creates new reciprocal player contact under the same player future, prefer the G3-pass alternative;
- if both pass G3, G4 creates no preference;
- if both require G4 because both create new reciprocal contact, report forced contention rather than inventing a winner.

This means G4 cannot be safely represented as one `cooperationScore` attached to a candidate.

Future composition should preserve:

- **per-command evidence profiles**; and
- **pairwise cooperation relations** between commands for one exact player future.

A later selector may use the cooperation relation to construct a viable/frontier set. It must not allow a small relationship-utility advantage to compensate for avoidable new player contact.

---

## 5. Revised bounded sequence

### A1.2o — concrete command proposal provenance

**Generation/provenance only. No physics. No G3/G4. No selection.**

Goal: convert player-future-conditioned seed generation into a deterministic set of concrete DIRECT command proposals with explicit generation origins.

For every **rehearsable** player future in the A1.2h intervention plan:

1. generate the normal A1.2b seed set using that future's repeated velocity;
2. tag each generation origin with future id/family/causal meaning + seed family/local-basis provenance;
3. realize the seed through current DIRECT capability clipping;
4. identify proposals by the resulting concrete `commandVelocity`, not by family label alone;
5. deduplicate executable commands that collapse to the same command velocity while retaining **all** generation origins.

The proposal should explicitly distinguish:

- desired velocity from each origin;
- executable command velocity;
- capability clipping;
- all player-future origins that generated this command;
- all seed-family origins that generated this command.

Unresolved player futures produce no generated command set and remain listed as unresolved provenance.

Required falsifiers:

1. the same family generated under two different player futures remains two proposals when executable command velocities differ;
2. different origins that capability-clip to the same command collapse into one concrete proposal with multiple provenance records;
3. HOLD/MAINTAIN duplicates across futures do not become fake extra actions;
4. unresolved H2 never generates a command;
5. proposal ordering/identity is deterministic within the same decision frame;
6. family labels can be changed without changing concrete-command dedup semantics when velocities/provenance are otherwise equivalent.

No global cross-tick command identity is required yet. Identity scope is one decision frame.

### A1.2p — fixed-command cross-future physical profile

**Same concrete command, multiple player counterfactuals. No utility aggregation. No winner.**

For one A1.2o concrete DIRECT command proposal:

- keep the companion `commandVelocity` exactly fixed;
- evaluate it against every rehearsable A1.2h player intervention with aligned tick/horizon;
- run the existing qualified chain: G0/G1/G2 → A1.2j same physics → A1.2k hard-body trace → A1.2l G3 → A1.2m player-agency trajectory;
- retain unresolved/absent futures explicitly without substituting another branch.

This is the first true robustness substrate.

Required falsifiers:

1. H1 vs OWNER_DIRECTED H2 use the exact same companion command bytes/velocity even when player velocities differ;
2. H3 transition hold evaluates the same command, not a regenerated H3-centered family equivalent;
3. unresolved H2 remains unresolved and produces no shadow trajectory;
4. candidate generation family/provenance cannot change the executed command during cross-future evaluation;
5. stale tick/horizon/capability mismatch is rejected;
6. live World remains unchanged after all branches.

### A1.2q — relationship utility from real joint outcomes

**Semantic utility evidence only. Still no selector.**

The old A1.1 direct relationship utility function remains a useful pure semantic donor. The old A1.2d use of clipped player endpoints does not.

For every rehearsed A1.2p branch:

- evaluate relationship utility from the **actual terminal relative state produced by the same-physics joint rehearsal**;
- use aligned A1.1 relationship-orientation/objective provenance from the decision source tick;
- publish initial utility, terminal utility and delta;
- do not average utility over different player futures;
- do not allow utility to override G0-G4 validity/cooperation structure.

Initial scope should remain terminal-state utility. Do not introduce trajectory-integrated relationship score until a concrete failure demonstrates the need.

Required falsifiers:

1. equal final relative states yield equal semantic utility regardless of candidate family/generation origin;
2. changing mesh/sampling density cannot alter direct utility for the same state;
3. directionless orientation does not inherit player-flow/world-axis meaning;
4. utility uses actual joint terminal state rather than old static/clipped endpoint;
5. source-tick orientation/objective misalignment is rejected.

### A1.2r — cooperation relation graph per player future

Only after fixed-command profiles exist.

For each rehearsable player future separately:

- take the same concrete command proposal set;
- compare G3-comparable command outcomes pairwise using qualified A1.2n;
- publish preference edges, no-preference pairs and forced-contention components;
- do not collapse the graph to scalar G4 scores.

A command that creates avoidable new player contact can be dominated by another command for that future. Commands that both pass G3 remain unordered by G4 and may later be distinguished by relationship utility/effort/continuity.

### A1.2s — robustness policy research

Do **not** choose the aggregation semantics now.

The correct policy must be falsified against actual H1/H2/H3 situations after A1.2p/q/r produce evidence.

Questions to resolve experimentally:

- Is H1 Owner agency a primary branch with H2 as uncertainty evidence, or are there states where H2 should constrain equally?
- How conservative should transition H3 be during stop/reversal?
- When may a command be rejected because it is poor under one alternate but excellent under Owner H1?
- How should `UNRESOLVED` differ from a rehearsed adverse branch?
- When all commands are forced-contention under one plausible future, should A1 expand candidate generation, shorten horizon, hold, or request route/topology help?

Explicitly reject these shortcuts unless evidence later supports them:

- arithmetic mean across H1/H2/H3;
- treating all future families as equal votes;
- worst-case rejection across every hypothesis by default;
- substituting H1 for unresolved H2;
- selecting the same **family name** across futures instead of the same concrete command.

### A1.2t — shadow selection semantics, only after robustness qualifies

A future selector should be structurally lexicographic rather than weighted soup:

1. causal/evidence alignment;
2. G1/G2 physical command admissibility/static legality;
3. G3 hard-body viability;
4. G4 cooperation frontier/forced-contention handling;
5. robustness across explicit causal player futures;
6. relationship utility among candidates that survive the harder structure;
7. later temporal effort/continuity and route/topology evidence where needed;
8. deterministic tie handling.

This ordering is a planning hypothesis, not yet qualified selection authority.

---

## 6. Candidate generation should stay compact

Do not expand candidate families merely because a selector is approaching.

Current families are adequate for the next robustness experiments:

- HOLD;
- MAINTAIN_CURRENT;
- PLAYER_FEED_FORWARD;
- radial inward/outward;
- tangent positive/negative.

A1.2o may produce a union of concrete commands from multiple rehearsable player-future generation contexts, but that is **provenance expansion**, not a request for more family types.

Only add a new motion family when executable evidence demonstrates a missing action class that the existing compact set cannot represent.

---

## 7. Performance boundary remains open

A true command-pool × player-future rehearsal can multiply physics work.

Before live authority:

- measure actual number of deduplicated concrete commands;
- measure number of rehearsable futures in ordinary vs transition states;
- measure same-physics rehearsal cost for the resulting matrix;
- decide cadence/pruning/caching from evidence.

Do not optimize the architecture around assumed cost before the correct matrix exists, but do not grant runtime authority without real cost evidence.

---

## 8. Relationship to long-term teammate goal

This work is not about completing an abstract authority ladder.

The purpose of concrete-command robustness is to let the companion eventually make one physically executable decision that remains intelligible when the player:

- continues the current request;
- exhibits a different but causally qualified body response;
- stops or reverses during a transition;
- creates local contention requiring the companion to yield;
- moves through constrained world geometry.

That is necessary groundwork for a teammate that feels present rather than scripted: one action, several plausible near futures, explicit uncertainty, causal reasons, and outcomes that can later feed memory/local live-brain/combat decisions.

---

## 9. Promotion boundary

A1.2n does **not** make A1.2 ready for a global selector or runtime movement authority.

The next meaningful promotion milestone is:

> **The same concrete companion command can be generated with explicit provenance, held fixed, rehearsed against every causally rehearsable player future, and reported with unresolved futures preserved rather than substituted.**

Only after that should relationship utility and cooperation relations participate in robustness/selection research.

Until then, selection remains intentionally deferred.