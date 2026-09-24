# Companion / Squad Field Lab Campaign

Status: **OWNER-CONFIRMED DIRECTION · ACTIVE DESIGN CAMPAIGN · NOT AN OWNER TEST**

Date: 2026-09-21

## 1. Why this exists

Companion-Brain-Lab is not trying to prove that one follower can execute a larger list of behaviors.

The project exists to discover **embodied cooperative intelligence**:

- one to several companions sharing the player's situation;
- useful local autonomy without babysitting;
- fast, low-attention player direction;
- readable initiative and correction;
- movement, preparation, contribution, recovery and regroup as one continuous relationship;
- later compatibility with richer local brains / SPC / LLM cognition without making those systems responsible for mundane competence.

Repeated Owner feedback has rejected narrow mechanism demos, hidden-oracle tests, marker/circle prototypes, command plumbing presented as gameplay, and machine-green systems whose intelligence is only visible in debug.

The lab therefore needs a broader instrument.

## 2. The new object: Companion / Squad Field Lab

The next substantial product of the research should be a **persistent playable squad sandbox**, not another one-purpose Owner-gate specimen.

The sandbox should let the Owner:

- play the player normally;
- have 1–several real embodied companion bodies present;
- select one, several or all companions;
- directly puppeteer one companion when desired;
- issue world-space movement / hold / regroup intent;
- author and edit formation slots;
- change spacing/orientation;
- move from group intent down to one-companion correction;
- change meaningful behavior/dynamics parameters;
- add/remove experimental companions;
- run the same squad through different spatial and cooperative situations;
- see what each companion is trying to do and why;
- inspect a selected companion deeply without drowning in all-agent debug;
- capture/replay useful incidents later.

The key requirement is breadth of **meaningful manipulation**, not number of buttons.

## 3. It is both a playground and a research instrument

Manual control is evidence.

When the Owner repeatedly authors the same kind of behavior manually, that pattern becomes a candidate for automation.

The research loop becomes:

`play → select → manually shape squad behavior → observe → identify repeated intent → encode the intent/constraint → let local brain take over part of it → compare → correct`

This is preferable to:

`invent AI state → build narrow demo → ask Owner whether it feels intelligent`

The sandbox should make the transition between manual authorship and autonomy gradual and inspectable.

## 4. Three distinct control planes

Do not collapse these into one command system.

### A. Setup / authoring

Changes the experimental initial condition.

Examples:

- add/remove companion body;
- drag actor starting positions while paused/setup mode;
- edit freeform formation slots;
- choose player-relative vs world-relative formation frame;
- change spacing/orientation;
- configure per-member parameters.

This is not an in-world order.

### B. Live player direction

Changes what the player asks of the squad during play.

Examples:

- move selected units to a point/region;
- hold an anchor;
- follow/regroup;
- adopt the current authored formation;
- tighten/spread formation;
- constrain operating distance;
- allow/disallow local deviation.

The semantic primitive is **intent / constraint**, not puppet velocity.

### C. Direct puppeteering

Temporarily controls one selected embodied companion directly.

Purpose:

- create a human gold-standard;
- test whether the World situation can support a desired maneuver;
- distinguish brain failure from movement/world failure;
- reproduce and compare incidents.

Direct control must be clearly visible as a different authority source from live orders or autonomy.

## 5. Squad model

### Real bodies, not UI tokens

The first multi-companion surface must use real Rapier bodies.

No roster entry may imply a live companion that does not physically exist in World.

### Bounded initial squad size

A practical first wide target is **1–4 companions**.

This is enough to expose:

- selection;
- assignment;
- formation geometry;
- companion↔companion conflicts;
- narrow-space behavior;
- regroup;
- group vs individual direction;
- readability pressure.

It is not a product cap.

### Identity isolation

Preserve historical single-companion evidence.

Keep canonical:

`ActorId = "player" | "companion"`

for the already-qualified single-companion stack where possible.

Introduce an explicitly experimental squad-body identity layer for additional manual members rather than silently broadening S1–S4 semantics.

