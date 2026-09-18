# OS-PREP-2 — Claim → Observable Phenomenon Map

Status: **ACTIVE PRODUCT-EVIDENCE MAP**
Date: **2026-09-18**
Parent campaign: [OWNER_SANDBOX_PREPARATION_CAMPAIGN.md](OWNER_SANDBOX_PREPARATION_CAMPAIGN.md)
Execution entrypoint: [CURRENT.md](CURRENT.md)

## 0. Purpose

OS-PREP-2 translates the accumulated Companion movement/cooperation research into a finite set of **player-observable teammate questions**.

The map deliberately reverses the normal research-debug direction.

Do not begin with:

> Which internal mechanism can we demonstrate?

Begin with:

> What should a player be able to notice if this companion is actually becoming a better teammate?

Only then identify the minimum causal evidence needed to explain the behavior.

This document is therefore not a gameplay specification, a selector design, or a claim that the current runtime already exhibits the desired phenomena.

Its job is to define **what OS-PREP-3 must try to falsify before the Owner spends attention on the sandbox**.

---

## 1. Evidence language

Each dossier contains:

- **product question** — the teammate property being tested;
- **blind observable** — what can be noticed without debug labels;
- **current donor claim** — evidence/mechanisms that make the question worth testing;
- **rival explanations** — simpler or accidental causes that could mimic success;
- **falsifier** — behavior that would show the current claim/mechanism is wrong, unnecessary or insufficient;
- **minimum scenario** — the smallest real World setup that can expose the phenomenon;
- **required causal evidence** — only what is needed after the blind read;
- **claim limit** — what a PASS cannot establish;
- **OS-PREP-3 seed** — first useful automated experiment shape.

A visually pleasing result is not enough.

A correct causal trace is not enough.

A green unit test is not enough.

The phenomena below become Owner-worthy only when those evidence layers converge.

---

## 2. Priority surface for the first Owner Sandbox

The first Owner campaign does **not** need every future Companion capability.

It does need useful evidence across these core surfaces:

1. relationship coherence;
2. semantic freshness and revision;
3. pace/separation;
4. player-flow cooperation and agency;
5. constrained-space cooperation;
6. close-contact/egress behavior;
7. meaningful persistence without fake side preference;
8. multi-beat continuity;
9. bounded intervention value;
10. behavioral readability without the debugger.

Longer-term combat, command language, multiple companions and higher cognition remain outside the acceptance surface for this campaign.

---

# PH-01 — Relationship coherence through turns and reversals

## Product question

Does the companion maintain a useful relationship to the player as the player's direction changes, instead of merely chasing a moving point or smoothly rendering a target teleport?

## Blind observable

During open movement, 90° turns, 180° reversals and short pauses:

- the companion's movement reads as adjustment of an ongoing relationship;
- it does not repeatedly cross the player's path for no obvious reason;
- it does not orbit or perform broad arcs whose purpose is impossible to infer;
- after reversal, it revises within a plausible number of beats rather than clinging indefinitely to the old frame.

## Current donor claim

Useful historical evidence:

- S1 established relational positioning as more informative than naive point chase;
- CCC observed non-monotonic lateral/away/slow/stop/recover motion as a possible proto-agency signal;
- current relationship semantics distinguish Owner control meaning from body motion.

But CCC also confirmed a critical rival:

> retaining the same symbolic slot can move the actual world target by several body lengths when the player's heading-relative frame rotates.

## Rival explanations

- downstream NATURAL/motor smoothing makes a target teleport look intentional;
- collision physically pushes the companion into a plausible relative position;
- deterministic slot/route ordering creates repeatable motion that looks like preference;
- simple point chase plus inertia produces broad arcs that look relational.

## Falsifiers

- same relationship label while the world-space objective jumps materially;
- 90°/180° turn produces a large arc that is only intelligible after reading debug;
- repeated side crossing despite clear free alternatives;
- reversal causes prolonged pursuit of obsolete spatial meaning;
- a simpler chase baseline looks equally coherent to a blind observer.

## Minimum scenario

Open field:

`steady +X -> 90° turn -> steady -> stop -> 180° reversal -> steady`

No pillar/doorway in the first discriminator.

## Required causal evidence

After the blind read:

