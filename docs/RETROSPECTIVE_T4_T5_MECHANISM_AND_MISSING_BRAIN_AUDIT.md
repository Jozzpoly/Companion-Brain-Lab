# Retrospective T4/T5 — Mechanism Value, False-Life Risk, and Missing-Brain Audit

Status: **ACTIVE PRODUCT-GAP AUDIT · NO IMPLEMENTATION AUTHORITY**
Date: **2026-09-20**

Parent review:

- [PRE_OWNER_SANDBOX_RETROSPECTIVE_CAMPAIGN.md](PRE_OWNER_SANDBOX_RETROSPECTIVE_CAMPAIGN.md)
- [RETROSPECTIVE_T1_T2_TRUE_RUNTIME_ANATOMY.md](RETROSPECTIVE_T1_T2_TRUE_RUNTIME_ANATOMY.md)
- [RETROSPECTIVE_T3_EVIDENCE_CLAIM_LEDGER.md](RETROSPECTIVE_T3_EVIDENCE_CLAIM_LEDGER.md)

Purpose:

> separate mechanisms that have earned durable value from mechanisms that merely produce plausible motion, then compare the actual live state/memory/action vocabulary with the original teammate problem.

No redesign is authorized by this dossier.

---

# Part I — What kind of internal state does the live companion actually have?

## 1. World vocabulary is intentionally tiny

Current domain actor identity is literally:

```ts
ActorId = "player" | "companion"
```

The current authored scenarios contain only those two actors.

There is no World-level:

- enemy;
- threat;
- ally other than the single companion;
- item/objective requiring assistance;
- attack;
- defense;
- damage;
- readiness;
- combat state.

This is not merely an unimplemented policy.

The present experimental world cannot yet express those teammate problems.

---

## 2. Persistent live state that can affect ordinary movement

The ordinary `SPATIAL / NATURAL / A1 OFF` companion has several legitimate forms of memory/state.

### Relationship-orientation memory

Stores bounded recent Owner-direction evidence.

Useful for:

- not losing all orientation the instant input becomes neutral;
- distinguishing Owner meaning from solver/body motion.

It is **directional semantic memory**, not general episodic or tactical memory.

### Relationship selection memory

Stores:

- previous selected slot;
- last player-direction frame;
- next reconsideration tick.

Useful for hysteresis/stability.

Danger:

- the selected slot is overloaded as relationship category, target generator and progress-episode identity;
- retained frame can survive after canonical semantic orientation expires.

### Local movement memory

Stores:

- previous selected move;
- local decision until the next ~20 Hz reconsideration.

Useful for local continuity.

### Temporal body memory

Stores:

- actual body velocity through World;
- previous acceleration in NATURAL continuity.

This is genuine embodied state.

### Progress/recovery episode memory

Stores:

- objective key;
- rolling progress samples;
- no-progress/unreachable timing;
- contact transition;
- local retry count/cooldown.

Useful for detecting failure over time.

### What is absent

There is no live persistent object representing:

- “what I am currently trying to accomplish for the player”;
- “why this action began”;
- “what condition would make me abandon it”;
- “who/what currently needs my attention”;
- “which responsibility I own”;
- “what I expect the player to do”;
- “what action phase I am in” beyond motor/recovery regime;
- “what I learned from a prior teammate episode” beyond narrow movement history.

---

# Part II — Mechanism value / pathology audit

## 3. World/Rapier physical authority

**Keep-value:** VERY HIGH  
**False-life risk:** LOW  
**Replacement pressure:** LOW

This is competence substrate, not simulated intelligence.

It grounds all future claims in actual shared physical consequence.

---

## 4. Relationship semantic orientation tracker

**Keep-value:** HIGH AS A SEAM  
**False-life risk:** MEDIUM IF OVERINTERPRETED  
**Replacement pressure:** LOW/MEDIUM

Earned value:

- same-step Owner movement meaning;
- provenance-safe semantic memory;
- refusal to treat arbitrary body motion as Owner intent.

Limitation:

- “recent movement direction” is only one small part of player intent.

