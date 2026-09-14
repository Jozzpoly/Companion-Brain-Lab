# Foundation Browser / Owner Gate

Status: **PASS · CLOSED**

Canonical final verdict:

[`FOUNDATION_FINAL_READINESS.md`](FOUNDATION_FINAL_READINESS.md)

Owner-tested public runtime:

`b217943e027e66993f0010643b2933b01d4b1e6d`

Public URL:

`https://jozzpoly.github.io/Companion-Brain-Lab/`

## Gate A — catastrophic-fault observability

An earlier public candidate was exercised with the deliberate `FOUNDATION_FAULT_PROBE`.

Real-browser evidence confirmed:

- the expected fault reached the independent sentinel surface;
- a valid fault JSON was downloadable;
- catastrophic failure did not remain an unexplained stale `RUNNING` screen.

That rehearsal also exposed an apparatus UX failure: the probe query parameter survived reload and repeatedly re-armed the deliberate fault. The failure is preserved in `FOUNDATION_OWNER_FAULT_PROBE_EVIDENCE.md`.

The current public runtime makes the probe one-shot and labels recovery `Reload normally`.

Gate classification:

**CONTAINMENT PASS · PROBE UX FAILURE PRESERVED AND REPAIRED.**

## Gate B — ordinary public-runtime torture

The Owner exercised the ordinary current public runtime for approximately 123 seconds.

The run included multiple scenarios and sustained constrained interactions. Review specifically searched for:

- wall/boundary contact and release failures;
- doorway / chokepoint contention;
- rapid moving-objective reversals;
- permanent zero-motion states;
- sticky `NO_SAFE_VELOCITY`;
- persistent-unreachable / retry thrash;
- actor disappearance / teleportation;
- spontaneous fault surfaces;
- whole-runtime freeze.

Observed result:

- no spontaneous fault surface;
- no unexplained whole-runtime freeze;
- no permanent companion shutdown;
- no sticky no-safe-velocity or recovery loop;
- movement remained live throughout the run apart from explicit scenario resets and intentional stops;
- the longest suspicious both-actors-still section was approximately 1.6 seconds, but the workbench explicitly reported `ARRIVED`, direct/clear route state, zero requested/actual motion, and movement later resumed.

The Owner reported that they were unable to destroy the runtime in this run.

Primary Owner actuator was NATURAL.

A later dedicated DIRECT 180-step full-chain hard-egress/player-pressure rehearsal passes on branch head `7c2d25dead58ca26d3bb195bc1b91911c60d32a5`, closing the survival-contract A/B coverage gap without requiring another Owner recording.

Gate classification:

**OWNER ORDINARY-RUNTIME TORTURE PASS.**

## Boundary of the PASS

This gate validates the substrate, not the quality of the current companion design.

The following remain intentionally open for the next aggressive redesign:

- legacy eight-slot relationship positioning;
- player right-of-way / movement corridor;
- pace / urgency / catch-up;
- desired-speed / MotionIntent redesign;
- NATURAL temporal realization versus dynamic player-conflict authority;
- later multi-companion coordination, commands and combat.

Those limitations do not reopen this foundation gate unless they reveal a new substrate survival / authority / causal-truth failure.

## Final result

The browser/Owner gate is closed.

**FOUNDATION PASS · REWORK-READY.**
