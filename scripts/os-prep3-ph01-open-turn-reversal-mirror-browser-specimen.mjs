import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep3-ph01-open-turn-reversal-mirror";
const PARTICIPANT_DIR = `${ARTIFACT_DIR}/participant`;
const RESEARCH_DIR = `${ARTIFACT_DIR}/research`;
const SCREENSHOT_EVERY = 6;

const STORY = [
  { id: "establish-plus-x", keys: ["d"], steps: 36 },
  { id: "turn-minus-y", keys: ["w"], steps: 36 },
  { id: "brief-stop", keys: [], steps: 18 },
  { id: "reverse-plus-y", keys: ["s"], steps: 36 },
  { id: "release-neutral", keys: [], steps: 18 }
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function panelTick(text) {
  const match = text.match(/tick\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

async function panelText(page) {
  return page.locator("#debug-panel").innerText();
}

async function waitForPanel(page, predicate, timeout = 15_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2400))}`);
}

async function currentTick(page) {
  const tick = panelTick(await panelText(page));
  invariant(Number.isInteger(tick), "Could not parse World tick from panel.");
  return tick;
}

async function singleStep(page, expectedTick) {
  const before = await currentTick(page);
  invariant(before === expectedTick, `Story tick drift before step: expected ${expectedTick}, got ${before}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(
    page,
    (text) => panelTick(text) === expectedTick + 1,
    15_000,
    `single-step t${expectedTick}->${expectedTick + 1}`
  );
}

async function setKeys(page, activeKeys) {
  for (const key of ["w", "a", "s", "d"]) {
    if (activeKeys.includes(key)) await page.keyboard.down(key);
    else await page.keyboard.up(key).catch(() => {});
  }
}

async function captureIncident(page, targetPath) {
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator('[data-action="capture-incident"]').click();
  const download = await downloadPromise;
  const path = await download.path();
  invariant(path, "Incident download produced no local path.");
  const bytes = await readFile(path);
  await writeFile(targetPath, bytes);
  return JSON.parse(bytes.toString("utf8"));
}

function framePhysicalView(frame) {
  return {
    observationTick: frame.observation.worldTick,
    outcomeTick: frame.outcome.worldTick,
    playerControlMove: frame.observation.playerControlMove,
    playerPosition: frame.observation.playerPosition,
    companionPosition: frame.observation.companionPosition,
    commandedMove: frame.command.commandedMove,
    commandedVelocity: frame.command.commandedVelocity,
    companionOutcomePosition: frame.outcome.companionPosition,
    companionRequestedVelocity: frame.outcome.companionRequestedVelocity,
    companionActualVelocity: frame.outcome.companionActualVelocity,
    companionContacts: frame.outcome.companionContacts
  };
}

function comparePhysicalTwins(participantFrames, researchFrames) {
  invariant(
    participantFrames.length === researchFrames.length,
    `Twin frame count mismatch: participant ${participantFrames.length}, research ${researchFrames.length}.`
  );
  let maxPositionError = 0;
  let maxVelocityError = 0;
  for (let index = 0; index < participantFrames.length; index += 1) {
    const a = framePhysicalView(participantFrames[index]);
    const b = framePhysicalView(researchFrames[index]);
    invariant(a.observationTick === b.observationTick, `Twin observation tick mismatch at frame ${index}.`);
    invariant(a.outcomeTick === b.outcomeTick, `Twin outcome tick mismatch at frame ${index}.`);
    invariant(
      a.playerControlMove.x === b.playerControlMove.x &&
      a.playerControlMove.y === b.playerControlMove.y,
      `Twin Owner control mismatch at t${a.observationTick}.`
    );
    maxPositionError = Math.max(
      maxPositionError,
      distance(a.playerPosition, b.playerPosition),
      distance(a.companionPosition, b.companionPosition),
      distance(a.companionOutcomePosition, b.companionOutcomePosition)
    );
    maxVelocityError = Math.max(
      maxVelocityError,
      distance(a.commandedVelocity, b.commandedVelocity),
      distance(a.companionRequestedVelocity, b.companionRequestedVelocity),
      distance(a.companionActualVelocity, b.companionActualVelocity)
    );
    invariant(
      JSON.stringify(a.companionContacts) === JSON.stringify(b.companionContacts),
      `Twin contact mismatch at t${a.outcomeTick}.`
    );
  }
  invariant(maxPositionError <= 1e-9, `Research observation changed World positions; max error ${maxPositionError}.`);
  invariant(maxVelocityError <= 1e-9, `Research observation changed movement; max error ${maxVelocityError}.`);
  return { maxPositionError, maxVelocityError };
}

