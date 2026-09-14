# Foundation Browser / Owner Gate

Status: **OPEN — RUN ONLY AGAINST THE EXACT PINNED FOUNDATION RUNTIME**

Mechanically qualified runtime source:

`81877d7fab6b52d4ea683c870074cf12e0793c43`

Do not substitute a moving branch head for this gate. The purpose is to test the same source that passed the 136-test mechanical campaign.

## Gate A — deterministic catastrophic-fault containment

Use the published foundation URL with:

`?foundationFaultProbe=1`

Expected behavior after roughly 1.5 seconds:

1. the independent DOM surface appears with `RUNTIME FAULT — SIMULATION FAIL-STOPPED`;
2. the reported message contains `FOUNDATION_FAULT_PROBE`;
3. the last rendered workbench/canvas remains visible behind the fault surface;
4. simulation ticks / causal outcomes stop advancing rather than continuing behind the overlay;
5. `Download fault JSON` produces evidence for the same first fault;
6. secondary faults must not replace the first-fault evidence.

**PASS:** all six properties are observable on the exact published artifact.

**FAIL:** silent freeze, continuing simulation behind the surface, missing/incorrect fault evidence, no surface, or an unrelated startup failure.

After this rehearsal, remove the query parameter and reload. The ordinary URL must start normally.

## Gate B — normal public-artifact sanity

Before torture testing, verify on the ordinary URL:
- workbench loads;
- World ticks advance;
- player input works;
- companion spatial/NATURAL mode runs;
- scenario switching works;
- pause/single-step/reset work;
- incident capture still downloads JSON;
- no fault sentinel appears spontaneously.

Any failure here blocks the Owner torture gate.

## Gate C — Owner torture run

Primary mode: `SPATIAL + NATURAL`.

Use DIRECT selectively as a comparison, not as a replacement for the NATURAL gate.

The run does not need to be scripted frame-for-frame. It should deliberately create the classes that historically broke the substrate.

### Required stress families

**Wall / boundary contact**
- push or drive the companion into static geometry;
- pin it briefly;
- scrape along boundaries/corners;
- release and reverse away;
- repeat from different approach angles.

Watch for:
- recovery rather than permanent zero-motion;
- no silent runtime termination;
- contact/egress state remaining causally understandable.

**Doorway / choke contention**
- enter and reverse repeatedly through the doorway;
- block the companion with the player;
- release the conflict;
- alternate which side of the opening the player occupies;
- force repeated contact rather than one clean pass.

Watch for:
- temporary blocking/unreachable states being temporary when geometry allows recovery;
- no whole-workbench freeze;
- no uncontrolled retry thrash.

**Rapid player reversals / moving objective**
- move back and forth repeatedly;
- stop abruptly;
- cross in front of the companion;
- reverse again before it has fully settled.

Watch for:
- moving-objective tracking remaining live;
- no old autonomous zero-motion lock;
- retry budget not behaving like a lifetime cap.

**Long continuous run**
- keep the simulation active substantially longer than a single interaction;
- use multiple scenarios rather than repeatedly resetting after one short success;
- 2x time scale is useful as additional stress after ordinary 1x behavior looks sane.

The purpose is to give delayed/stale state, recovery bookkeeping and repeated independent episodes enough time to fail if they still can.

**DIRECT / NATURAL comparison**
- repeat at least one difficult contact/choke sequence in each actuator mode;
- do not require identical feel;
- require both to preserve the shared survival/recovery contract.

## Evidence to capture

If anything looks suspicious, capture an incident immediately with `I` / the incident control.

Especially capture:
- unexpected zero motion;
- `PERSISTENT_UNREACHABLE` that seems physically wrong;
- `NO_SAFE_VELOCITY` that does not clear after the physical conflict clears;
- repeated recovery loops;
- incorrect `ARRIVED` / hold semantics;
- apparent disappearance/teleportation;
- any freeze or fault surface.

The incident should expose:
- observation tick and outcome tick;
- relationship state/target;
- route status/path;
- hard vs comfort evidence;
- preferred/refined/final command evidence;
- recovery state/action;
- `retryBudgetUsedThisEpisode`;
- `cumulativeLocalRetriesSinceReset`.

Video is valuable when visual behavior or timing matters more than the JSON tail.

## Overall foundation PASS

The foundation gate passes only if:
- deterministic fault probe proves a real observable fail-stop;
- ordinary public URL resumes normally after the probe;
- the torture run does not reproduce silent whole-runtime freeze;
- constrained contact states recover or fail closed with understandable typed evidence;
- no material contradiction appears between world behavior and causal/debug evidence.

Minor feel problems, simplistic eight-slot relationship choices, lack of player right-of-way, missing catch-up pace and other explicitly deferred design limitations do **not** automatically fail this foundation gate unless they expose a substrate/survival/causal-truth problem.

## If the gate passes

Do not immediately tune the legacy eight-slot system.

First record the final foundation readiness verdict and freeze the evidence boundary. Then begin the intentionally aggressive Companion Coordination Core redesign from the qualified substrate.

## If the gate fails

Do not patch the visible symptom blindly.

Preserve the exact public runtime SHA, incident JSON/video and last visible causal state; classify whether the failure is:
- physical/query semantics;
- browser adapter/orchestration;
- objective semantics;
- movement realization;
- recovery bookkeeping;
- causal evidence mismatch;
- catastrophic runtime failure.

Promote the newly observed class into a deterministic regression whenever practical before repairing it.
