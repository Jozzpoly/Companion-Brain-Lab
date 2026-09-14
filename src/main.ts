import Phaser from "phaser";
import { S4LabScene } from "./app/s4-lab-scene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1200,
  height: 800,
  backgroundColor: "#111318",
  scene: [S4LabScene]
});
