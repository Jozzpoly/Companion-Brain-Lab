import { describe, expect, it } from "vitest";
import {
  FOUNDATION_FAULT_PROBE_PARAM,
  clearFoundationFaultProbeFromUrl,
  foundationFaultProbeRequested
} from "./foundation-fault-probe";

describe("foundation browser fault probe activation", () => {
  it("is inert by default and for near-miss values", () => {
    expect(foundationFaultProbeRequested("")).toBe(false);
    expect(foundationFaultProbeRequested(`?${FOUNDATION_FAULT_PROBE_PARAM}=0`)).toBe(false);
    expect(foundationFaultProbeRequested(`?${FOUNDATION_FAULT_PROBE_PARAM}=true`)).toBe(false);
  });

  it("activates only for the explicit value 1 while preserving unrelated query parameters", () => {
    expect(foundationFaultProbeRequested(`?${FOUNDATION_FAULT_PROBE_PARAM}=1`)).toBe(true);
    expect(foundationFaultProbeRequested(`?scenario=doorway&${FOUNDATION_FAULT_PROBE_PARAM}=1&debug=all`)).toBe(true);
  });

  it("removes only the probe flag so reload after the deliberate fault returns to the normal workbench", () => {
    const cleared = new URL(clearFoundationFaultProbeFromUrl(
      `https://example.test/lab?scenario=doorway&${FOUNDATION_FAULT_PROBE_PARAM}=1&debug=all#evidence`
    ));

    expect(cleared.searchParams.has(FOUNDATION_FAULT_PROBE_PARAM)).toBe(false);
    expect(cleared.searchParams.get("scenario")).toBe("doorway");
    expect(cleared.searchParams.get("debug")).toBe("all");
    expect(cleared.hash).toBe("#evidence");
  });
});
