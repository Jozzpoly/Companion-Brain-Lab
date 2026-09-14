export const FOUNDATION_FAULT_PROBE_PARAM = "foundationFaultProbe";
export const FOUNDATION_FAULT_PROBE_MESSAGE =
  "FOUNDATION_FAULT_PROBE: deliberate catastrophic-fault containment rehearsal";
export const FOUNDATION_FAULT_PROBE_DELAY_MS = 1500;

export function foundationFaultProbeRequested(search: string): boolean {
  return new URLSearchParams(search).get(FOUNDATION_FAULT_PROBE_PARAM) === "1";
}

/**
 * Research-only browser gate. The probe is inert unless the exact query flag is
 * present. It deliberately throws outside Phaser after startup so the real
 * window.error -> sentinel -> game-loop-stop path can be rehearsed on the exact
 * published artifact without using DevTools or inventing a gameplay failure.
 */
export function scheduleFoundationFaultProbe(search: string): boolean {
  if (!foundationFaultProbeRequested(search)) return false;
  window.setTimeout(() => {
    throw new Error(FOUNDATION_FAULT_PROBE_MESSAGE);
  }, FOUNDATION_FAULT_PROBE_DELAY_MS);
  return true;
}