Physics may support those bodies before cognition does.

## 6. Selection and manipulation grammar

The exact keys are not final, but the interaction grammar should support:

- click = select one companion;
- Shift+click = add/remove from selection;
- box/lasso selection if group size later justifies it;
- Select All;
- cycle focused companion;
- clear selection;
- a focused companion inside a multi-selection for deep debug/direct control.

World overlays must make selection unambiguous.

### World-space target manipulation

The sandbox should support direct spatial editing rather than command-menu dependence.

Candidate grammar:

- click/drag target handle to move an order anchor;
- drag individual formation slot handles;
- drag/rotate formation frame;
- optional numeric inspection/editing in the side panel;
- snap-free by default; optional snap/grid later if useful.

## 7. Formation model: editable geometry first, presets second

Do not define formation as an enum.

Canonical experimental representation:

- formation frame / anchor;
- frame orientation;
- ordered set of local slot offsets;
- member↔slot assignment;
- spacing/scale;
- slot tolerance;
- formation preservation policy.

A preset such as line, column, wedge or loose cluster should merely **generate editable offsets**.

The Owner must be able to drag any slot afterward.

This lets the project discover unusual useful formations instead of forcing every experiment through conventional labels.

## 8. Behavior / autonomy controls

Do not expose implementation booleans such as `WITHHOLD_CURRENT_CONTRIBUTION`.

Candidate research dimensions should map to intelligible player intent.

Potential dimensions:

- follow / hold / regroup / operate at will;
- operating radius from player/anchor;
- initiative allowance;
- preserve formation vs freely break it;
- return-to-formation/regroup priority;
- local responsibility envelope;
- permission to respond outside assigned sector/slot.

These remain hypotheses until gameplay pressure earns them.

## 9. Dynamics controls

Owner explicitly wants to vary how companions move, not merely where.

Useful experimental controls may include:

- formation spacing;
- slot acquisition urgency;
- regroup urgency;
- cohesion / allowed lag;
- movement responsiveness;
- speed cap relative to player;
- re-assignment hysteresis;
- slot tolerance.

A control is admitted only if changing it creates an immediately observable runtime difference.

Avoid decorative sliders.

## 10. Readability is a hard requirement

At a glance, World/HUD should communicate:

- who is selected;
- focused companion;
- manual / ordered / formation / autonomous authority source;
- target/anchor/slot for selected companions;
- formation frame and editable slot geometry;
- blocked/deviating/arrived state;
- whether a unit is deliberately leaving formation;
- why an order cannot currently be satisfied at a coarse human-readable level.

The sandbox should remain readable with four companions.

If four companions turn it into overlay soup, the design has failed.

## 11. Debug architecture

Do not render four full causal panels.

Use hierarchical observability.

### Group level

Always-available compact summary:

- roster;
- selection;
- global/group order;
- formation state;
- unresolved conflicts;
- episode state.

### Focused companion level

One detailed causal chain:

`player/group intent → assignment → local interpretation → movement/action proposal → constraint/arbitration → World outcome`

### On-world overlays

Scoped to selection by default:

- slot;
- target;
- anchor;
- path;
- authority/provenance;
- conflict/deviation marker.

Optional "show all" exists for forensic use.

### Incident capture

Capture must eventually include:

- roster;
- selection/focus;
- setup state;
- formation geometry;
- group/member orders;
- per-member authority/provenance;
- dynamics parameters;
- World situation;
- causal frames.

## 12. Scenario breadth

The sandbox should not be tied to one threat state machine.

A coherent first playground should allow the same squad/control model to be exercised across several already-relevant pressures:

1. **Open / free movement** — basic relationship and formation feel.
2. **Pillar / obstacle** — slot preservation vs local route adaptation.
3. **Doorway / narrow space** — compression, order preservation, crossing/conflict.
4. **Head-on / body conflict** — physical interaction and yielding.
5. **Continuous cooperative episode** — preparation, contribution, takeover, recovery, regroup.