- same-step Owner control;
- semantic orientation source/age;
- relationship revision/target;
- world-space target displacement;
- selected route/local motion;
- actual command and World outcome.

## Claim limit

A clean open-field result does not prove obstacle cooperation, right-of-way, pace quality or general intelligence.

## OS-PREP-3 seed

Exact replay plus 90°/180° perturbations. Compare blind motion with target displacement and first divergence.

---

# PH-02 — Semantic freshness: brief memory without stale certainty

## Product question

Can the companion preserve useful short-term movement meaning through brief ambiguity while releasing or revising it when fresh Owner evidence contradicts it?

## Blind observable

A brief stop should not make the companion instantly forget the joint situation.

A long stop or fresh opposite command should not leave the companion confidently behaving as though an obsolete heading is still current.

External body motion without Owner input should not silently become new Owner intent.

## Current donor claim

Recent relationship work qualified:

- control request vs actual body motion separation;
- canonical orientation provenance;
- bounded expiry behavior;
- explicit NONE after semantic expiry.

Historical CCC found:

- previous heading could persist indefinitely;
- reversal detection could compare against an arbitrarily old direction;
- fake initial +X heading could create semantic behavior while the player was stationary.

## Rival explanations

- physical inertia preserves a direction even when semantics have expired;
- visual continuity looks like memory despite stateless logic;
- external collision/solver motion is misread as renewed intent;
- a timeout happens to fit the tested pause but has no causal meaning.

## Falsifiers

- companion changes relational meaning because the player body was pushed with zero Owner input;
- long pause retains confident directional behavior with no fresh evidence;
- fresh opposite command fails to revise stale meaning;
- very brief pause destroys useful continuity immediately;
- behavior differs between equivalent semantic states solely because body velocity history differs.

## Minimum scenario

Open field pause-duration sweep:

- brief pause;
- ~0.5 s;
- ~2 s;
- long pause;
- resume same direction;
- resume opposite direction;
- controlled external body disturbance with zero Owner control.

## Required causal evidence

- same-step Owner control;
- requested vs actual player velocity;
- motion provenance;
- semantic source/age/expiry;
- relationship revision;
- resulting command/World outcome.

## Claim limit

This does not select a universal semantic-memory duration. It only tests whether current freshness semantics produce useful behavior.

## OS-PREP-3 seed

Metamorphic runs that hold visible body outcome similar while changing whether the motion came from Owner control or external disturbance.

---

# PH-03 — Pace and separation without chase pressure

## Product question

Can the companion remain usefully near the player without treating physical capability or maximum speed as the desired pace?

## Blind observable

When already in a useful relation:

- slow player movement produces slow, calm companion movement;
- stopping settles rather than causing orbiting/micro-correction;
- falling behind creates a readable catch-up response;
- catching up releases urgency instead of overshooting into repeated correction;
- separation control does not dominate every other cooperation concern.

## Current donor claim

Historical PACE research exposed useful radial opening/closing evidence.

It also exposed a major limitation:

> provisional ordinary pace had a floor around 55% of physical capability, so a companion beside a player walking very slowly could still prefer much faster motion.

This makes slow-walk behavior a high-value falsifier.

## Rival explanations

- motor braking hides an over-aggressive upstream pace;
- spatial target happens to be close enough that high preferred speed is not visible;
- collision/contact slows the companion;
- relationship target relocation, not pace reasoning, causes catch-up/release.

## Falsifiers

- repeated accelerate/brake oscillation beside a slow-moving player;
- companion repeatedly overshoots a useful region;
- stop causes persistent micro-motion;
- desired speed remains materially above what the visible relationship needs;
- catch-up behavior remains active after separation has closed.

## Minimum scenario

Open field:

`already well-positioned -> slow sustained walk -> stop -> moderate acceleration -> companion falls behind -> player slows`

## Required causal evidence

- Owner control and actual player speed;
- separation/radial trend;
- relationship target/region;
- PACE evidence where available;
- preferred vs commanded vs actual companion velocity;
- progress/recovery state.

## Claim limit

A clean result does not prove combat positioning or formation behavior.

## OS-PREP-3 seed

Slow-walk sweep at several sustained input magnitudes or authored player speeds, followed by a catch-up/release story.

