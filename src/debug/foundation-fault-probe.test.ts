import { describe, expect, it } from "vitest";
import {
  FOUNDATION_FAULT_PROBE_PARAM,
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
});
