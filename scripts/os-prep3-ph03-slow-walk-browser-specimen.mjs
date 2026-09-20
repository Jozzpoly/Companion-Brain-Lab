import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep3-ph03-slow-walk";
const PARTICIPANT_DIR = `${ARTIFACT_DIR}/participant`;
const RESEARCH_DIR = `${ARTIFACT_DIR}/research`;
const OWNER_SCALE = 0.2;
const SLOW_WALK_TICKS = 180;
const RELEASE_TICKS = 60;
const TOTAL_TICKS = SLOW_WALK_TICKS + RELEASE_TICKS;
const SCREENSHOT_EVERY = 12;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function magnitude(v) {
  return Math.hypot(v.x, v.y);
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
  invariant(before === expectedTick, `PH-03 tick drift before step: expected ${expectedTick}, got ${before}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(
    page,
    (text) => panelTick(text) === expectedTick + 1,
    15_000,
    `PH-03 single-step t${expectedTick}->${expectedTick + 1}`
  );
}

async function captureIncident(page, targetPath) {
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator('[data-action="capture-incident"]').click();
  const download = await downloadPromise;
  const path = await download.path();
  invariant(path, "PH-03 incident download produced no local path.");
  const bytes = await readFile(path);
  await writeFile(targetPath, bytes);
  return JSON.parse(bytes.toString("utf8"));
}

async function setOwnerScale(page, scale) {
  await page.waitForFunction(
    () => window.__ownerControlScaleBrowserBridge?.enabled === true,
    null,
    { timeout: 10_000 }
  );
  await page.evaluate((value) => window.__ownerControlScaleBrowserBridge.setScale(value), scale);
  const snapshot = await page.evaluate(() => window.__ownerControlScaleBrowserBridge.snapshot());
  invariant(snapshot.scale === scale, `Owner scale mismatch: expected ${scale}, got ${snapshot.scale}.`);
  invariant(
    snapshot.authority === "TEST_APPARATUS_OWNER_CONTROL_MAGNITUDE_ONLY",
    "Owner scale bridge authority label changed."
  );
  return snapshot;
}

async function captureCanvas(page, dir, index, tick, beat) {
  const file = `frame-${String(index).padStart(3, "0")}-t${String(tick).padStart(3, "0")}-${beat}.jpg`;
  const bytes = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 78 });
  await writeFile(`${dir}/${file}`, bytes);
  return { tick, beat, file, bytes: bytes.length };
}

function physicalView(frame) {
  return {
    observationTick: frame.observation.worldTick,
    outcomeTick: frame.outcome.worldTick,
    playerControlMove: frame.observation.playerControlMove,
    playerPosition: frame.observation.playerPosition,
    companionPosition: frame.observation.companionPosition,
    companionActualVelocity: frame.observation.companionActualVelocity,
    commandedVelocity: frame.command.commandedVelocity,
    companionOutcomePosition: frame.outcome.companionPosition,
    companionRequestedVelocity: frame.outcome.companionRequestedVelocity,
    companionOutcomeVelocity: frame.outcome.companionActualVelocity,
    contacts: frame.outcome.companionContacts
  };
}

function compareTwins(aFrames, bFrames) {
  invariant(aFrames.length === bFrames.length, "PH-03 Twin frame count mismatch.");
  let maxPositionError = 0;
  let maxVelocityError = 0;
  for (let i = 0; i < aFrames.length; i += 1) {
    const a = physicalView(aFrames[i]);
    const b = physicalView(bFrames[i]);
    invariant(a.observationTick === b.observationTick, `PH-03 Twin observation tick mismatch at ${i}.`);
    invariant(a.outcomeTick === b.outcomeTick, `PH-03 Twin outcome tick mismatch at ${i}.`);
    invariant(
      a.playerControlMove.x === b.playerControlMove.x &&
      a.playerControlMove.y === b.playerControlMove.y,
      `PH-03 Twin Owner input mismatch at t${a.observationTick}.`
    );
    maxPositionError = Math.max(
      maxPositionError,
      distance(a.playerPosition, b.playerPosition),
      distance(a.companionPosition, b.companionPosition),
      distance(a.companionOutcomePosition, b.companionOutcomePosition)
    );
    maxVelocityError = Math.max(
      maxVelocityError,
      distance(a.companionActualVelocity, b.companionActualVelocity),
      distance(a.commandedVelocity, b.commandedVelocity),
      distance(a.companionRequestedVelocity, b.companionRequestedVelocity),
      distance(a.companionOutcomeVelocity, b.companionOutcomeVelocity)
    );
    invariant(JSON.stringify(a.contacts) === JSON.stringify(b.contacts), `PH-03 Twin contact mismatch at t${a.outcomeTick}.`);
  }
  invariant(maxPositionError <= 1e-9, `PH-03 research lens changed positions; max error ${maxPositionError}.`);
  invariant(maxVelocityError <= 1e-9, `PH-03 research lens changed movement; max error ${maxVelocityError}.`);
  return { maxPositionError, maxVelocityError };
}

function average(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeBehavior(frames) {
  const samples = frames.map((frame, index) => ({
    tick: frame.observation.worldTick,
    phase: index < SLOW_WALK_TICKS ? "slow-walk" : "release",
    playerControlMagnitude: magnitude(frame.observation.playerControlMove),
    separation: distance(frame.observation.playerPosition, frame.observation.companionPosition),
    companionSpeed: magnitude(frame.observation.companionActualVelocity),
    commandSpeed: magnitude(frame.command.commandedVelocity),
    targetDistance: frame.decision.relationshipTarget
      ? distance(frame.observation.companionPosition, frame.decision.relationshipTarget)
      : null,
    relationshipRevision: frame.decision.relationshipRevision,
    relationshipLabel: frame.decision.relationshipLabel,
    paceLabel: frame.decision.shadowCoordination?.paceLabel ?? null,
    paceDesiredSpeed: frame.decision.shadowCoordination?.desiredSpeed ?? null,
    paceUrgency: frame.decision.shadowCoordination?.paceUrgency ?? null,
    shadowAgeTicks: frame.decision.shadowCoordination?.ageTicks ?? null
  }));

  const walk = samples.slice(0, SLOW_WALK_TICKS);
  const release = samples.slice(SLOW_WALK_TICKS);
  const nearThreshold = 1.8;
  const firstNear = walk.find((sample) => sample.separation <= nearThreshold) ?? null;
  const postNear = firstNear ? walk.filter((sample) => sample.tick >= firstNear.tick) : [];
  const separationDeltas = postNear.slice(1).map((sample, index) => sample.separation - postNear[index].separation);
  let separationTrendFlips = 0;
  let previousSign = 0;
  for (const delta of separationDeltas) {
    const sign = Math.abs(delta) < 1e-4 ? 0 : Math.sign(delta);
    if (sign !== 0 && previousSign !== 0 && sign !== previousSign) separationTrendFlips += 1;
    if (sign !== 0) previousSign = sign;
  }

  let releaseSettledTick = null;
  for (let i = 0; i <= release.length - 6; i += 1) {
    if (release.slice(i, i + 6).every((sample) => sample.companionSpeed < 0.15)) {
      releaseSettledTick = release[i].tick;
      break;
    }
  }

  const paceValuesWalk = walk
    .map((sample) => sample.paceDesiredSpeed)
    .filter((value) => typeof value === "number");

  return {
    slowWalk: {
      frameCount: walk.length,
      ownerControlMagnitudeMin: Math.min(...walk.map((sample) => sample.playerControlMagnitude)),
      ownerControlMagnitudeMax: Math.max(...walk.map((sample) => sample.playerControlMagnitude)),
      separationStart: walk[0]?.separation ?? null,
      separationMin: Math.min(...walk.map((sample) => sample.separation)),
      separationMax: Math.max(...walk.map((sample) => sample.separation)),
      separationEnd: walk.at(-1)?.separation ?? null,
      firstNearTick: firstNear?.tick ?? null,
      companionSpeedAverage: average(walk.map((sample) => sample.companionSpeed)),
      companionSpeedMax: Math.max(...walk.map((sample) => sample.companionSpeed)),
      postNearCompanionSpeedAverage: average(postNear.map((sample) => sample.companionSpeed)),
      separationTrendFlipsAfterNear: separationTrendFlips,
      shadowPaceDesiredMin: paceValuesWalk.length ? Math.min(...paceValuesWalk) : null,
      shadowPaceDesiredMax: paceValuesWalk.length ? Math.max(...paceValuesWalk) : null,
      shadowPaceLabels: [...new Set(walk.map((sample) => sample.paceLabel).filter(Boolean))]
    },
    release: {
      frameCount: release.length,
      separationStart: release[0]?.separation ?? null,
      separationEnd: release.at(-1)?.separation ?? null,
      companionSpeedStart: release[0]?.companionSpeed ?? null,
      companionSpeedEnd: release.at(-1)?.companionSpeed ?? null,
      settledTick: releaseSettledTick,
      companionTravel: release.length > 1
        ? release.slice(1).reduce((sum, sample, index) => {
            const prev = frames[SLOW_WALK_TICKS + index].observation.companionPosition;
            const curr = frames[SLOW_WALK_TICKS + index + 1].observation.companionPosition;
            return sum + distance(prev, curr);
          }, 0)
        : 0
    },
    samples
  };
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

  const query = research ? "?ownerscale=1&a1debug=1" : "?ownerscale=1";
  await page.goto(`http://127.0.0.1:4173/${query}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  const scaleSnapshot = await setOwnerScale(page, OWNER_SCALE);

  if (research) {
    await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  }

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "PH-03 initial pause");
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
    "PH-03 open reset"
  );

  if (research) {
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(page, (text) => text.includes("A1 DIRECT") && text.includes("PAUSED"), 10_000, "PH-03 A1 pass-through");
  }

  const manifest = [];
  let imageIndex = 0;
  manifest.push(await captureCanvas(page, dir, imageIndex++, 0, "initial"));

  await page.keyboard.down("d");
  let tick = 0;
  for (let i = 0; i < SLOW_WALK_TICKS; i += 1) {
    await singleStep(page, tick);
    tick += 1;
    if (tick % SCREENSHOT_EVERY === 0 || tick === SLOW_WALK_TICKS) {
      manifest.push(await captureCanvas(page, dir, imageIndex++, tick, "slow-walk"));
    }
  }

  await page.keyboard.up("d");
  for (let i = 0; i < RELEASE_TICKS; i += 1) {
    await singleStep(page, tick);
    tick += 1;
    if (tick % SCREENSHOT_EVERY === 0 || tick === TOTAL_TICKS) {
      manifest.push(await captureCanvas(page, dir, imageIndex++, tick, "release"));
    }
  }

  invariant(tick === TOTAL_TICKS, `PH-03 story ended at t${tick}, expected t${TOTAL_TICKS}.`);
  const incident = await captureIncident(page, `${dir}/incident.json`);
  invariant(incident.schema === "companion-brain-lab-owner-sandbox-incident-v1", "PH-03 incident schema mismatch.");
  invariant(incident.capture.scenario === "open", "PH-03 incident scenario mismatch.");
  invariant(incident.capture.tick === TOTAL_TICKS, "PH-03 incident capture tick mismatch.");
  invariant(incident.capture.actuator === "natural", "PH-03 requires NATURAL actuator.");
  invariant(
    incident.capture.a1Variant === (research ? "direct" : "off"),
    "PH-03 A1 variant mismatch."
  );
  invariant(incident.frames.length === TOTAL_TICKS, `PH-03 expected ${TOTAL_TICKS} causal frames, got ${incident.frames.length}.`);

  for (let i = 0; i < incident.frames.length; i += 1) {
    const move = incident.frames[i].observation.playerControlMove;
    if (i < SLOW_WALK_TICKS) {
      invariant(Math.abs(move.x - OWNER_SCALE) <= 1e-12 && Math.abs(move.y) <= 1e-12, `PH-03 scaled Owner input mismatch at t${i}.`);
    } else {
      invariant(Math.abs(move.x) <= 1e-12 && Math.abs(move.y) <= 1e-12, `PH-03 release input mismatch at t${i}.`);
    }
  }

  if (process.env.GITHUB_SHA) {
    invariant(incident.build.sourceSha === process.env.GITHUB_SHA, "PH-03 incident source SHA mismatch.");
    invariant(incident.build.state === "PINNED_SOURCE_SHA", "PH-03 CI build is not pinned.");
  }

  let a11f = null;
  if (research) {
    a11f = await page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
    invariant(a11f, "PH-03 research Twin lost A1.1f bridge.");
    invariant(a11f.authority === "PASS_THROUGH_ONLY", "PH-03 research lens gained authority.");
    invariant(a11f.lastBridgeError === null, `PH-03 A1.1f bridge error: ${a11f.lastBridgeError}`);
    invariant(a11f.frameCount === TOTAL_TICKS, `PH-03 expected ${TOTAL_TICKS} A1 frames, got ${a11f.frameCount}.`);
    invariant(
      a11f.frames.every((frame) =>
        JSON.stringify(frame.baselineCompanionIntent) === JSON.stringify(frame.selectedCompanionIntent)
      ),
      "PH-03 A1 research lens changed companion intent."
    );
    await writeFile(`${dir}/a1-1f.json`, JSON.stringify(a11f, null, 2));
  }

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "PH-03 runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `PH-03 page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `PH-03 console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `PH-03 request errors: ${errors.requests.join(" | ")}`);

  await writeFile(
    `${dir}/manifest.json`,
    JSON.stringify({
      research,
      ownerScale: scaleSnapshot,
      story: {
        slowWalkTicks: SLOW_WALK_TICKS,
        releaseTicks: RELEASE_TICKS,
        screenshotEveryTicks: SCREENSHOT_EVERY
      },
      frames: manifest
    }, null, 2)
  );
  await context.close();
  return { incident, manifest, a11f, errors };
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
  const twinNonInterference = compareTwins(participant.incident.frames, research.incident.frames);
  const behavior = summarizeBehavior(participant.incident.frames);

  const researchOwnerMotion = research.a11f.frames.map((frame) => ({
    tick: frame.tick,
    playerControlMove: frame.situation.situated.playerControl.move,
    playerRequestedVelocity: frame.situation.playerRequestedVelocity.velocity,
    playerRequestedSpeed: frame.situation.playerRequestedVelocity.speed,
    playerActualVelocity: frame.situation.situated.playerBody.actualVelocity,
    playerActualSpeed: magnitude(frame.situation.situated.playerBody.actualVelocity),
    motionProvenance: frame.situation.situated.playerMotionProvenance.state,
    orientationSource: frame.observation.orientation?.source ?? null,
    orientationStrength: frame.observation.orientation?.strength ?? null
  }));
  await writeFile(`${RESEARCH_DIR}/owner-motion.json`, JSON.stringify(researchOwnerMotion, null, 2));

  const heldOwner = researchOwnerMotion.slice(0, SLOW_WALK_TICKS);
  const requestedSpeeds = heldOwner.map((frame) => frame.playerRequestedSpeed);
  const actualSpeeds = heldOwner.map((frame) => frame.playerActualSpeed);

  const summary = {
    schema: "companion-brain-lab-os-prep3-ph03-slow-walk-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    story: {
      ownerScale: OWNER_SCALE,
      slowWalkTicks: SLOW_WALK_TICKS,
      releaseTicks: RELEASE_TICKS,
      totalTicks: TOTAL_TICKS
    },
    participant: {
      frameCount: participant.incident.frames.length,
      imageCount: participant.manifest.length,
      build: participant.incident.build
    },
    research: {
      frameCount: research.incident.frames.length,
      imageCount: research.manifest.length,
      build: research.incident.build,
      a11fFrameCount: research.a11f.frameCount,
      a11fAuthority: research.a11f.authority
    },
    ownerMotion: {
      requestedSpeedMin: Math.min(...requestedSpeeds),
      requestedSpeedMax: Math.max(...requestedSpeeds),
      actualSpeedMin: Math.min(...actualSpeeds),
      actualSpeedMax: Math.max(...actualSpeeds),
      actualSpeedAverage: average(actualSpeeds)
    },
    twinNonInterference,
    behavior,
    interpretationStatus: "UNREAD_PARTICIPANT_FIRST_REQUIRED",
    errors: {
      participant: participant.errors,
      research: research.errors
    }
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP3_PH03_SLOW_WALK] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
