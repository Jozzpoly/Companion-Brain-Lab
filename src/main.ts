import Phaser from "phaser";
import { R1LabScene } from "./app/r1-lab-scene";
import { participantSafeSearch } from "./app/owner-review-mode";
import { installAuthorityA0BrowserBridge } from "./debug/authority-a0-browser-bridge";
import { installAuthorityA11fBrowserBridge } from "./debug/authority-a1-1f-browser-bridge";
import { installAuthorityA12p1BrowserBridge } from "./debug/authority-a1-2p1-browser-bridge";
import { installAuthorityA12p2BrowserBridge } from "./debug/authority-a1-2p2-manual-browser-bridge";
import { installAuthorityA12z4cBrowserBridge } from "./debug/authority-a1-2z4c-browser-bridge";
import { installAuthorityA10BrowserBridge } from "./debug/authority-a1-browser-bridge";
import { scheduleFoundationFaultProbe } from "./debug/foundation-fault-probe";
import { installRelationshipCommitmentShadowBrowserBridge } from "./debug/relationship-commitment-shadow-browser-bridge";
import { installRelationshipSemanticPerturbationBrowserBridge } from "./debug/relationship-semantic-perturbation-browser-bridge";
import { installRelationshipSemanticPhysicsShadowBrowserBridge } from "./debug/relationship-semantic-physics-shadow-browser-bridge";
import { installOwnerControlScaleBrowserBridge } from "./debug/owner-control-scale-browser-bridge";
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
  const runtimeSearch = participantSafeSearch(window.location.search);

  installOwnerControlScaleBrowserBridge(runtimeSearch);
  installAuthorityA0BrowserBridge(runtimeSearch);
  installAuthorityA10BrowserBridge(runtimeSearch);
  installAuthorityA11fBrowserBridge(runtimeSearch);
  installAuthorityA12z4cBrowserBridge(runtimeSearch, R1LabScene.prototype);
  installAuthorityA12p1BrowserBridge(runtimeSearch, R1LabScene.prototype);
  // The query-only semantic physics shadow must wrap the unperturbed R1 output.
  // The physical perturbation apparatus is installed outside it afterwards.
  installRelationshipSemanticPhysicsShadowBrowserBridge(runtimeSearch, R1LabScene.prototype);
  // Query-only commitment observation wraps the unperturbed R1 result and never
  // changes intents. The perturbation apparatus remains the outermost wrapper.
  installRelationshipCommitmentShadowBrowserBridge(runtimeSearch, R1LabScene.prototype);
  installRelationshipSemanticPerturbationBrowserBridge(runtimeSearch, R1LabScene.prototype);
  // P2 is intentionally outermost: existing research/shadow apparatus observes
  // the unpromoted path first, then an explicit one-step authorization may replace
  // only the final companion intent. semanticpush is rejected by the P2 bridge.
  installAuthorityA12p2BrowserBridge(runtimeSearch, R1LabScene.prototype);

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

  scheduleFoundationFaultProbe(runtimeSearch);
} catch (error) {
  reportRuntimeFault(normalizeRuntimeFault({
    source: "manual",
    value: error
  }));
}
