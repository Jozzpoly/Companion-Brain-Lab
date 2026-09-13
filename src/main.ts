import Phaser from "phaser";
import { LabScene } from "./app/lab-scene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1200,
  height: 800,
  backgroundColor: "#111318",
  scene: [LabScene]
});
