import { describe, expect, it } from "vitest";
import {
  createFirstFaultReporter,
  normalizeRuntimeFault,
  type RuntimeFaultRecord
} from "./runtime-fault-sentinel";

function fault(message: string): RuntimeFaultRecord {
  return normalizeRuntimeFault({
    source: "manual",
    value: new Error(message),
    timestamp: "2026-09-14T15:00:00.000Z"
  });
}

describe("runtime fault sentinel normalization", () => {
  it("preserves Error message and stack with explicit source/location", () => {
    const error = new Error("boom");
    const record = normalizeRuntimeFault({
      source: "window-error",
      value: error,
      timestamp: "2026-09-14T15:00:00.000Z",
      filename: "app.js",
      line: 42,
      column: 7
    });

    expect(record.schema).toBe("companion-brain-lab-runtime-fault-v1");
    expect(record.source).toBe("window-error");
    expect(record.message).toBe("boom");
    expect(record.stack).toContain("Error: boom");
    expect(record.filename).toBe("app.js");
    expect(record.line).toBe(42);
    expect(record.column).toBe(7);
  });

  it("normalizes rejection strings without inventing a stack", () => {
    const record = normalizeRuntimeFault({
      source: "unhandled-rejection",
      value: "rejected",
      timestamp: "2026-09-14T15:00:00.000Z"
    });

    expect(record.message).toBe("rejected");
    expect(record.stack).toBeNull();
    expect(record.filename).toBeNull();
  });

  it("contains and presents only the first fault so secondary errors cannot replace causal evidence", () => {
    const contained: string[] = [];
    const presented: string[] = [];
    const report = createFirstFaultReporter({
      onFirstFault: (record) => contained.push(record.message),
      present: (record) => presented.push(record.message)
    });

    report(fault("primary"));
    report(fault("secondary"));
    report(fault("tertiary"));

    expect(contained).toEqual(["primary"]);
    expect(presented).toEqual(["primary"]);
  });

  it("still presents the primary fault when the containment hook itself fails", () => {
    const presented: string[] = [];
    const containmentErrors: string[] = [];
    const report = createFirstFaultReporter({
      onFirstFault: () => {
        throw new Error("stop-hook-failed");
      },
      onContainmentError: (error) => containmentErrors.push(error instanceof Error ? error.message : String(error)),
      present: (record) => presented.push(record.message)
    });

    report(fault("primary"));

    expect(containmentErrors).toEqual(["stop-hook-failed"]);
    expect(presented).toEqual(["primary"]);
  });
});
