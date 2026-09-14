# Companion Brain Lab — Initial Research Skeleton

Status: **pre-architecture working skeleton**  
Date: 2026-09-13

This document is deliberately a **research frame, not an architecture specification**. It exists to preserve the Owner's intent, expose the important tensions early, define how this sibling laboratory should cooperate with `Llm-Live-NPC`, and give later stages enough structure to be rigorous without making today's guesses expensive to undo.

Every substantial stage should be re-planned from the evidence available at that time. Nothing below earns authority merely by being written here.

---

## 1. Owner intent recovered so far

The laboratory exists because companion NPCs in games are routinely experienced as disappointing even when the surrounding game is strong. The target is not merely better pathfinding or a larger behavior list. The target is a companion that begins to feel like a **competent partner present in the same situation as the player**.

Current Owner direction:

- focus strongly on a **local live brain** that can react continuously and cheaply;
- investigate lively player ↔ companion reactions rather than a chatbot attached to a combat unit;
- support direct command through a fast interface, with Mount & Blade's hierarchical battle commands as one inspiration for the *interaction grammar*, not an architecture to copy;
- start from roughly **one companion and later a few companions**, not an army-scale simulation;
- study both combat and **preparation for combat**: regrouping, positioning, readiness, scouting, weapon/range considerations, waiting, following, protecting, and other states that make battle cooperation coherent before contact begins;
- allow useful autonomy without requiring constant micromanagement;
- treat commands as player intent that an intelligent companion should interpret in context, rather than rigid remote control where possible;
- use the project as an independent research laboratory and technology demonstrator whose proven findings may later donor into `Llm-Live-NPC`;
- do not reduce the work to LLM prompting. Higher cognition may become important, but the local brain is an equal long-term research subject and should remain capable of useful embodied behavior without network cognition;
- expect substantial discovery. Existing games are references and sources of failure modes, not authorities defining the answer.

### Provisional experiential north star

A strong result is not simply "the NPC wins fights" or "the NPC obeys commands".

A stronger target is:

> During unscripted play, the Owner increasingly treats the companion as a teammate: can rely on it without babysitting, can predict enough of its behavior to coordinate, notices meaningful initiative, and can correct or direct it quickly when desired.

This is intentionally qualitative today. Later stages may operationalize pieces of it with measurable scenarios.

---

## 2. What this project is not yet

Do **not** prematurely turn Companion Brain Lab into:

- a generic reusable AI framework;
- a shared engine package for every Jozz project;
- an LLM-agent framework;
- a Behavior Tree project;
- a Utility AI project;
- a GOAP/HTN planner project;
- a Mount & Blade clone;
- an army/squad RTS simulation;
- a complete RPG;
- a migration of `Llm-Live-NPC` into a new repository;
- a proving ground whose only goal is producing code to merge back upstream.

Any of those may become locally useful. None is the mission.

The mission is to learn what makes **embodied companion cooperation actually work** and to preserve the results in forms that can later be reused when reuse is justified.

---

## 3. Sibling relationship with LLM Live NPC

### 3.1 Relationship model

Treat the repositories as **siblings with reciprocal donor potential**.

`Llm-Live-NPC` asks broadly how a persistent embodied resident can experience a world, maintain continuity, reason over situated evidence, and act through world-authoritative mechanisms.

`Companion-Brain-Lab` asks more aggressively how a nearby allied NPC can react, cooperate, interpret direction, coordinate tactically, remain readable, and behave usefully at the timescale of active play.

Neither repository is the upstream authority of the other.

### 3.2 Shared system does not mean shared code yet

At this stage, "build toward a shared system" should mean **compatible conceptual seams and provenance-aware donor practice**, not forced code deduplication.

The two laboratories should be free to implement the same concept differently if their research questions demand it. Premature shared libraries would make local experiments negotiate with another project's assumptions before we know which assumptions are durable.

A common runtime/package should be extracted only when evidence shows all of the following:

1. substantially the same semantic responsibility exists in both projects;
2. both projects have independently exercised it enough to understand the boundary;
3. divergence is now mostly accidental duplication rather than useful research freedom;
4. the shared abstraction can stay smaller and more stable than the systems that consume it;
5. extraction reduces total complexity instead of merely moving complexity into a third repository.

Until then, **duplicated small code with explicit provenance is acceptable**.

### 3.3 Candidate shared conceptual seams

These are compatibility targets to preserve where practical, **not implementation modules selected today**:

