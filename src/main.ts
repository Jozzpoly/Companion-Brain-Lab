import Phaser from "phaser";
import {
  installRuntimeFaultSentinel,
  normalizeRuntimeFault
} from "./debug/runtime-fault-sentinel";

let game: Phaser.Game | null = null;
const reportRuntimeFault = installRuntimeFaultSentinel({
  onFirstFault: () => {
    game?.loop.stop();
  }
});

/**
 * Select the runtime before importing either scene. The default R1 research
 * probes should not pull 50+ coordination modules into a Field Lab session.
 * Catch asynchronous module-load errors through the same fail-stop sentinel.
 */
async function startSelectedRuntime(): Promise<void> {
  try {
    const rawSearch = window.location.search;
    const fieldLabActive = new URLSearchParams(rawSearch).get("fieldlab") === "1";
    let scene: typeof Phaser.Scene;
    let afterGameCreated: (() => void) | null = null;

    if (fieldLabActive) {
      const { SquadFieldLabScene } = await import("./app/squad-field-lab-scene");
      scene = SquadFieldLabScene;
      document.title = "Companion Brain Lab — Squad Field Lab";
    } else {
      const { prepareR1Runtime } = await import("./app/r1-runtime-entry");
      const prepared = prepareR1Runtime(rawSearch);
      scene = prepared.scene;
      afterGameCreated = prepared.afterGameCreated;
    }

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-root",
      backgroundColor: "#111318",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1200,
        height: 800
      },
      scene: [scene]
    });

    // Preserve the old R1 fault-probe scheduling point: after Game creation.
    afterGameCreated?.();
  } catch (error) {
    reportRuntimeFault(normalizeRuntimeFault({
      source: "manual",
      value: error
    }));
  }
}

void startSelectedRuntime();
