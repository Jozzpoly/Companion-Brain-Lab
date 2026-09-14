import { describe, expect, it } from "vitest";
import { CausalPanelDisclosureState } from "./causal-panel";

describe("R1 causal panel disclosure state", () => {
  it("keeps legacy default-open sections while leaving CCC sections collapsed initially", () => {
    const state = new CausalPanelDisclosureState();
    expect(state.isOpen("run")).toBe(true);
    expect(state.isOpen("recovery")).toBe(true);
    expect(state.isOpen("route")).toBe(true);
    expect(state.isOpen("motion")).toBe(true);
    expect(state.isOpen("ccc-where")).toBe(false);
    expect(state.isOpen("ccc-pace")).toBe(false);
    expect(state.isOpen("ccc-player")).toBe(false);
  });

  it("lets explicit user disclosure choices override defaults across subsequent renders", () => {
    const state = new CausalPanelDisclosureState();
    state.remember("ccc-where", true);
    state.remember("route", false);

    expect(state.isOpen("ccc-where")).toBe(true);
    expect(state.isOpen("route")).toBe(false);

    state.remember("ccc-where", false);
    state.remember("route", true);
    expect(state.isOpen("ccc-where")).toBe(false);
    expect(state.isOpen("route")).toBe(true);
  });
});
