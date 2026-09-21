# Squad / Companion Control Research — 2026-09-21

Status: **OWNER-CONFIRMED DIRECTION · RESEARCH AXIS · NOT FINAL UX**

## Owner signal

The Owner explicitly wants substantially more direct, readable control over companions inside the lab:

- manual control of a companion;
- experimental ability to add more companions through the interface;
- strong emphasis on overall readability;
- strong emphasis on readable debug and control;
- ability to change companion position;
- formation control;
- behavior control;
- movement/dynamics control;
- an interface rich enough that experimenting with a small group itself becomes interesting.

This is not treated as a request for cosmetic UI around the existing F1/F2/F3 donor.

It changes how the lab should discover the companion model.

## Strategic interpretation

Manual control is not merely a fallback when autonomy fails.

It can become a **research instrument for discovering the desired autonomous behavior**.

Instead of first inventing an AI behavior and then asking the Owner whether it feels right, the lab should make it possible to manually author/puppeteer the desired squad behavior:

1. select one or several companions;
2. place them relative to the player or world;
3. alter formation/spacing/orientation;
4. alter control/behavior constraints;
5. alter response dynamics;
6. directly drive a selected companion when useful;
7. observe the resulting cooperative episode;
8. only then identify which repeated Owner-authored patterns deserve automation.

This directly supports the project rule:

> situation / affordance / manual baseline before missing brain.

## Control planes to distinguish

The lab should not collapse all control into one command vocabulary.

### 1. Direct puppeteering

A selected companion can be driven manually.

Purpose:

- establish a gold-standard movement/action baseline;
- reproduce a desired maneuver precisely;
- compare AI against a human-authored counterpart;
- isolate World/mechanics problems from cognition problems.

This is different from issuing an order.

### 2. Spatial orders

The Owner should be able to express **where** companions should relate to the player/world.

Candidate interaction grammar:

- select one companion;
- multi-select a group;
- click/drag a target or anchor in the world;
- drag formation slots directly;
- capture a current position as an anchor;
- optionally orient a formation frame.

The important primitive is editable spatial intent, not a fixed list of named formations.

Presets such as line/column/wedge may generate editable slots later, but should not become the only representation.

### 3. Behavioral constraints

Examples of useful research dimensions:

- stay close ↔ operate farther away;
- hold ↔ follow ↔ at-will;
- low initiative ↔ high initiative;
- preserve formation ↔ freely break formation for a problem;
- local responsibility envelope;
- regroup priority after an episode.

These are candidate dimensions, not final player-facing labels.

### 4. Dynamics

The Owner should be able to experiment with how the squad moves, not only where it moves.

Candidate dimensions:

- formation spacing;
- cohesion strength;
- pace matching;
- response urgency;
- acceleration / smoothing / snappiness where the movement substrate supports it;
- tolerance before a companion abandons/re-acquires a slot.

No slider should be exposed before it materially changes runtime behavior.

### 5. Squad membership / selection

The interface should support exploratory small-group work.

First research target:

- one canonical companion remains fully supported;
- add a bounded number of extra experimental companions;
- visible roster;
- clear selection;
- clear selected/group state in world and HUD;
- explicit add/remove/reset controls;
- no claim that multi-companion cognition is solved merely because multiple bodies exist.

## Readability requirements

The control surface should make these truths obvious without opening the forensic microscope:

- which companion(s) are selected;
- which are manually driven vs ordered vs autonomous;
- each selected companion's current spatial target/slot;
- current formation anchor/orientation/spacing;
- whether a companion is complying, constrained, blocked, or deliberately deviating;
- source of the current instruction: direct control, player order, formation, or autonomy.

The forensic workbench must remain available underneath this surface.

Debug should become **selection-aware** rather than dumping every companion's full causal state at once.

Candidate debug pattern:

- group summary always visible;
- selected companion gets detailed causal chain;
- optional overlays show targets/slots/paths for selected units;
- incident capture records roster, selection, formation/control state and per-companion provenance.

## Architectural warning

The current runtime is strongly single-companion:

`ActorId = "player" | "companion"`

and major brain/runtime seams explicitly reference the canonical `companion`.

Do **not** fake multi-companion support only in the UI.

Before extra companions are presented as live actors, introduce a bounded multi-companion substrate that preserves the existing single-companion evidence and does not silently generalize S1–S4 claims.

The likely safe progression is:

1. build the control model and interaction grammar around the existing real companion;
2. make direct selection/spatial manipulation useful;
3. generalize only the minimum World/motion identity needed for additional **manual-only** companions;
4. validate group selection + freeform formation slots with those real bodies;
5. then decide what existing movement/relationship systems should be generalized per companion;
6. only later grant autonomous cognition to more than one companion.

## Relationship to S5

This does not replace the continuous cooperative episode work.

It improves it.

The next high-value S5 evidence can come from a human-authored gold standard inside the same lab:

`ordinary relation → manual spatial preparation → contribution → player takeover/correction → disengage → regroup`

Once the Owner can author this naturally through the control surface, the project can compare autonomy against an actual desired behavior rather than against an abstract state machine.

## Anti-goals

Do not turn this into:

- an RTS editor detached from embodied play;
- a giant command menu;
- a UI-only mockup with fake companions;
- fixed formation presets with no direct manipulation;
- per-companion debug spam;
- immediate multi-agent cognition architecture;
- a resurrection of old F1/F2/F3 as final controls.

## Active research question

> Can the lab become a small, highly legible squad-control instrument where the Owner can directly shape position, formation, behavior and dynamics, and use that authored behavior as evidence for what the companion brain should later learn to do autonomously?

---

## Superseding refinement — broad Field Lab, not one-companion v0

The earlier safe progression in this note remains useful **internally**, but the latest Owner feedback makes one point explicit:

> do not let the first one-companion tranche become the project object.

The meaningful target is a cohesive broad sandbox with 1–4 real bodies, selection, manual control, world-space orders, editable freeform formation geometry, meaningful movement/behavior dynamics, scenario breadth and selection-aware debug.

See:

`docs/COMPANION_SQUAD_FIELD_LAB_CAMPAIGN.md`

