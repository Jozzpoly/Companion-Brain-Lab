import Phaser from "phaser";
import { R1LabScene } from "./app/r1-lab-scene";
import { installAuthorityA0BrowserBridge } from "./debug/authority-a0-browser-bridge";
import { scheduleFoundationFaultProbe } from "./debug/foundation-fault-probe";
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

try {
  installAuthorityA0BrowserBridge(window.location.search);

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
    scene: [R1LabScene]
  });

  scheduleFoundationFaultProbe(window.location.search);
} catch (error) {
  reportRuntimeFault(normalizeRuntimeFault({
    source: "manual",
    value: error
  }));
}