The same squad state should ideally survive scenario changes where meaningful, or setup presets should make A/B recreation cheap.

## 13. Relationship to existing brains

Do not generalize every brain to N companions immediately.

The sandbox should allow an authority ladder:

- MANUAL;
- ORDERED POSITION / FORMATION;
- legacy/canonical single-companion brain where valid;
- experimental local autonomy later.

Additional companions may initially remain manual/order-driven while the canonical companion can optionally run existing logic.

This asymmetry is useful research evidence, not a defect.

It enables direct A/B:

- human-puppeted member;
- simple ordered member;
- autonomous canonical member.

## 14. Architecture direction

The current Rapier substrate already stores bodies as `Map<WorldBodyId, PhysicalActor>`.

The single-companion limitation is concentrated above it:

- `ActorId`;
- `MotionIntent`;
- canonical player/companion evidence;
- relationship brains;
- S1–S4 assumptions.

Prefer a bounded extension:

- preserve canonical `ActorId` semantics for historical evidence;
- introduce explicit experimental squad member IDs;
- allow generic body motion at the physical boundary;
- build a separate squad control/model layer;
- do not silently reinterpret extra members as the canonical `companion`.

## 15. The first meaningful wide slice

Do **not** stop after a one-companion command HUD.

The first slice that deserves broad Owner exploration should contain, in one coherent surface:

- player control;
- 1–4 real companion bodies;
- add/remove/reset squad;
- single + multi-selection;
- focused companion;
- direct manual control of focus;
- world-space move/hold target;
- editable formation frame + editable slots;
- spacing/orientation manipulation;
- at least a small set of genuinely meaningful dynamics controls;
- open + obstacle/doorway + continuous-episode situations;
- group summary;
- focus-aware causal debug;
- visible authority/target provenance;
- incident capture or at minimum deterministic setup/export sufficient to reproduce a useful configuration.

This is intentionally wider than the previous gate demos.

It is a **research playground**, not a polished game UI.

## 16. Internal implementation may still be staged

Wide Owner value does not mean one giant unsafe commit.

Internally use reversible tranches:

1. identity + generic physical motion substrate;
2. squad state / selection / focus model;
3. real 1–4 body sandbox;
4. setup placement;
5. world-space orders;
6. editable formation geometry;
7. meaningful dynamics;
8. selection-aware debug;
9. scenario integration;
10. continuous-play falsification.

But do not route a narrow tranche to the Owner as though it were the desired object.

## 17. Promotion criteria

The sandbox is ready for broad Owner exploration when:

- the Owner can spend time experimenting without following a scripted test;
- changing squad setup produces meaningfully different play;
- manual control and orders are visibly distinct;
- formation edits visibly persist and matter;
- several companions remain readable;
- narrow-space conflict produces informative behavior rather than chaos;
- the continuous cooperative episode can be authored and replayed through the same interface;
- debug explains surprising behavior after the fact;
- the interface exposes enough freedom to discover behaviors we did not explicitly script.

The benchmark is not "all controls work".

The benchmark is:

> **Does this feel like a laboratory in which the Owner can genuinely explore how a small companion squad should move, organize, respond and cooperate?**

---

## 18. Integrated machine checkpoint — 2026-09-22

The campaign has crossed its first broad substrate boundary.

Source `199c3d07d587660c5902b0fc3c7562d1850c545b` passed the full repository gate and the integrated `squad-field-lab-browser` rehearsal in run `35719945581`.

The qualified surface now combines real 1–4-body roster control, direct/manual authority, selection-scoped orders, editable formations/dynamics, multiple physical layouts, preserved live spatial setup and continuous cooperative pressure in one runtime.

This is deliberately **not** an Owner-test promotion.

The next campaign objective is breadth of unscripted experimentation and reproducibility: make it cheap to author, perturb, capture, restore and compare meaningful squad configurations, then use repeated Owner-authored patterns as evidence for future autonomy.



---

