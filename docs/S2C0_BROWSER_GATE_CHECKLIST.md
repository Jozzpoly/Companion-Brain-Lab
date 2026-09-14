# S2-C0 Owner Browser Gate Checklist

Use the public pinned preview after it has been updated to runtime SHA `1ceb689bb829cec0da0e9eb819a8295da8545853`.

This is a **debug-legibility gate**, not a movement-quality gate. The shadow route does not control the companion yet.

## Minimal pass

1. Press `B` until `NAV` or `ALL` is active.
2. Press `2` for the pillar scenario.
3. Move the player so the companion's current relationship target lies across the pillar.
4. Confirm:
   - direct corridor becomes red / BLOCKED;
   - blocker matches the pillar;
   - selected blue shadow route goes around the obstacle;
   - no selected route edge visibly crosses solid geometry.
5. Press `3` for the doorway scenario.
6. Move/reverse through the doorway and inspect several target positions.
7. Confirm:
   - direct evidence changes independently from shadow route status;
   - when direct is blocked but a static route exists, the route uses the opening rather than a wall;
   - graph clutter is still interpretable enough to explain why a route was chosen.
8. Press `I` on any case that looks geometrically wrong or visually confusing and preserve the downloaded incident JSON.

## PASS means

- visible blocker evidence agrees with authored geometry;
- selected shadow routes are physically plausible for the shown body radius/clearance;
- route status/reason is understandable from HUD + overlay;
- rejected edges add useful causal evidence rather than making NAV unusable;
- no evidence suggests the planner is secretly changing companion motion.

## FAIL / material finding examples

- blue route crosses an obstacle;
- planner says `unreachable` while an obvious body-width static route exists;
- planner says `routed` through a gap narrower than its query radius;
- route rapidly flips between equivalent paths without a meaningful geometry/target change;
- direct blocker marker/normal visibly disagrees with the obstacle;
- graph overlay is too dense to diagnose the known pillar/doorway cases;
- shadow computation materially harms browser responsiveness.

Any such finding should be repaired or explicitly bounded before S2-C1 receives movement authority.
