import type { Vec2 } from "../world/types";

const QUERY_FLAG = "ownerscale";
const SCHEMA = "companion-brain-lab-owner-control-scale-v1";

let activeScale = 1;

export interface OwnerControlScaleSnapshot {
  schema: typeof SCHEMA;
  authority: "TEST_APPARATUS_OWNER_CONTROL_MAGNITUDE_ONLY";
  scale: number;
}

export interface OwnerControlScaleBrowserBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  setScale(scale: number): void;
  snapshot(): OwnerControlScaleSnapshot;
}

declare global {
  interface Window {
    __ownerControlScaleBrowserBridge?: OwnerControlScaleBrowserBridge;
  }
}

export function validateOwnerControlScale(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Owner control test scale must be finite in [0, 1].");
  }
  return value;
}

export function currentOwnerControlScale(): number {
  return activeScale;
}

export function scaleOwnerControlMove(move: Vec2, scale = activeScale): Vec2 {
  const validated = validateOwnerControlScale(scale);
  return {
    x: move.x * validated,
    y: move.y * validated
  };
}

export function installOwnerControlScaleBrowserBridge(search: string): void {
  const params = new URLSearchParams(search);
  if (params.get(QUERY_FLAG) !== "1" || window.__ownerControlScaleBrowserBridge) return;

  activeScale = 1;

  const snapshot = (): OwnerControlScaleSnapshot => ({
    schema: SCHEMA,
    authority: "TEST_APPARATUS_OWNER_CONTROL_MAGNITUDE_ONLY",
    scale: activeScale
  });

  const bridge: OwnerControlScaleBrowserBridge = {
    enabled: true,
    schema: SCHEMA,
    setScale: (scale) => {
      activeScale = validateOwnerControlScale(scale);
    },
    snapshot
  };

  Object.defineProperty(window, "__ownerControlScaleBrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
