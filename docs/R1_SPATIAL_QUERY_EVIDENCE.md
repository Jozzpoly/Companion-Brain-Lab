# R1 spatial-query evidence — initial penetration / egress

Status: **GROUNDING NOTE / NOT AN IMPLEMENTATION DECISION**

Date: 2026-09-14

This note records external API semantics relevant to the R1 clearance-prison hypothesis.

## Current project behavior

`RapierPhysicalWorld.staticCircleTraversal(...)` calls `World.castShape(...)` with `stopAtPenetration = true`.

The same query adapter is reused for several responsibilities, including route graph edges and short-horizon local static feasibility. Those consumers may pass a radius larger than the physical actor body because current route/local movement uses an additional desired static-clearance margin.

Therefore a World state can be physically legal while the enlarged query shape begins intersecting the desired-clearance envelope around static geometry.

## Official Rapier semantics

Rapier's JavaScript shape API documents `stopAtPenetration` as follows:

> If set to `false`, the linear shape-cast won’t immediately stop if the shape is penetrating another shape at its starting point and its trajectory is such that it’s on a path to exit that penetration state.

Official references:

- https://rapier.rs/javascript2d/classes/Shape.html
- https://rapier.rs/docs/user_guides/javascript/scene_queries_shape_casting/

Rapier's scene-query documentation also states that a shape-cast hit with time-of-impact `0.0` means the cast shape is already intersecting a collider at its initial position.

## What this supports

This API behavior makes the current R1 hypothesis mechanically plausible:

- an enlarged planning/query circle can begin in penetration even when the real physical body is legal;
- with `stopAtPenetration = true`, the query can immediately report a blocker;
- with `false`, an egress trajectory may be allowed to leave the initial penetration instead of being rejected at time zero.

## What this does NOT prove

Do not convert this evidence directly into `stopAtPenetration=false everywhere`.

Open questions R1-0/R1-2 must answer include:

- whether the Owner freeze is actually reproduced by initial desired-clearance penetration;
- whether route graph queries and local candidate queries should share the same initial-penetration semantics;
- whether hard physical feasibility and desired-clearance evaluation need separate query modes;
- whether `stopAtPenetration=false` can create false-clear results for trajectories that initially escape one overlap but later remain tactically/physically undesirable;
- whether an explicit clearance/overlap measurement plus egress policy is clearer than changing cast semantics globally;
- whether deterministic-compat 0.20 behaves exactly like the current public documentation in every relevant boundary case.

## R1 decision rule

First encode a deterministic red fixture for a physically legal actor inside the desired-clearance margin. Run the existing adapter and inspect blocker/time-of-impact behavior. Then compare explicitly scoped query variants.

The implementation should choose the smallest semantic contract that makes egress possible without weakening true hard-body collision safety.