Retrospective disposition:

> preserve the provenance idea; do not let this narrow semantic signal become the future definition of player intent.

---

## 5. Eight-slot relationship objective

**Keep-value:** LOW AS FINAL MECHANISM / MEDIUM AS HISTORICAL BASELINE  
**False-life risk:** HIGH  
**Replacement pressure:** HIGH

Useful historical contributions:

- created the first inspectable relationship objective;
- made follow relationship more than direct chase;
- exposed many later problems cleanly.

Known pathology mechanisms:

- heading-relative target rotation;
- lexical side ties;
- stale retained semantic frame;
- symbolic label != spatial intention identity;
- objective-key coupling;
- abrupt world-target changes hidden by NATURAL.

Retrospective disposition:

> treat as an intentionally obsolete probe that still happens to own live high-level movement semantics.

Its current survival should be interpreted as **technical debt inherited by a successful downstream stack**, not as architectural validation.

---

## 6. Static route planning

**Keep-value:** HIGH AS A RESPONSIBILITY  
**Current implementation value:** MEDIUM/HIGH  
**False-life risk:** MEDIUM

Earned:

- route feasibility is distinct from endpoint feasibility;
- route guidance should not own the motor;
- hard vs comfort connectivity;
- egress-aware physical starts.

Known artifact:

- lexical route tie produces unearned topology preference.

Retrospective disposition:

> preserve route/planning seam and whole-body truth; current deterministic tie semantics are disposable.

---

## 7. S3 local velocity scorer

**Keep-value:** HIGH AS A LOCOMOTION EXPERIMENT / MEDIUM AS LONG-TERM ARCHITECTURE  
**False-life risk:** MEDIUM/HIGH  
**Replacement pressure:** MEDIUM

It is substantially better than point chasing.

It can react quickly and select:

- lateral motion;
- backoff;
- stop;
- variable speed;
- route-progressing detours.

It also contains explicit short-horizon player-interaction geometry.

But its “reasoning” is fundamentally a scalar motor score:

- route distance;
- relationship distance;
- clearance;
- player collision risk;
- continuity;
- unnecessary motion.

This can visually resemble:

- yielding;
- etiquette;
- initiative;
- deliberate side choice.

Without necessarily representing any of those meanings.

PH-04 demonstrates that this is sometimes **exactly enough**: simple geometry can preserve player flow beautifully.

Retrospective rule:

> when simple geometry solves the product problem, keep it simple; when it merely looks social, do not credit it with social cognition.

---

## 8. Hard-vs-comfort / egress repair

**Keep-value:** VERY HIGH  
**False-life risk:** LOW  
**Replacement pressure:** LOW

This is one of the clearest durable mechanisms.

It models an important physical truth:

- legal vs desirable space are different;
- leaving an overlap is different from entering one;
- fail-safe STOP cannot pretend to be safe while embedded in hard geometry.

This likely generalizes beyond the current companion architecture.

---

## 9. Preferred-velocity refinement

**Keep-value:** MEDIUM  
**False-life risk:** MEDIUM  
**Replacement pressure:** MEDIUM

It improves local motion quality and removes obvious lattice quantization.

But it is a motor-quality interpolation layer.

It does not create a more meaningful objective.

Any future redesign should be free to delete it if a different locomotion representation naturally yields continuous commands.

---

## 10. NATURAL motion continuity

**Keep-value:** VERY HIGH AS A PRINCIPLE  
**Exact implementation value:** MEDIUM  
**False-life risk:** VERY HIGH IF SEMANTICS ARE WEAK

This mechanism is likely a real contributor to the first aliveness signal because:

- the body has temporal state;
- velocity cannot instantaneously rotate;
- acceleration has continuity;
- corrections become arcs rather than vector snaps.

That is valuable embodiment.

But it is also the strongest **false-life amplifier** currently qualified.

PH-01 and PH-08 show:

> a discontinuous upstream target/preferred command can be transformed into a graceful, apparently deliberative trajectory.

Retrospective disposition:

> preserve embodied inertia/history, but actively distrust any inferred intention that is supported only by smooth motion.

---

## 11. Progress/recovery semantics

**Keep-value:** HIGH AS DIAGNOSTIC STATE  
**Current executive value:** LOW/MEDIUM  
**False-life risk:** LOW/MEDIUM

The monitor is substantially more sophisticated than its actuator.

It can correctly identify:

- invalid route;
- unreachable;
- player blocking;
- static blocking;
- no progress;
- moving objective;
- intentional hold;
- recovery.

But most actions are descriptive/escalation signals only.

The live supervisor executes only:

> `RETRY_LOCAL`.

It does not execute:

- `RECONSIDER_OBJECTIVE`;
- `REPORT_UNREACHABLE` as an upstream behavioral transition;
- any new relationship plan.

This means:

> current Companion has **diagnostic intelligence without equivalent executive intelligence**.

That is useful infrastructure for a future brain.

It is not yet the brain itself.

---

## 12. CCC/A1 research machinery

**Keep-value:** SELECTIVE, POTENTIALLY VERY HIGH  
**Direct live product value today:** ZERO/NEAR-ZERO  
**Roadmap steering risk:** HIGH

High-value donors already earned:

- provenance-safe situation snapshot;
- relative relationship utility concepts;
- same-physics counterfactual rehearsal;
- candidate command identity;
- player agency trajectories;
- pairwise cooperation evidence;
- observer non-interference;
- Twin/metamorphic method;
- first-divergence localization;
- P2 one-step experimental intervention.

But a large fraction of A1 is evidence geometry around:

> which local velocity would be better under which future assumptions?

Before future promotion, each subsystem must answer:

> which concrete live teammate deficit requires this machinery?

If the answer is only “we already built it”, it should not steer architecture.

---

# Part III — False-life taxonomy

## 13. Genuine aliveness candidates

These have plausible durable value independent of current bugs.

### Temporal physical embodiment

Body state persists through velocity/acceleration rather than teleporting between decisions.

### Multi-rate control

Slower high-level updates can coexist with fast local reaction and per-tick body realization.

### Non-monotonic locomotion

Useful movement can temporarily increase separation or move laterally.

### History-dependent action

Previous body/action state matters.

### Autonomous reacquisition

The companion can tolerate temporary spatial separation and later regain a useful relationship.

These are worth preserving as **principles to re-falsify** under future semantics.

---

## 14. Known pseudo-agency / false-life mechanisms

### Smoothly rendered target teleport

Abrupt relationship-target changes become graceful arcs.

### Lexical relationship side preference

Stable implementation ordering can look like personality.

### Lexical route-side preference

Stable path ordering can look like route habit.

### Stale semantic persistence

Expired directional meaning can keep driving action and look like commitment.

### Geometric avoidance as apparent etiquette

A sidestep can look socially intelligent while arising only from collision-risk cost.

### Recovery from self-created error as apparent initiative

A graceful regroup can look purposeful even if the initial separation was itself caused by poor upstream semantics.

Retrospective requirement:

> future Owner interpretation should distinguish “I like this behavior” from “I like the accidental cause of this behavior”.

We may want to preserve the visible benefit while replacing the cause.

---

# Part IV — Missing-brain audit

## 15. Situational responsibility

**Current status:** ABSENT

The companion has no representation of:

> “this world problem is currently mine to help with.”

The only standing responsibility is effectively:

> maintain/recover a relationship position around the player.

This is the largest gap relative to “teammate”.

---

## 16. Threat / tactical focus

**Current status:** UNREPRESENTABLE IN CURRENT WORLD

There are no enemy/threat actors in the authoritative domain.

Therefore no evidence exists for:

- noticing threat;
- prioritizing threat;
- deciding whether to engage;
- deciding whether to disengage;
- respecting player engagement;
- covering vulnerability.

---

## 17. Action/intention identity

**Current status:** WEAK / IMPLICIT

The system has movement objective keys and temporal states.

It does not have a durable public action such as:

- “cross doorway to regroup”;
- “give player passage”;
- “hold useful side while player moves”;
- “help against this threat”;
- “retreat and regroup”.