1. **World authority** — physical truth, legality and factual outcomes belong to the simulated world, not to cognition or presentation.
2. **Situated observation/perception** — an agent reasons from evidence legitimately available to it rather than arbitrary global state.
3. **Intent / direction** — cognition and player command can express desired change without directly mutating world truth.
4. **Competence / execution** — movement, attack, interaction, positioning and other embodied mechanisms translate valid intent into attempts.
5. **Outcome / feedback** — success, failure, interruption and changed conditions return as factual evidence.
6. **Inspectable causal state** — debugging exposes what the agent could observe, what public decision/state it selected, what it attempted, and what actually happened without depending on hidden chain-of-thought.

The names and data shapes remain intentionally unselected.

### 3.4 Donor flow

When either project produces something useful to the other:

`discovery → local evidence → donor candidate → explicit provenance → adapted transplant → independent qualification in recipient → optional later generalization`

A donor should carry at least:

- source repository;
- exact source commit/ref;
- source responsibility;
- evidence that justified considering it;
- assumptions coupled to the source project;
- adaptations made by the recipient;
- recipient-side evidence after transplant.

Do not assume a donor remains synchronized with its origin. A successful transplant is allowed to diverge.

---

## 4. Initial donor audit: LLM Live NPC

The active `First Hearth` / resident work already contains useful research and implementation candidates. The correct lesson is **selective transplant**, not repository cloning.

### High-value conceptual donors

**A. World authority and factual outcomes**  
Strong candidate to preserve as a cross-project principle. Companion intelligence should not declare that an attack connected, a path succeeded, a player was protected, or a command was completed. World/execution evidence should establish what happened.

**B. Intention ≠ execution ≠ outcome**  
Strong candidate. This separation becomes even more important in combat, where a tactically correct decision may fail mechanically and where a mechanically successful attack may no longer be tactically useful.

**C. Situated perception / knowledge**  
Strong candidate. A companion should not become omniscient merely because local AI has cheap access to world state. Controlled cheats may later be justified for game feel, but they should be explicit design decisions rather than accidental omniscience.

**D. Causal, inspectable debugging**  
Very strong candidate. Companion research will need visual and temporal debugging of perception, threat assessment, desired position, current relationship to the player, command state, selected behavior/intent, execution and outcomes.

**E. One authoritative world progression**  
Strong candidate. Per-agent "AI time" must not accidentally advance the simulated world multiple times or give more agents more world-time.

**F. Evidence discipline**  
Strong process donor: separate automated invariants, controlled scenarios, live runtime evidence and qualitative Owner judgement. Do not promote a subsystem because tests pass if the research question concerns feel, trust, readability or cooperation.

### Implementation candidates worth inspecting later, not importing now

The current `Llm-Live-NPC` line contains discrete `world` and `execution` areas including actor-facing/location/world occurrence logic, structural world types/validation, navigation, execution contracts, deterministic execution and an execution driver. These are legitimate donor candidates for a first physical sandbox, but their assumptions must be audited against combat needs before transplant.

### Deliberately low-priority donors for the first local-brain experiments

Do not automatically import:

- the Resident semantic kernel;
- long-horizon resident continuity machinery;
- provider/LLM transport;
- Luna/Qwen-specific infrastructure;
- First Hearth-specific activities or conversational semantics;
- resident task lifecycle simply because it already exists;
- current memory/proposal/reconsideration machinery.

Those systems solve real `Llm-Live-NPC` problems, but importing them first would bias the companion laboratory toward resident/LLM abstractions before local tactical behavior has earned its own shape.

---

## 5. Research problem decomposition

The following are **questions to attack**, not components to implement one-for-one.

### 5.1 Embodied competence

Can the companion move, orient, avoid obstructing the player, maintain useful spacing, use attacks/defenses, recover from navigation trouble, and respect physical constraints well enough that higher intelligence is not constantly compensating for a weak body?

A sophisticated decision layer on top of poor locomotion or combat competence will still feel unintelligent.

### 5.2 Player-companion coordination

Can useful coordination emerge from shared situational awareness rather than from scripted combo moments only?

Candidate phenomena to investigate later:

- yielding physical space;
- converging/diverging appropriately;
- not competing for the same useless position;
- covering another actor's vulnerability;
- reacting to the player's engagement/disengagement;
- helping without stealing all agency;
- recognizing when assistance is unwanted or unnecessary;
- recovering after the pair becomes separated.

### 5.3 Command semantics and authority

Commands should be studied as **constraints / priorities / intent**, not assumed to be literal motor programs.

