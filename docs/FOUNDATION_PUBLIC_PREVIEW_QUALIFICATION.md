# Foundation Public Preview Qualification

Status: **UPDATED PUBLIC CANDIDATE DEPLOYED · NORMAL-RUNTIME OWNER GATE OPEN**

Current exact runtime: `b217943e027e66993f0010643b2933b01d4b1e6d`.

Validation run `34876312905`: TypeScript PASS, 31/31 test files PASS, 137/137 tests PASS, production build PASS, npm audit 0 vulnerabilities.

The previous candidate `81877d7fab6b52d4ea683c870074cf12e0793c43` was used for the first real Owner fault-containment rehearsal. That run proved the independent fail-stop surface and produced a valid deliberate `FOUNDATION_FAULT_PROBE` fault record, but it also exposed a serious gate-UX defect: reloading preserved `?foundationFaultProbe=1`, so the deliberate fault re-armed after every reload.

The finding is preserved in `FOUNDATION_OWNER_FAULT_PROBE_EVIDENCE.md`.

The current runtime makes the probe one-shot. When armed, it removes only the probe query parameter with `history.replaceState()` before throwing; unrelated query parameters and the hash survive. The recovery action is labelled `Reload normally`. Regression coverage binds the URL-clearing behavior.

Operational Pages workflow commit on `main`: `67c37d8145cdbcbf4044db0a6736418d8c9c6258`.

Pages run `34876484531`: exact checkout / validation / configure / upload / deploy PASS.

Published artifact id `10361440336`, digest `sha256:4b3789c28b1dfaf7d6470720808eccc83b2125d1f87363c470c1fcaa6ad79ebe`.

Public URL: `https://jozzpoly.github.io/Companion-Brain-Lab/`.

The Owner does not need to repeat the deliberate fault probe merely to recreate already-preserved containment evidence. The remaining binding gate is the ordinary runtime: normal startup, wall/boundary push-pin-release, doorway contention, rapid reversals, long continuous movement, DIRECT/NATURAL comparison, and incident/video capture for suspicious behavior.

Any spontaneous fault surface on the ordinary URL is a new foundation failure.
