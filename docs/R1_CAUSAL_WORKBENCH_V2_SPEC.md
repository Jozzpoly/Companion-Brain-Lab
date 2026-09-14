# R1 — Causal Workbench v2 Spec

Status: **PLANNED RESEARCH APPARATUS / IMPLEMENT AFTER R1-0 RED EVIDENCE**

Date: 2026-09-14

This specification responds directly to Owner evidence that debug is extremely valuable but the current presentation both steals world visibility and can obscure the companion itself.

The workbench is a peer research product. Its purpose is faster causal diagnosis, not dashboard aesthetics.

---

## 1. Primary UX split

Use normal browser layout, not a Phaser text HUD over the playfield.

Working structure:

```text
+--------------------------------------------------------------+
|  game-root / Phaser canvas            |  debug-side-panel    |
|                                       |                      |
|  world + spatial overlays only        |  textual causal      |
|                                       |  inspector/controls  |
|                                       |                      |
+--------------------------------------------------------------+
```

### World owns spatial truth

Keep in the canvas:

- actors / physical body outline;
- hard-body radius;
- desired-clearance envelope when enabled;
- static obstacles;
- route graph / route corridor;
- local spatial rays;
- candidate velocity cloud;
- preferred/refined/commanded/actual vectors;
- player predicted motion;
- blocker/contact point + normal;
- recovery/yield/egress direction;
- trails.

No large text rectangle may cover ordinary world space.

### Side panel owns causal/textual truth

Move out of the world:

- scenario / tick / run state;
- brain/mode/actuator controls;
- relationship objective;
- route status/reason/revision;
- hard clearance / desired clearance status;
- progress/recovery classification;
- candidate counts / top alternatives / score summary;
- preferred -> refined -> commanded -> final-constrained -> actual motion;
- acceleration / jerk / response error;
- contacts / blockers;
- semantic event stream;
- incident capture / failure marker controls;
- layer visibility controls;
- pause / step / time scale.

---

## 2. Browser layout

Use a normal DOM shell with Phaser mounted only inside the game pane.

Conceptual structure:

```text
#lab-shell
  #game-pane
    #game-root
  #debug-panel
```

Desktop default:

- `#lab-shell`: full viewport;
- grid/flex row;
- debug panel approximately `480-520 px` default width;
- panel resizable within a reasonable bound later if cheap;
- game pane fills the remainder;
- panel can collapse to a narrow rail or disappear;
- no body scrolling required for ordinary use; panel itself may scroll.

Why this fits the current apparatus well:

- current authored world is `12 x 8` = aspect ratio `1.5`;
- current internal canvas is `1200 x 800` = same ratio;
- on a ~1918 x 904 Owner viewport, a ~500 px panel leaves a game region close to the world aspect ratio and allows the canvas to use nearly the full vertical dimension;
- current design instead centers a fixed 1200 x 800 canvas and then overlays debug text inside it.

### Phaser scaling direction

Prefer preserving a stable logical game resolution initially and let Phaser Scale Manager fit the canvas inside `#game-root`.

Current-best first implementation:

- logical game size remains `1200 x 800`;
- Phaser parent = `game-root`;
- scale mode = `FIT`;
- centered inside available game pane;
- CSS controls the parent size.

Do not stretch the 12x8 world non-uniformly merely to consume every pixel.

If later experiments need more world visible rather than a larger rendering of the same world, that should be a camera/world-view decision, not CSS distortion.

External grounding:
- Phaser Scale Manager supports fitting a fixed game size inside a parent while preserving aspect ratio: https://docs.phaser.io/phaser/concepts/scale-manager/
- Phaser DOM Elements are overlay containers tied to the canvas; they are not the desired architecture for an independent side panel: https://docs.phaser.io/phaser/concepts/gameobjects/dom-element

---

## 3. Panel behavior

### Collapsed mode

The panel must be collapsible without changing simulation state.

Collapsed presentation should retain only a tiny status rail/button, e.g.:

`RUN 1x | SPATIAL/NATURAL | RECOVERING? | >`

Exact styling is not important.

### Expanded mode

Organize by causal responsibility rather than historical stage names.

Suggested sections:

1. **RUN**
   - run/pause;
   - single step;
   - time scale;
   - reset;
   - scenario.

2. **OBJECTIVE**
   - relationship mode/objective;
   - target/region provenance;
   - relationship revision.

3. **ROUTE**
   - status;
   - revision;
   - hard-feasible / desired-clearance quality;
   - remaining path where meaningful;
   - blocker/reason.

4. **LOCAL MOTION**
   - spatial state;
   - selected candidate;
   - preferred/refined velocity;
   - accepted/rejected counts;
   - dominant score terms.

5. **ACTUATION**
   - DIRECT/NATURAL;
   - commanded velocity;
   - final constrained velocity once R1 adds it;
   - actual velocity;
   - acceleration/jerk/response error.

6. **PROGRESS / RECOVERY**
   - classification;
   - progress window;
   - no-progress duration;
   - hard clearance;
   - desired-clearance violation;
   - recovery action;
   - transition reason;
   - resume/termination condition.