---

# PH-04 — Player-flow cooperation without stealing agency

## Product question

When player and companion movement futures conflict, does the companion make space in a way that helps the player continue acting, rather than forcing the player to negotiate around the AI?

## Blind observable

In head-on and crossing interactions:

- the player can keep moving naturally;
- the companion avoids creating repeated body contention when free space exists;
- a yield/pass-behind/side-step, if it occurs, reads as a coherent response;
- after the conflict clears, the companion resumes useful behavior rather than continuing an avoidance ritual.

## Current donor claim

A1/H1 research can represent alternative physically rehearsed futures and player-flow interference.

P2 now allows one explicit research proposal to receive exactly one World step of authority.

No general right-of-way policy exists.

## Rival explanations

- geometrically cheapest avoidance happens to look polite;
- hard collision pushes bodies apart;
- side bias makes one crossing look consistently good;
- temporal inertia carries the companion out of the way without any cooperation semantics.

## Falsifiers

- player must stop/backtrack despite free companion alternatives;
- companion repeatedly re-enters the player's future path after a locally good step;
- mirror-equivalent crossings show unexplained side preference;
- “yield” remains active after the conflict is gone;
- one-step P2 improvement immediately degrades the next beats.

## Minimum scenario

- authored head-on;
- perpendicular cross-front;
- pass-behind variant;
- stop during predicted conflict;
- sudden reversal before conflict resolution.

## Required causal evidence

- Owner control;
- player/companion predicted futures where queried;
- baseline and selected command;
- contact/clearance;
- command/World outcome;
- next several causal frames, not only the intervention tick.

## Claim limit

A successful local conflict response is not evidence for a complete right-of-way policy or automatic A1 selector.

## OS-PREP-3 seed

Mirror-paired head-on/crossing stories and P2 control-vs-one-step-intervention Twin runs.

---

# PH-05 — Doorway/chokepoint cooperation

## Product question

Can player and companion traverse constrained shared space without babysitting, deadlock, repeated obstruction or a fake formation rule fighting necessary traversal?

## Blind observable

At a doorway:

- one actor can make progress while the other avoids needlessly blocking;
- temporary loss of ideal relationship is tolerated;
- the companion clears/repositions after the constrained episode;
- reversal or second attempt does not cause obvious indecision loops;
- the player does not need to manipulate the companion like furniture.

## Current donor claim

Doorway historically exposes several layers at once:

- relationship frame;
- static topology/router;
- player-flow;
- local dynamic avoidance;
- contact/comfort;
- progress/recovery.

“Eventually gets through” is therefore an insufficient criterion.

## Rival explanations

- static router alone chooses a lucky side;
- hard collision eventually resolves the jam;
- deterministic route/node IDs create apparent commitment;
- companion abandons relationship entirely rather than cooperating.

## Falsifiers

- recurring doorway deadlock or oscillation;
- player must back out repeatedly to release the AI;
- relation target fights passage geometry;
- companion keeps a stale side after topology changes;
- recovery remains latched after the route becomes feasible;
- same apparent success fails under a mirrored doorway.

## Minimum scenario

Doorway:

`approach together -> constrained conflict -> passage -> release -> immediate reversal/second attempt`

## Required causal evidence

- route status/topology;
- relationship target;
- player-flow evidence;
- contacts;
- recovery episode;
- command/outcome across the full episode.

## Claim limit

This does not establish general navigation competence or multi-agent crowd coordination.

## OS-PREP-3 seed

One exact story plus mirrored start positions and a reversal after first passage.

---

# PH-06 — Close-contact egress and intentional proximity

## Product question

When player and companion are very close or touching, does the system distinguish useful egress from arbitrary avoidance and remain physically legible?

## Blind observable

After accidental close contact:

- the companion can separate without explosive or oscillatory motion;
- it does not repeatedly shove the player;
- it does not remain stuck because its own “avoid player” logic forbids every useful exit;
- when contact clears, normal relationship behavior resumes.

## Current donor claim

Foundation established strong physical/contact evidence.

CCC identified a policy discontinuity around the current buffered player-distance boundary: outside the envelope some future positions are hard-rejected; once already inside, that rejection is suppressed and behavior relies on scoring/physics without an equivalent explicit player-egress contract.