Examples worth exploring later:

- `follow me` may define relationship and distance preferences rather than a single target point;
- `hold here` may mean preserve responsibility for an area while permitting dodging, local cover use or short pursuit;
- `attack that target` may set priority without requiring suicidal pursuit;
- `retreat` may change acceptable risk and destination rather than immediately zeroing aggression;
- `protect me` may alter positioning and threat priority while leaving local tactical freedom.

The exact command grammar is open. Mount & Blade demonstrates the value of a fast hierarchical command vocabulary (unit selection plus hold/follow/charge/spacing/etc.), but its semantics should not be copied blindly.

### 5.4 Autonomy vs obedience

This is likely a central research tension, not an edge case.

A companion that ignores the player is frustrating. A companion that follows dangerous commands literally is stupid. A companion that asks for confirmation constantly is exhausting. A companion that silently overrides the player may feel paternalistic.

We need evidence for how much local discretion different command classes should permit, how disagreement is surfaced, and when self-preservation / world constraints can override instruction.

### 5.5 Combat readiness and transitions

Do not model "combat AI" as only the period after an enemy has been selected.

The companion should eventually be researchable across transitions such as:

`idle/travel → suspicion/readiness → preparation/positioning → engagement → local combat → disengagement/recovery → regroup`

These labels are descriptive, not an FSM proposal.

The pre-contact and post-contact periods may be where a companion feels most alive and where player trust is built.

### 5.6 One companion → a few companions

Start with one because player↔companion causality is easiest to observe.

Adding a second or third companion creates qualitatively different questions:

- target contention;
- physical crowding;
- role differentiation;
- local mutual assistance;
- group command vs individual command;
- information sharing;
- whether coordination is centralized, distributed or mixed;
- whether an explicit squad-level layer is actually necessary.

Do not assume a commander/squad hierarchy before these failures are observed.

### 5.7 Legibility, trust and feedback

A companion can make a technically sound choice that still feels random if the player cannot read it.

Investigate both **behavioral legibility** and explicit feedback:

- motion/orientation;
- posture/readiness;
- short barks or acknowledgements;
- command UI state;
- target/position indicators when appropriate;
- debug-only overlays explaining deeper state.

Research should distinguish player-facing communication from developer/Owner debugging.

### 5.8 Local brain ↔ higher cognition

Treat these as potentially complementary intelligences rather than a fixed hierarchy selected in advance.

A durable working expectation is:

- fast local systems handle continuous embodied control and well-characterized tactical reactions;
- slower/higher cognition may reinterpret goals, unusual situations, social context, broad plans, natural-language commands, memory, character and novel problems;
- either layer may trigger reconsideration in the other through bounded public state rather than direct hidden-state mutation.

But even that division is a hypothesis. Experiments should be allowed to move responsibilities when evidence demands it.

Do not hardcode current OpenAI model names, complimentary-token programs or present-day request economics into the local-brain architecture.

---

## 6. Critical design tensions to keep visible

These tensions should survive future replanning rather than being "solved" in the initial architecture document:

| Tension | Failure at one extreme | Failure at the other |
| --- | --- | --- |
| autonomy ↔ obedience | ignores Owner intent | remote-controlled puppet |
| helpfulness ↔ player agency | companion plays the game for you | companion is useless |
| realism ↔ game feel | principled but annoying | invisible cheating destroys trust |
| reactivity ↔ stability | thrashing / indecision | stale behavior |
| individual intelligence ↔ team coordination | selfish agents | over-centralized squad puppets |
| implicit coordination ↔ explicit commands | unpredictable cooperation | constant micromanagement |
| emergent behavior ↔ debuggability | impressive but inscrutable | rigid scripted behavior |
| reuse ↔ experimental freedom | framework inertia | needless incompatible reinvention |
| local cognition ↔ higher cognition | brittle reflex machine | latency/cost-dependent puppet |
| competence ↔ character | optimal combat bot | expressive but unreliable partner |

A later architecture should make these tradeoffs controllable and observable rather than pretending they disappear.

---

## 7. Research evidence strategy

### 7.1 Four evidence classes

Keep distinct:

1. **mechanical/contract evidence** — deterministic tests, invariants, validation;
2. **scenario evidence** — controlled gameplay situations designed to isolate one question;
3. **runtime observation** — telemetry and visual debug from unscripted runs;
4. **Owner judgement** — whether the companion actually feels useful, readable, alive, annoying, surprising, trustworthy or worth continuing to explore.