function relationshipMetrics(frames) {
  const transitions = [];
  let previous = null;
  let maxTargetDisplacement = 0;
  let maxSameLabelTargetDisplacement = 0;
  let labelChangeCount = 0;
  let routeChangeCount = 0;

  for (const frame of frames) {
    const current = {
      tick: frame.observation.worldTick,
      label: frame.decision.relationshipLabel,
      revision: frame.decision.relationshipRevision,
      target: frame.decision.relationshipTarget,
      route: frame.decision.routePath,
      commandVelocity: frame.command.commandedVelocity,
      playerControlMove: frame.observation.playerControlMove
    };
    if (previous) {
      const targetDisplacement =
        previous.target && current.target ? distance(previous.target, current.target) : null;
      if (targetDisplacement !== null) {
        maxTargetDisplacement = Math.max(maxTargetDisplacement, targetDisplacement);
        if (previous.label === current.label) {
          maxSameLabelTargetDisplacement = Math.max(maxSameLabelTargetDisplacement, targetDisplacement);
        }
      }
      const labelChanged = previous.label !== current.label;
      const routeChanged = previous.route !== current.route;
      if (labelChanged) labelChangeCount += 1;
      if (routeChanged) routeChangeCount += 1;
      if (
        labelChanged ||
        routeChanged ||
        (targetDisplacement !== null && targetDisplacement > 0.15)
      ) {
        transitions.push({
          tick: current.tick,
          previousLabel: previous.label,
          label: current.label,
          previousRevision: previous.revision,
          revision: current.revision,
          targetDisplacement,
          routeChanged,
          playerControlMove: current.playerControlMove,
          commandVelocity: current.commandVelocity
        });
      }
    }
    previous = current;
  }

  return {
    maxTargetDisplacement,
    maxSameLabelTargetDisplacement,
    labelChangeCount,
    routeChangeCount,
    transitions
  };
}

function storyBeatForTick(tick) {
  let cursor = 0;
  for (const beat of STORY) {
    const next = cursor + beat.steps;
    if (tick >= cursor && tick < next) return beat.id;
    cursor = next;
  }
  return "after-story";
}

