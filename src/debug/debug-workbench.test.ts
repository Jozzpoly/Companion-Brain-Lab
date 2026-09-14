import { describe, expect, it } from "vitest";
import { DEBUG_PRESETS, DebugWorkbenchState } from "./debug-workbench";

describe("S2/S3 debug workbench presets", () => {
  it("cycles through every preset and wraps deterministically", () => {
    const state = new DebugWorkbenchState("play");
    const observed = [state.preset()];
    for (let index = 0; index < DEBUG_PRESETS.length; index += 1) observed.push(state.cycle());
    expect(observed).toEqual(["play", "brain", "nav", "spatial", "motion", "all", "play"]);
  });

  it("exposes category visibility without coupling it to rendering", () => {
    const state = new DebugWorkbenchState("nav");
    expect(state.visibility()).toEqual({ brain: false, nav: true, spatial: false, motion: false, events: true });
    state.set("spatial");
    expect(state.visibility()).toEqual({ brain: false, nav: true, spatial: true, motion: false, events: true });
    state.set("all");
    expect(state.visibility()).toEqual({ brain: true, nav: true, spatial: true, motion: true, events: true });
  });
});