Do not substitute one class for another.

### 7.2 Companion-specific evidence candidates

Possible future measurements, only when they help answer a real question:

- time from meaningful world change to local response;
- time from player command to acknowledgement / execution change;
- number and duration of player-companion physical obstructions;
- unwanted target contention;
- separation / reacquisition behavior;
- command abandonment or unsafe literal obedience;
- decision oscillation frequency;
- player intervention rate;
- companion damage/death attributable to obviously bad tactical choice;
- helpful interventions that did not require player command;
- percentage of decisions for which debug evidence gives a coherent causal explanation.

Do not optimize metrics merely because they are measurable.

### 7.3 Visual debugging is first-class apparatus

The first serious companion sandbox should make it cheap to inspect at least the concepts that matter to the current experiment, such as:

- perceived actors / threats;
- attention or current tactical focus;
- desired movement/relationship position;
- current player command and its interpreted constraints;
- selected public intent/behavior;
- execution status;
- relevant tactical scores/considerations if the chosen architecture uses them;
- recent reason-for-change or causal trigger in a compact inspectable form;
- world-authoritative outcome.

Do not expose or depend on private model chain-of-thought. Debug the **system's public causal state**.

---

## 8. Provisional investigation order

This is a sequencing hypothesis, not a locked roadmap. Re-plan each stage before implementation.

### Stage A — physical cooperation apparatus

Goal: create the smallest playable environment in which companion cooperation can fail visibly.

Likely needs:

- player body/controller;
- one companion body;
- one or more simple threats/opponents or equivalent pressure source;
- obstacles / navigational decisions;
- enough movement/combat affordances to create spacing and positioning problems;
- strong debug visualization;
- deterministic scenario setup/reset.

Avoid sophisticated cognition initially. The apparatus should let us characterize body, navigation, perception and cooperation failures before selecting the brain.

### Stage B — minimum useful local partner

Question: how much competence and cooperation can we earn without commands or LLM cognition?

Candidate research targets: staying usefully near the player, not obstructing, basic threat response, safe engagement/disengagement, simple assistance and recovery.

This stage should produce the first meaningful Owner question:

> "With no micromanagement, is this beginning to behave like someone I can play alongside?"

### Stage C — command-intent experiments

Introduce a very small, fast command interface and attack the semantics of commands rather than merely their UI.

Mount & Blade is a useful inspiration because it compresses selection + order into a rapid hierarchy, with commands such as hold, follow, charge, advance/fall back and spacing. The research target here is not to recreate those exact commands; it is to discover a vocabulary with low player-attention cost and enough semantic richness for intelligent interpretation.

### Stage D — tactical cooperation under pressure

Increase situations that force tradeoffs: multiple threats, ranged/melee interactions, line of sight, cover/terrain if useful, player mistakes, retreat/rescue, changing priorities.

Only now is it likely to be productive to compare decision architectures such as BT, Utility, GOAP, HTN, planners, hybrids or something custom. Select them per observed failure, not by fashion.

### Stage E — small-group cooperation

Add a second/few companions only after one-companion causality is reasonably understood. Use the failures to determine whether explicit squad-level cognition is needed.

### Stage F — higher cognition / LLM experiments

When the local brain and embodied cooperation provide a meaningful substrate, test higher cognition against concrete deficits: natural command interpretation, plan adaptation, social/contextual behavior, memory, strategic intent, unusual cases, personality, etc.

Do not add LLM cognition merely because the sibling project uses it.

---

## 9. Common-system strategy over time

The intended long-term relationship can be visualized conceptually as:

```text
                 shared evidence + donor flow
          ┌─────────────────────────────────────┐
          │                                     │
   LLM Live NPC                         Companion Brain Lab
   persistent resident                  player ally / teammate
   continuity + meaning                 local reaction + cooperation
   situated life                        tactical embodiment
   higher cognition focus               live-brain focus
          │                                     │
          └────── possible earned common seams ─┘
```

Potential long-term common pieces should be earned in roughly this order:

1. **shared principles / semantic contracts**;
2. **compatible event / debug vocabulary where genuinely useful**;
3. **selective copied donors with provenance**;
4. **repeated cross-project reuse**;
5. only then consider extraction of a shared library/runtime;
6. only much later consider whether there is a coherent broader "agent/world platform" at all.

Do not invert the order by building the platform first.

---

## 10. External research signals worth carrying forward

These sources are inputs, not authorities:

### Ellie — *The Last of Us*