## Rival explanations

- physics alone pushes the bodies apart;
- comfort penalties masquerade as egress reasoning;
- a lucky local candidate clears contact;
- aggressive avoidance solves accidental contact but would break intentional close cooperation later.

## Falsifiers

- crossing the boundary produces abrupt/unstable policy changes;
- repeated shove/re-contact;
- no legal exit despite clear geometric egress;
- exit succeeds only because player movement rescues the companion;
- post-egress system continues fleeing after the local problem is gone.

## Minimum scenario

Controlled approaches around the current close-contact/buffer boundary from multiple angles, plus one authored overlap/contact recovery.

## Required causal evidence

- exact separation/contact state;
- candidate acceptance/rejection reason;
- commanded and actual velocities;
- player control;
- recovery/egress classification;
- post-clear behavior.

## Claim limit

This does not define future intentional shoulder-to-shoulder combat contact, stance collision or soft-body policy.

## OS-PREP-3 seed

Boundary sweep around current buffered distance with fixed player input and mirrored approach angles.

---

# PH-07 — Meaningful side/topology persistence without fake personality

## Product question

When the companion stays on one side or route, is that persistence caused by meaningful world/relationship continuity rather than lexical IDs or initialization artifacts?

## Blind observable

Useful persistence looks like:

- avoid unnecessary left/right flipping;
- keep a side when the world situation remains materially continuous;
- switch when the old side becomes genuinely worse or invalid;
- no unexplained global preference for “left” or one symmetric route.

## Current donor claim

Historical research found two concrete bias sources:

- stationary initialization could fabricate +X semantic heading;
- equal candidates/routes could be resolved by deterministic identifier ordering.

Determinism is useful for reproducibility but must not silently become personality.

## Rival explanations

- string/ID ordering;
- router tie order;
- same-label hysteresis despite a materially moved target;
- starting pose asymmetry too small to notice visually.

## Falsifiers

- mirrored scenario does not mirror behavior without a causal asymmetry;
- repeated reset always chooses one side despite symmetric state;
- “same side” label corresponds to a world-space side flip after heading rotation;
- persistence survives major topology change with no supporting evidence.

## Minimum scenario

Open symmetric crossing plus symmetric pillar routes, each run in original and mirrored form.

## Required causal evidence

- candidate/route identity and world-space geometry;
- relationship frame;
- tie evidence;
- retained objective identity;
- mirrored first divergence.

## Claim limit

This does not forbid future companion personality/preferences. It only requires them to be explicit and causally earned.

## OS-PREP-3 seed

Mirror transform with first-divergence report and route/slot ID audit.

---

# PH-08 — Multi-beat continuity vs smooth-rendering illusion

## Product question

Does behavior remain coherent across several beats because an intention/relationship persists, or does downstream motion smoothing make disconnected decisions look deliberate?

## Blind observable

A sequence such as:

`approach -> conflict -> side-step -> pass -> recover relation`

should read as one evolving episode.

The companion should not:

- reverse every few frames;
- alternate between individually plausible but collectively contradictory moves;
- continue a maneuver after its cause disappears;
- require debug labels to explain why the sequence exists.

## Current donor claim

CCC found:

- history-dependent action;
- multiple decision timescales;
- temporal body realization;
- several hundred milliseconds of smooth body correction after an instantaneous upstream objective change.

That last point is a direct warning: smoothness can counterfeit intention.

## Rival explanations

- acceleration/braking/jerk continuity alone;
- cached route target;
- hysteresis over symbolic labels;
- repeated local optimizer outputs that happen to form a curve.

## Falsifiers

- causal objective changes sharply while body motion remains smooth;
- repeated decision reversals hidden by motor inertia;
- episode identity resets/continues for display-label reasons rather than world meaning;
- stopping the motor smoothing reveals incoherent upstream decisions;
- observer can only describe the behavior after reading research vocabulary.

## Minimum scenario

A multi-beat head-on or doorway story with one mid-episode stop/reversal.

## Required causal evidence

- relationship/objective revision history;
- route change;
- local selected motion;
- preferred/refined/final command where relevant;
- body realization;
- World outcome;
- episode/recovery state.

## Claim limit

