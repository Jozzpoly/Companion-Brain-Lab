import { describe, expect, it } from "vitest";
import { normalizeRuntimeFault } from "./runtime-fault-sentinel";

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
});