7. **EVENTS**
   - recent semantic transitions;
   - filter by route/spatial/contact/recovery/control.

8. **CAPTURE**
   - mark incident;
   - copy/export incident summary;
   - auto-pause/auto-mark toggles.

Panel sections should be collapsible. Do not show every scalar at once by default.

---

## 4. Direct layer control

The existing preset system remains useful as quick views, but R1 adds direct toggles.

World overlay toggles:

- bodies / physical outline;
- desired-clearance envelope;
- route graph;
- selected route;
- spatial rays;
- candidate cloud;
- player prediction;
- motion vectors;
- trails;
- contacts/normals;
- recovery/egress cue.

Presets can simply set groups of these toggles:

- PLAY;
- ROUTE;
- SPATIAL;
- MOTION;
- RECOVERY;
- ALL.

Do not force Owner to cycle through six presets to reach one layer.

---

## 5. Phase-coherent causal record

The current trace uses a single tick/sample shape. R1 needs an explicit causal step record.

Working conceptual schema:

```text
CausalFrame
  frameSequence

  observation
    worldTick
    actor/world summary
    contacts
    hard/desired clearance

  decisions
    relationshipRevision
    relationship objective
    routeRevision
    route state
    spatialRevision
    preferred motion
    refinement
    progress/recovery state before command

  command
    actuator mode
    commanded motion
    final constrained motion

  outcome
    worldTick
    actual motion
    new contacts
    new clearance
    displacement/progress

  postClassification
    progressing / waiting / blocked / recovering / ...
    transition reason
    next/reconsider condition
```

The implementation need not duplicate full World snapshots at every phase. Compact public evidence is sufficient.

### Critical invariant

A side-panel row labelled “route = unreachable” must identify whether that route classification was used to make the shown command or was computed only after the resulting World step.

Never present pre-step decision and post-step diagnosis as if they were simultaneous state.

---

## 6. Revision identities

Use small monotonic/revision identifiers where they improve causality:

- relationship revision;
- route revision;
- spatial decision revision;
- recovery episode id;
- command frame sequence.

This makes a trace explain relationships such as:

`relationship #12 -> route #31 -> spatial #448 -> command frame #1922 -> outcome tick 1923 -> recovery episode #4`

without requiring hidden reasoning.

---

## 7. Failure-oriented instrumentation

R1 workbench should surface failure states more aggressively than ordinary success.

Candidate triggers:

- route enters `unreachable` away from legitimate arrived state;
- desired-clearance violation begins/ends;
- no-progress threshold crossed;
- recovery begins/ends/times out;
- player-block/yield begins/ends;
- route revision thrash threshold;
- rapid spatial-choice thrash threshold;
- final command differs materially from validated preferred direction near geometry;
- contact begins while commanded motion continues into the contact normal.

Each trigger can:

- create a semantic event;
- mark the trace timeline;
- optionally auto-pause;
- optionally auto-capture an incident snapshot/bundle.

Auto-pause must be user-configurable. It is a research aid, not gameplay behavior.

---

## 8. Small plots — bounded use

Only add plots that reduce diagnosis time.

First useful candidates:

- progress/remaining-distance over last few seconds;
- hard clearance vs desired clearance;
- preferred/commanded/actual speed;
- response error.

Do not build a generic chart dashboard. One or two small rolling strips per active investigation are sufficient.

---

## 9. Incident bundle v2

Preserve bounded export, but include enough provenance to reconstruct the causal chain.

Suggested metadata:

- schema version;
- exact runtime commit if available at build time;
- scenario;
- simulation tick/frame sequence;
- companion mode;
- actuator mode;
- debug layer state;
- current recovery/progress classification;
- route/relationship/spatial revision ids;
- recent causal frames;
- semantic events;
- current controls/time scale;
- Owner label/marker.

The JSON remains an AI/developer artifact. The Owner should never need to read it manually.

---

## 10. A/B workbench improvement

For actuator comparison, prefer one upstream preferred-motion stream feeding two realization policies in controlled tests.

Browser A/B options:

- **live toggle** for fast feel comparison, with obvious state reset marker;
- later **paired replay** only if phase-coherent trace makes it cheap;
- headless identical-input comparison is more important than building replay immediately.

The workbench must show when toggling invalidates controller history so Owner does not mistake reset transients for actuator behavior.

---

## 11. R1-1 gate

Causal Workbench v2 is adequate when the known S4 self-lock can be reproduced while the Owner can determine, within seconds:

1. whether the physical body is hard-legal;
2. whether desired clearance is violated;
3. whether route is valid/unreachable and why;
4. which spatial candidate/preferred motion was selected;
5. what the actuator actually commanded;
6. what World physically did;
7. whether progress/recovery classification changed;
8. what condition would allow the companion to resume.

And all of this must be visible **without covering the companion or main playfield with a text panel**.

This is the actual usability gate; visual polish beyond it is secondary.
