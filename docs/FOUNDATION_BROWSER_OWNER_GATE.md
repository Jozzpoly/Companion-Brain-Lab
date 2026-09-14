# Foundation Browser / Owner Gate

Status: **OPEN — NORMAL-RUNTIME TORTURE GATE REMAINS**

Current exact public Owner-gate runtime:

`b217943e027e66993f0010643b2933b01d4b1e6d`

Public URL:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

The previous deterministic fault rehearsal on runtime `81877d7...` produced valid real-browser containment evidence, but also exposed a serious apparatus UX defect: `Reload workbench` preserved `?foundationFaultProbe=1`, so the deliberate fault re-armed after every reload. That Owner finding is preserved in `FOUNDATION_OWNER_FAULT_PROBE_EVIDENCE.md`.

The probe is one-shot in the current runtime. The Owner does **not** need to repeat the fault rehearsal before continuing. The remaining gate is the ordinary runtime itself.

## Gate A — normal public-artifact sanity

Open the ordinary URL and verify:
- workbench loads without a spontaneous fault surface;
- World ticks advance;
- player input works;
- companion spatial/NATURAL mode runs;
- scenario switching works;
- pause/single-step/reset work;
- incident capture still downloads JSON.

Any spontaneous fault on the ordinary URL is a foundation FAIL and should be preserved immediately.

## Gate B — Owner torture run

Primary mode: `SPATIAL + NATURAL`.

Use DIRECT selectively as a comparison, not as a replacement for the NATURAL gate.

The run does not need to be scripted frame-for-frame. Deliberately create the classes that historically broke the substrate.

### Wall / boundary contact

- push or drive the companion into static geometry;
- pin it briefly;
- scrape along boundaries/corners;
- release and reverse away;
- repeat from different approach angles.

Require:
- recovery rather than permanent zero-motion;
- no silent runtime termination;
- contact/egress state remaining causally understandable.

### Doorway / choke contention

- enter and reverse repeatedly through the doorway;
- block the companion with the player;
- release the conflict;
- alternate which side of the opening the player occupies;
- force repeated contention rather than one clean pass.

Require:
- temporary blocking/unreachable states remain temporary when geometry allows recovery;
- no whole-workbench freeze;
- no uncontrolled retry thrash.

### Rapid player reversals / moving objective

- move back and forth repeatedly;
- stop abruptly;
- cross in front of the companion;
- reverse again before it has fully settled.

Require:
- moving-objective tracking remains live;
- no autonomous zero-motion lock;
- retry budget does not behave like a lifetime cap.

### Long continuous run

- keep the simulation active substantially longer than a single interaction;
- use multiple scenarios rather than resetting after one short success;
- use 2x time scale as additional stress after ordinary 1x behavior looks sane.

The purpose is to expose delayed/stale state and repeated independent recovery episodes.

### DIRECT / NATURAL comparison

Repeat at least one difficult contact/choke sequence in each actuator mode.

Do not require identical feel. Require both to preserve the shared survival/recovery contract.

## Evidence to capture

If anything looks suspicious, capture an incident immediately with `I` / the incident control.

Especially preserve:
- unexpected zero motion;
- physically wrong `PERSISTENT_UNREACHABLE`;
- `NO_SAFE_VELOCITY` that does not clear after the conflict clears;
- repeated recovery loops;
- incorrect ARRIVED / intentional-hold semantics;
- disappearance / teleportation;
- any spontaneous fault surface or freeze.

Useful incident evidence includes:
- observation tick and outcome tick;
- relationship state/target;
- route status/path;
- hard vs comfort evidence;
- preferred/refined/final command evidence;
- recovery state/action;
- `retryBudgetUsedThisEpisode`;
- `cumulativeLocalRetriesSinceReset`.

Video remains important for timing and visual/feel failures.

## Overall foundation PASS

The foundation passes only if the normal public artifact survives the torture run without unexplained whole-runtime shutdown and constrained contact states either recover or fail closed with understandable evidence.

Minor feel problems, the simplistic eight-slot relationship policy, lack of player right-of-way and missing catch-up pace do not automatically fail this substrate gate unless they expose a survival / contract / causal-truth defect.

## If the gate passes

Record the final readiness verdict and freeze the foundation evidence boundary. Then begin the intentionally aggressive Companion Coordination Core redesign rather than polishing the legacy eight-slot system.

## If the gate fails

Preserve the exact public runtime SHA, incident/video/fault JSON and last visible causal state. Classify the failure before repair and promote the newly observed class into a deterministic regression whenever practical.