async function runTwin({ browser, research }) {
  const dir = research ? RESEARCH_DIR : PARTICIPANT_DIR;
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true
  });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  const url = research
    ? "http://127.0.0.1:4173/?a1debug=1"
    : "http://127.0.0.1:4173/";

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });

  if (research) {
    await page.waitForFunction(
      () => window.__authorityA11fBrowserBridge?.enabled === true,
      null,
      { timeout: 10_000 }
    );
  }

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "initial pause");
  await page.locator('[data-action="scenario-open"]').click();
  await waitForPanel(
    page,
    (text) =>
      text.includes("scenario Open field") &&
      text.includes("PAUSED") &&
      text.includes("mode SPATIAL") &&
      text.includes("actuator NATURAL") &&
      text.includes("A1 OFF") &&
      panelTick(text) === 0,
    15_000,
    "open baseline reset"
  );

  if (research) {
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(
      page,
      (text) => text.includes("A1 DIRECT") && text.includes("PAUSED"),
      10_000,
      "A1 DIRECT pass-through research lens"
    );
  }

  const manifest = [];
  let tick = 0;
  let imageIndex = 0;
  const initial = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 78 });
  const initialName = `frame-${String(imageIndex).padStart(3, "0")}-t000-initial.jpg`;
  await writeFile(`${dir}/${initialName}`, initial);
  manifest.push({ tick: 0, beat: "initial", file: initialName });
  imageIndex += 1;

  for (const beat of STORY) {
    await setKeys(page, beat.keys);
    for (let index = 0; index < beat.steps; index += 1) {
      await singleStep(page, tick);
      tick += 1;
      if (tick % SCREENSHOT_EVERY === 0 || index === beat.steps - 1) {
        const bytes = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 78 });
        const file = `frame-${String(imageIndex).padStart(3, "0")}-t${String(tick).padStart(3, "0")}-${beat.id}.jpg`;
        await writeFile(`${dir}/${file}`, bytes);
        manifest.push({ tick, beat: beat.id, file });
        imageIndex += 1;
      }
    }
  }
  await setKeys(page, []);

  const incident = await captureIncident(
    page,
    `${dir}/incident.json`
  );

  invariant(incident.schema === "companion-brain-lab-owner-sandbox-incident-v1", "PH-01 incident schema mismatch.");
  invariant(incident.capture.scenario === "open", "PH-01 incident scenario mismatch.");
  invariant(incident.capture.tick === tick, `PH-01 incident tick mismatch: expected ${tick}, got ${incident.capture.tick}.`);
  invariant(incident.capture.actuator === "natural", "PH-01 requires NATURAL baseline actuator.");
  invariant(
    incident.capture.a1Variant === (research ? "direct" : "off"),
    `PH-01 A1 variant mismatch for ${research ? "research" : "participant"} Twin.`
  );
  if (process.env.GITHUB_SHA) {
    invariant(incident.build.sourceSha === process.env.GITHUB_SHA, "PH-01 incident source SHA mismatch.");
    invariant(incident.build.state === "PINNED_SOURCE_SHA", "PH-01 CI build is not pinned.");
  }
  invariant(incident.frames.length === tick, `PH-01 expected ${tick} causal frames, got ${incident.frames.length}.`);
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request errors: ${errors.requests.join(" | ")}`);
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible in PH-01.");

  let researchA11f = null;
  if (research) {
    researchA11f = await page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
    invariant(researchA11f, "PH-01 research Twin lost A1.1f bridge.");
    invariant(researchA11f.authority === "PASS_THROUGH_ONLY", "PH-01 research Twin A1 claimed authority.");
    invariant(researchA11f.lastBridgeError === null, `PH-01 A1.1f bridge error: ${researchA11f.lastBridgeError}`);
    invariant(researchA11f.frameCount === tick, `PH-01 expected ${tick} A1.1f frames, got ${researchA11f.frameCount}.`);
    await writeFile(`${dir}/a1-1f.json`, JSON.stringify(researchA11f, null, 2));
  }

  await writeFile(`${dir}/manifest.json`, JSON.stringify({ research, story: STORY, frames: manifest }, null, 2));
  await context.close();

  return { incident, manifest, researchA11f, errors };
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(PARTICIPANT_DIR, { recursive: true });
  await mkdir(RESEARCH_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const participant = await runTwin({ browser, research: false });
  const research = await runTwin({ browser, research: true });

  const twin = comparePhysicalTwins(participant.incident.frames, research.incident.frames);
  const metrics = relationshipMetrics(participant.incident.frames);

  const researchOrientation = research.researchA11f.frames.map((frame) => ({
    tick: frame.tick,
    beat: storyBeatForTick(frame.tick),
    playerControlMove: frame.situation.situated.playerControl.move,
    playerRequestedVelocity: frame.situation.playerRequestedVelocity,
    playerBodyActualVelocity: frame.situation.situated.playerBody.actualVelocity,
    motionProvenance: frame.situation.situated.playerMotionProvenance.state,
    orientation: frame.observation.orientation,
    semantic: frame.observation.semantic,
    baselineEqualsSelected:
      JSON.stringify(frame.baselineCompanionIntent) === JSON.stringify(frame.selectedCompanionIntent)
  }));

  invariant(
    researchOrientation.every((frame) => frame.baselineEqualsSelected),
    "PH-01 A1 DIRECT research lens changed selected companion intent."
  );

  const summary = {
    schema: "companion-brain-lab-os-prep3-ph01-open-turn-reversal-mirror-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    story: STORY,
    totalSteps: participant.incident.frames.length,
    participant: {
      frameCount: participant.incident.frames.length,
      imageCount: participant.manifest.length,
      incidentBuild: participant.incident.build,
      a1Variant: participant.incident.capture.a1Variant
    },
    research: {
      frameCount: research.incident.frames.length,
      imageCount: research.manifest.length,
      incidentBuild: research.incident.build,
      a1Variant: research.incident.capture.a1Variant,
      a11fFrameCount: research.researchA11f.frameCount,
      a11fAuthority: research.researchA11f.authority
    },
    twinNonInterference: twin,
    relationshipMetrics: metrics,
    interpretationStatus: "UNREAD_PARTICIPANT_FIRST_REQUIRED",
    errors: {
      participant: participant.errors,
      research: research.errors
    }
  };

  await writeFile(`${RESEARCH_DIR}/orientation-summary.json`, JSON.stringify(researchOrientation, null, 2));
  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP3_PH01_OPEN_TURN_REVERSAL_MIRROR] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