Continuity in one movement episode is not evidence of deliberative planning or higher cognition.

## OS-PREP-3 seed

First-divergence trace aligned to a participant-only recording. Mark every upstream objective change and compare it with visible body continuity.

---

# PH-09 — Bounded P2 intervention value

## Product question

When a qualified research proposal gets exactly one World step of authority, does it produce a player-visible improvement worth investigating, or merely a technically valid alternative velocity?

## Blind observable

In a paired run, the intervention should create a noticeable useful difference such as:

- less obstruction;
- cleaner conflict resolution;
- better continuation of player flow;
- reduced unnecessary motion;

and the next beats should not immediately reveal a worse downstream consequence.

## Current donor claim

OS-PREP-1 now closes:

`Owner control -> P2 preview -> exact proposal -> explicit arm -> one World step -> A0 outcome -> captured incident`

with exact provenance and no automatic repeat.

This qualifies P2 as an experimental actuator, not a policy.

## Rival explanations

- one-step geometric luck;
- baseline stochastic/timing variation;
- intervention merely moves the companion somewhere different without improving cooperation;
- visible gain comes from DIRECT vs NATURAL realization rather than proposal semantics;
- immediate gain creates a later multi-beat regression.

## Falsifiers

- no participant-visible difference;
- intervention worsens subsequent beats;
- same gain appears with an arbitrary alternative command;
- mirrored case breaks the benefit;
- improvement depends on seeing the debug preview;
- repeated manual interventions would be required to maintain behavior.

## Minimum scenario

Exact head-on/crossing state with:

- control Twin: no P2 authority;
- intervention Twin: one exact explicitly armed P2 proposal;
- identical subsequent baseline policy.

## Required causal evidence

OS-PREP-1 incident plus bounded post-intervention causal window and control/intervention first divergence.

## Claim limit

A useful intervention does **not** justify automatic singleton execution, side preference, horizon policy, right-of-way policy or repeated A1 authority.

## OS-PREP-3 seed

Twin run at tick-zero head-on plus at least one non-head-on conflict state. Compare immediate and several-beat consequences.

---

# PH-10 — Behavioral readability without research vocabulary

## Product question

Can the participant form a reasonable interpretation of what the companion is doing before seeing the debugger?

## Blind observable

A participant-only recording should permit statements like:

- “przepuścił mnie”;
- “próbował wrócić obok mnie”;
- “zawahał się i zmienił stronę”;
- “został z tyłu i mnie dogonił”;
- “tu nie wiedział co zrobić”.

The observer need not infer the exact algorithm.

The key requirement is that the behavior communicates enough structure to judge whether it helps.

## Current donor claim

SPC-derived methodology warns against explaining the behavior first and then mistaking understanding of the debugger for understanding of the agent.

Current Companion debug vocabulary is rich enough to strongly bias interpretation.

## Rival explanations

- labels prime the observer;
- research overlays make a trajectory look meaningful;
- knowing the intended mechanism causes post-hoc rationalization;
- clean screenshots hide awkward temporal behavior.

## Falsifiers

- behavior appears intelligent only after reading internal labels;
- blind interpretation disagrees strongly with actual cause;
- two causally different mechanisms are visually indistinguishable in a way that matters to gameplay;
- observer cannot tell whether companion is helping, stuck, avoiding or pursuing.

## Minimum scenario

Participant-only capture of every OS-PREP-3 story before forensic review.

## Required causal evidence

None during the blind read.

After interpretation is recorded, use the minimum dossier-specific causal slice.

## Claim limit

Browser GPT's blind read is not a substitute for Owner feel judgement. It is a pre-Owner bias/failure filter.

## OS-PREP-3 seed

For every major story, persist two outputs:

1. participant recording/frame sequence;
2. causal evidence opened only after the behavioral read is written.

---

## 3. Cross-cutting pathology detectors

These are not independent gameplay goals. They are failure lenses applied to every dossier.

### CP-1 — Thrashing / oscillation

Detect:

- rapid left/right or speed reversals;
- repeated objective changes with little World progress;
- alternating commands hidden by smooth body inertia.

### CP-2 — Stale meaning

Detect:

- old semantic direction used after expiry;
- old topology/route identity retained after the material relation changed;
- recovery episode attached to an obsolete objective.