The movement stack can produce trajectories that look like such actions without representing them.

This is a key legibility problem.

---

## 18. Meaningful initiative

**Current status:** NOT YET DEMONSTRATED BEYOND MOVEMENT SELF-MAINTENANCE

The companion autonomously:

- moves;
- detours;
- reacquires;
- avoids some interference;
- retries local state.

It has not demonstrated initiative toward an external shared goal.

---

## 19. Corrigibility / player direction

**Current status:** ONLY RAW MOVEMENT-CONTEXT INFLUENCE

Current player movement changes relationship orientation and local prediction.

There is no command semantics or explicit correction channel.

Therefore the original north-star clause:

> “can correct or direct it quickly when desired”

has not yet been exercised.

---

## 20. Autonomy vs obedience

**Current status:** NOT YET A REAL CONFLICT

Without commands, threats or alternative responsibilities, the system has little reason to disagree with the player.

The central research tension exists only on paper today.

---

## 21. Pre-combat readiness

**Current status:** ABSENT

No world or brain representation of:

- readiness;
- scouting;
- weapon/range;
- formation for expected contact;
- prepare/wait;
- suspicion;
- approach/engage transition.

This was a major original interest.

---

## 22. Assistance

**Current status:** ABSENT AS A SEMANTIC CATEGORY

Avoiding obstruction can be helpful.

That is not the same as identifying and performing assistance.

No current scenario asks:

> can the companion make something easier or safer for the player without stealing agency?

---

## 23. Attention/focus

**Current status:** ABSENT

The companion does not choose what deserves attention.

The player is implicitly always the central reference frame.

This is acceptable for locomotion research and insufficient for broader teammate behavior.

---

## 24. General local memory

**Current status:** NARROW MOVEMENT MEMORY ONLY

Current history includes:

- directional semantic memory;
- selected relationship slot;
- previous move;
- acceleration;
- progress samples/retry episode.

There is no evidence of:

- memory of a prior tactical event;
- learned player preference;
- remembered command;
- remembered failed plan;
- social interaction;
- world-object continuity beyond current movement objective.

---

## 25. Higher-cognition seam as live teammate input

**Current status:** NOT PRESENT

A1 is not “higher cognition”; it is a local research decision apparatus.

No LLM or slower reasoning layer currently gives the live companion goals or interpretations.

This is correct for the current stage, but it should be stated plainly.

---

# Part V — The pre-Sandbox decision is now sharper

## 26. Two legitimate experimental questions are being conflated

### Question A — locomotion relationship

> If we expose the current movement organism in free Owner play, do its movement, spacing, reacquisition and physical presence feel like a promising teammate substrate?

The provisional OS-PREP-5 build is well suited to this question.

### Question B — minimum useful partner

> With no micromanagement, does this feel like someone I can actually play alongside because it shares some responsibility for the situation?

The current organism cannot seriously answer this.

It has no external shared responsibility to take.

---

## 27. Why this matters before spending Owner attention

If we launch the current sandbox while unconsciously asking Question B, a likely result is:

> “it still feels like a fancy follower.”

That would be predictable from the system design and not very informative.

If we launch it explicitly for Question A, the same run could be highly informative:

- which embodiment primitives are worth preserving;
- whether locomotion relation is trustworthy/readable;
- which pseudo-agency is perceptually salient;
- whether movement foundation is strong enough to stop consuming project attention.

The eventual decision must therefore specify the **Owner question**, not merely the build.

---

## 28. T4/T5 provisional conclusion

Current evidence supports a stronger statement than before:

> The project has developed a sophisticated **body and movement relationship**, not yet a sophisticated **situational teammate brain**.

This may be exactly the foundation we needed.

But before OS-PREP-5, T6/T7 must decide whether:

1. the Owner should deliberately evaluate this movement substrate now and then close/reframe the movement era; or
2. the highest-information experiment first needs one very small new source of shared situational responsibility so the Owner is finally judging the beginning of Stage B.

Do not implement either option yet.
