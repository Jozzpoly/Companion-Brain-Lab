# S1-A — Shared-danger World Contract

Status: **IMPLEMENTED CONTRACT SPIKE · ZERO BRAIN AUTHORITY**
Date: **2026-09-20**

Parent:
- [FIRST_TEAMMATE_SITUATION_PLAN.md](FIRST_TEAMMATE_SITUATION_PLAN.md)
- [COMPANION_EXECUTION_CONTROLLER.md](COMPANION_EXECUTION_CONTROLLER.md)

## Question

What is the smallest authoritative tick contract that lets movement and a material intervention coexist without recreating Stage B's proximity/timer semantics?

## Contract

One tick is ordered as:

`observation t → one physical step → shared post-physics frame → simultaneous action validation → intervention batch → hostile phase/consequence resolution → outcome t+1`

Properties:

- all action attempts see the same post-physics positions and the same pre-resolution hostile phase;
- attempt input order cannot choose a winner;
- multiple legal interventions in one tick may all be factually successful;
- a legal last-moment intervention resolves before hostile consequence;
- an action attempted while the pre-resolution phase is `APPROACHING` does not become retroactively valid if the hostile enters `WINDUP` later in that same tick;
- proximity alone never interrupts the hostile;
- moving out of attack range during windup may make the eventual factual attack miss;
- recovery is explicit and bounded.

Implemented contract module:

`src/world/shared-danger-contract.ts`

This module is pure post-physics World semantics. It does not yet create a hostile body, scenario, browser UI or autonomous cognition.

## Claim budget

May claim:

> the S1 apparatus now has an explicit, testable ordering for `move ≠ act ≠ outcome` and avoids actor-order bias.

May not claim:

- a shared-danger scenario exists in live World;
- player/companion can yet perform the action in browser runtime;
- hostile is embodied;
- combat or teammate AI exists.

## Next authorized work

S1-B may now integrate this contract into one physical World scenario with:

- a material hostile body;
- deterministic World-owned approach/windup/recovery apparatus;
- player + manual/trivial companion action input;
- visible telegraph/outcome.

Do not add autonomous companion responsibility during S1-B.
