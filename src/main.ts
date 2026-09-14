import Phaser from "phaser";
import { R1LabScene } from "./app/r1-lab-scene";
import { installRuntimeFaultSentinel } from "./debug/runtime-fault-sentinel";

installRuntimeFaultSentinel();

new Phaser.Game({
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