## 19. Owner-reaffirmed advanced authoring doctrine — 2026-09-24

The Owner reaffirmed that the Field Lab should grow into an **advanced, highly manipulable behavior laboratory**, not merely a command demo with a fixed handful of sliders.

This sharpens the campaign in four ways.

### 19.1 Parameters are an experimental surface, not UI decoration

The lab should expose a broad set of **causally meaningful** variables when they exist, including per-member and group-level movement, formation, responsiveness, authority and behavior parameters.

The goal is not maximal slider count. The goal is that the Owner can deliberately perturb the mechanisms that actually shape behavior and immediately observe the consequence.

Prefer:
- coherent parameter groups;
- exact numeric editing where useful;
- direct manipulation where spatial meaning is clearer;
- live inspection of the currently effective value;
- explicit scope: member / selection / group / formation / scenario;
- permissive ranges unless a value would make the runtime unstable rather than merely strange.

Avoid:
- decorative controls with weak/no observable effect;
- hidden clamping that makes experiments look valid while silently changing the authored value;
- exposing low-level implementation constants with no intelligible behavioral meaning.

### 19.2 Authoring must become reproducible evidence

A useful experiment should not disappear when the Owner changes scenario or reloads.

The Field Lab should progressively support a reproducible experiment description containing, where applicable:

`roster + body/setup state + selection/focus + formation geometry + orders + behavior/dynamics parameters + scenario + authority mode`.

The representation should be cheap to:
- capture;
- restore;
- duplicate;
- perturb;
- compare A/B;
- label with the observation/question being investigated.

This is more important than polishing a final-facing UX.

### 19.3 Manual behavior is a gold-standard generator

Manual/direct control and authored formations are not temporary fallbacks to be removed once AI exists.

Repeated Owner-authored solutions are research data about:
- useful geometry;
- timing;
- regroup/recovery;
- when formation should be preserved or broken;
- how much local deviation is desirable;
- how fast responsibility should transfer;
- which variables actually matter to perceived cooperation.

A candidate autonomous behavior should be able to reproduce, generalize or improve a useful authored pattern under changing conditions before it earns more responsibility.

The comparison should preserve the distinction between:
- exact replay of an authored solution;
- intent/constraint inferred from that solution;
- autonomous generalization.

### 19.4 The lab should support discovery beyond current vocabulary

Do not let today's FOLLOW/HOLD/MOVE, current formation policy or current dynamics vocabulary become the ceiling of the laboratory.

The Field Lab succeeds when it allows the Owner to discover:
- a useful behavior we did not pre-name;
- an interaction between parameters we did not predict;
- a formation or recovery pattern that suggests a new semantic primitive;
- a repeated manual intervention that reveals what autonomy is missing.

Therefore future authoring infrastructure should be judged partly by **expressive reach**:
can the Owner create materially different squad behavior without needing a new hard-coded mode for every experiment?

This strengthens, rather than replaces, the existing rule that every exposed variable must produce interpretable runtime consequences.

---

## 20. Reproducible experiment substrate + scoped dynamics — 2026-09-24

The campaign now has a stronger experimental backbone.

Qualified source `969a6bf90db67f6fedf48627fba092870b641fb5` passed full repository, broad Field Lab and persistent A/B browser gates in run `36060223003`.

Newly earned capabilities:

- versioned persistent experiment setups;
- exact restore of physical and authoring state;
- structural A/B diff;
- labels that survive reload;
- exact numeric parameter editing;
- group defaults versus selection-scoped member overrides;
- independent slowdown-radius authoring;
- explicit rejection of unsupported values rather than hidden clamping;
- material proof that scoped responsiveness changes Rapier requested velocity.

This changes the campaign sequencing.

Do not maximize parameter count next.

The next leverage point is temporal trial capture/comparison so new variables can be judged by their actual behavioral consequences, not merely by their existence in the control surface.

Target research loop:

`setup A/B → run traces → outcome/trajectory/error comparison → perturb → recurring Owner solution → candidate autonomy semantic`.