Max Dyckhoff's GDC 2014 session frames buddy AI as a systematic character problem: the companion's generated behavior needed to support the player's perceived relationship with Ellie, and the postmortem explicitly includes shortcomings and reasons behind decisions.

Source: https://www.gdcvault.com/play/1021010/Ellie-Buddy-AI-in-The-Last-of-us

**Takeaway for this lab:** companion evaluation cannot be reduced to tactical optimality. Presence, trust, annoyance and relationship with player behavior are part of the system.

### Atreus — *God of War*

Santa Monica's GDC 2019 talk describes multiple approaches and iterations needed to make Atreus important to combat while preserving the player's core combat identity.

Source: https://gdcvault.com/play/1025768/Raising-Atreus-for-Battle-in

**Takeaway:** "helpful companion" is a player-agency design problem as much as an AI algorithm problem. Expect iteration and failed archetypes.

### God of War Ragnarök AI systems

The 2023 Santa Monica talk discusses migration toward behavior trees, richer environmental awareness and movement needs as the game expanded companion/enemy variety.

Source: https://www.gdcvault.com/play/1028840/Preparing-AI-Systems-for-God

**Takeaway:** architecture should support communication between decision logic and specialized world/movement systems. This is evidence for separation of responsibilities, not a decision to adopt behavior trees.

### Mount & Blade command grammar

Mount & Blade's battle interface combines group selection with rapid orders such as hold position, follow, charge, advance/fall back and spacing.

Reference: https://mountandblade.fandom.com/wiki/Battle

**Takeaway:** the interesting donor is low-attention hierarchical command input. The companion should be freer to interpret commands intelligently than units in the reference system.

### 2026 systematic review of NPC patterns for human–AI cooperation

A recent peer-reviewed synthesis groups relevant NPC cooperation patterns across responsiveness, communication, emotional factors, behavioral characteristics and player/NPC team structures rather than treating cooperation as a single decision algorithm.

Source: https://fis.uni-bamberg.de/handle/uniba/115321

**Takeaway:** our broad research axes are justified. Tactical competence alone is not enough to evaluate cooperation.

### 2026 Peacekeeper Elite companion presentation

A GDC Festival of Gaming session describes a contemporary AI companion in four broad capability areas: command obedience, free conversation, memory and nurturing, with combat assistance/scouting/search as command behaviors.

Source: https://attend.gdcevents.gdconf.com/event/gdc-festival-of-gaming-2026/planning/UGxhbm5pbmdfNDMxOTMwMQ%3D%3D

**Takeaway:** current industry work also separates fast command/functional competence from conversation/memory dimensions. This supports testing our local-brain and higher-cognition responsibilities separately before composing them.

---

## 11. Decisions earned now vs deliberately open

### Earned enough to use as the current skeleton

- independent sibling repository is appropriate;
- local live brain is a first-class research target;
- one companion is the clean initial causal unit; a few companions are explicitly in scope later;
- command UX and command semantics are core research, not polish;
- combat preparation and transitions matter, not only active attack behavior;
- LLM cognition is optional/complementary and must not be the per-frame dependency;
- world truth, intent, execution and factual outcome should remain separated conceptually;
- strong causal/visual debugging is part of the research apparatus;
- donor reuse with `Llm-Live-NPC` should be explicit, selective and provenance-aware;
- shared code/runtime must be earned by repeated reuse, not assumed up front;
- every major stage will be re-planned from new evidence.

### Deliberately open

- renderer/game framework;
- physics engine;
- whether to reuse the current `Llm-Live-NPC` web stack;
- combat model;
- navigation implementation;
- perception implementation and what game-feel cheats are justified;
- behavior-selection architecture;
- squad architecture;
- command vocabulary and UI;
- exact debug UX;
- local-brain update frequencies;
- whether local learning/adaptation is useful;
- LLM provider/model/routing;
- memory architecture;
- persistence;
- extraction of any common package/runtime.

Keeping these open is intentional, not missing planning.

---

## 12. Next bounded planning move

Before building the companion brain itself:

1. perform a **donor-level audit** of the current physical/world/runtime pieces in `Llm-Live-NPC` and classify each as reuse / adapt / inspiration / reject;
2. do a short comparative research pass on candidate sandbox technologies and the smallest combat/interaction apparatus that can expose companion failures quickly;
3. define the first Owner-playable research question and its debug/evidence needs;
4. only then select the first implementation slice.

The output of that pass should be an **execution-ready experiment definition**, not a final architecture.