### CP-3 — Deterministic fake preference

Detect:

- non-mirroring symmetric behavior;
- lexicographic or ID tie-breaks surfacing as apparent personality.

### CP-4 — Player agency theft

Detect:

- player must stop/backtrack to serve companion locomotion despite free alternatives;
- companion physically crowds the intended path without useful reason;
- “cooperation” works only when player yields first.

### CP-5 — Debug-dependent intelligence

Detect:

- behavior looks arbitrary participant-first but “smart” after reading internal labels.

### CP-6 — Local-good / sequence-bad

Detect:

- individual steps satisfy local safety/utility while the multi-beat trajectory becomes worse.

---

## 4. Mechanism → phenomenon coverage

| Current mechanism/evidence | Primary phenomenon pressure | Important rival/failure |
|---|---|---|
| relationship semantic orientation + expiry | PH-01, PH-02 | stale frame / body motion mistaken for meaning |
| legacy relationship slots / hysteresis | PH-01, PH-07 | same label != same world intention |
| static router / route continuity | PH-05, PH-07 | lexical route preference |
| local spatial candidates | PH-04, PH-06 | locally safe but sequence-bad |
| PACE shadow evidence | PH-03 | speed floor / region-motion approximation |
| PLAYER FLOW / future rehearsal | PH-04 | geometry avoidance mistaken for right-of-way |
| progress/recovery | PH-05, PH-06, PH-08 | stale episode identity |
| NATURAL temporal realization | PH-03, PH-08 | smoothness counterfeit of intention |
| A1 H1 frontier | PH-04, PH-09 | internal quality without product value |
| P2 one-step authority | PH-09 | one-step luck / implicit policy overclaim |
| causal incident v1 | all, after blind read | instrumentation becoming interpretation |
| participant-only capture | PH-10 | insufficient temporal context |

No mechanism receives gameplay authority merely because it appears in this table.

---

## 5. OS-PREP-3 initial campaign order

The first automated campaign should maximize discrimination and keep causes separable.

### Wave A — Open-space semantics and relationship

1. PH-01 turn/reversal story;
2. PH-02 pause-duration / external-motion metamorphics;
3. PH-03 slow-walk / catch-up / release;
4. PH-07 open symmetric side test.

Reason:

> remove topology/contact confounders first.

### Wave B — Player conflict

5. PH-04 head-on;
6. PH-04 cross-front / pass-behind mirrors;
7. PH-06 close-contact/buffer sweep.

Reason:

> determine whether the system preserves player agency before adding narrow topology.

### Wave C — Topology and recovery

8. PH-05 doorway story;
9. PH-07 pillar mirror;
10. PH-08 multi-beat doorway or head-on reversal.

### Wave D — Controlled research intervention

11. PH-09 exact control-vs-P2 Twin;
12. repeat only where an earlier phenomenon gives a concrete reason.

Do **not** run a Cartesian product of every mode/horizon/proposal.

The next experiment is chosen by the uncertainty that most threatens a useful Owner Sandbox.

---

## 6. PASS boundary for OS-PREP-2

OS-PREP-2 is **PASS / CLOSED ENOUGH** when:

- every major mechanism we intend to expose to the Owner is attached to at least one dossier;
- every dossier has a participant-visible question and explicit falsifier;
- known historical “looks intelligent but isn't” mechanisms have a rival/falsifier path;
- P2 is represented only as bounded intervention evidence;
- the first OS-PREP-3 experiment sequence is finite and information-seeking;
- there is no material teammate phenomenon we know we care about that exists only as an internal metric.

OS-PREP-2 PASS does **not** mean any phenomenon itself passes.

It means we know what evidence OS-PREP-3 must produce.

---

## 7. Explicit anti-claims

This map does not claim:

- the current companion is a good teammate;
- relational motion is better than every chase policy;
- tangent movement is desirable;
- a singleton H1 frontier should execute automatically;
- current PACE is good pace matching;
- current doorway behavior is cooperative;
- current side persistence is intentional;
- smooth motion is evidence of planning;
- P2 should repeat;
- Browser GPT can replace Owner judgement of feel.

The Owner Sandbox remains an evidence campaign, not a ceremony for approving the existing architecture.
