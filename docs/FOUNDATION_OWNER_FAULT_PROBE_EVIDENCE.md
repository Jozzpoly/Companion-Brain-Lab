# Foundation Owner Fault-Probe Evidence

Status: **CONTAINMENT OBSERVED · PROBE RECOVERY UX FAILED · ONE-SHOT FIX DEPLOYED**

This document records the real Owner-browser rehearsal that followed the mechanically qualified foundation runtime.

## Original public runtime under test

Application runtime:

`81877d7fab6b52d4ea683c870074cf12e0793c43`

The Owner opened the public artifact with:

`?foundationFaultProbe=1`

The resulting downloaded fault record identified the expected deliberate probe:

- schema: `companion-brain-lab-runtime-fault-v1`;
- source: `window-error`;
- message: `FOUNDATION_FAULT_PROBE: deliberate catastrophic-fault containment rehearsal`;
- production bundle location was preserved in the record.

The video also showed the independent red fault surface appearing over the last rendered workbench state.

## What passed

The browser rehearsal demonstrated the intended catastrophic-fault containment path at least once on the real public artifact:

- the deliberate outside-Phaser fault reached `window.error`;
- the sentinel produced the independent fault surface;
- first-fault evidence was downloadable as JSON;
- the displayed fault message matched the deliberate probe rather than an unrelated spontaneous crash.

This is accepted as real browser evidence for the containment surface itself.

## What failed

The probe/recovery UX was badly designed.

`Reload workbench` performed a normal page reload while leaving `?foundationFaultProbe=1` in the URL. The probe therefore armed again on every reload and fired again after its ~1.5 s delay.

The Owner recording showed repeated cycles of:

`reload -> short normal runtime -> deliberate probe -> fail-stop surface -> reload -> deliberate probe again`

This made the workbench effectively unusable and looked like repeated catastrophic runtime failure even though the repeated faults were all self-inflicted by the research probe.

Classification:

**APPARATUS / GATE-DESIGN FAIL, not a new spontaneous companion-runtime crash.**

The earlier public runtime is therefore not retained as the final Owner-gate candidate even though its containment mechanism was observed.

## Repair

The probe is now explicitly one-shot.

When `foundationFaultProbe=1` is detected:

1. the probe is armed;
2. before the deliberate fault fires, `history.replaceState()` removes only the probe query parameter from the visible/current URL;
3. unrelated query parameters and the hash are preserved;
4. the deliberate fault still fires after the same bounded delay;
5. the fault-surface recovery button is labelled `Reload normally`;
6. reloading after the fault therefore returns to the ordinary workbench rather than re-arming the probe.

Regression coverage binds the URL-clearing semantics.

## Requalified runtime after the fix

Exact application runtime:

`b217943e027e66993f0010643b2933b01d4b1e6d`

Validation run:

`34876312905`

Evidence:
- TypeScript PASS;
- 31/31 test files PASS;
- **137/137 tests PASS**;
- production build PASS;
- npm audit: 0 vulnerabilities.

Operational Pages workflow commit:

`67c37d8145cdbcbf4044db0a6736418d8c9c6258`

Pages run:

`34876484531` — build / validation / upload / deploy PASS.

Artifact:
- id `10361440336`;
- digest `sha256:4b3789c28b1dfaf7d6470720808eccc83b2125d1f87363c470c1fcaa6ad79ebe`.

Public URL remains:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

## Evidence boundary after this finding

Do **not** require the Owner to repeat the deliberate fault probe merely to reproduce evidence we already obtained.

The containment surface has real-browser evidence; the reload-loop defect has a deterministic code fix and mechanical regression coverage in the new exact runtime.

The next Owner evidence should focus on the **ordinary URL** and the actual substrate:

- normal startup and controls;
- wall/boundary pin, push and release;
- doorway contention;
- rapid reversals / moving relationship objective;
- long continuous movement;
- DIRECT/NATURAL comparison;
- incident capture for any suspicious behavior.

Any spontaneous fault surface on the normal URL is a new foundation failure and must be preserved as evidence.
