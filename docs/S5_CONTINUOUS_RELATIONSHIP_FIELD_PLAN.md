# S5 — Continuous Relationship Field

Status: **SHADOW RESEARCH / NO MOVEMENT AUTHORITY**

## Why S5 exists

S3 made local locomotion omnidirectional and responsive. S4 separates preferred motion from temporal actuation and adds local direction refinement. The oldest remaining structural simplification is now upstream: S1 still represents the desired relationship to the player as one of eight discrete point slots.

That was useful as an early falsifiable probe, but it is no longer an adequate long-term representation.

A companion should not fundamentally think:

> go to `back-left` point

The working S5 hypothesis is closer to:

> there is currently a region around the player whose positions have different utility; maintain a useful relationship by moving through the good part of that region.

## Evidence-informed separation

S5 keeps the boundaries discovered in earlier stages:

- **relationship field**: where around the player is useful;
- **route layer**: whether/how a body can reach a representative part of that region;
- **local spatial locomotion**: which short-horizon velocity is safe/useful now;
- **motion continuity**: how the body realizes that velocity over time;
- **World**: canonical physical truth.

The field is not a locomotion controller and does not own physics.

## S5-A first probe

The first implementation is deliberately inspectable rather than mathematically opaque.

1. Sample a broad annular field around the player across many angles and several radii.
2. Compute cheap local utility terms for every sample:
   - front obstruction / player-facing relation;
   - preferred-distance band;
   - companion travel cost;
   - static occupancy and local clearance;
   - temporal continuity with the previous field target.
3. Route-evaluate only a small best local shortlist.
4. Mark unreachable candidates explicitly rather than silently discarding them.
5. Define a **good region** from multiple near-best reachable samples.
6. Produce a weighted representative anchor from that region.
7. Revalidate the interpolated anchor. Fall back to the best qualified sample if interpolation produces invalid geometry/topology.

The representative anchor is an adapter for existing S3/S4 systems, not the final semantic model. The field itself remains the primary S5 research object.

## Non-goals

S5-A does not yet include:

- combat threat fields;
- facing/weapon constraints;
- multiple companions or formation occupancy;
- explicit command intent;
- ORCA/RVO crowd constraints;
- learned utility;
- LLM cognition;
- replacing the S1 slot system in the active S4 runtime.

## Falsifiers

The field fails if:

- it merely recreates eight angular slots at higher resolution;
- tiny player-heading changes cause large target discontinuities;
- the representative anchor falls into static geometry;
- the best local region is unreachable but still selected;
- obstacle topology is ignored because only Euclidean distance is scored;
- the field becomes too expensive to inspect or recompute at useful cadence;
- temporal continuity makes it cling to stale bad regions.

## Debug requirements

Before authority, S5 debug must be able to expose:

- all sampled field points;
- invalid samples;
- utility decomposition;
- route-evaluated shortlist;
- reachable vs unreachable shortlist entries;
- good-region membership;
- weighted representative anchor;
- fallback reason when interpolation is rejected;
- old S1 slot target beside the new S5 field for A/B comparison.

## Gate

S5-A can progress from core to browser shadow visualization only after deterministic automated tests prove geometry validity, route-awareness and continuity behavior. It does not receive movement authority from automated evidence alone.
