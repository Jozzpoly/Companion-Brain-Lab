import { chromium } from "playwright-chromium";
import { preview } from "vite";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
}

async function panelText(page) {
  return page.locator("#debug-panel").innerText();
}

async function waitForPanel(page, predicate, timeout = 10_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(50);
  }
  throw new Error(`${label} timed out after ${timeout}ms. Latest panel: ${JSON.stringify(latest.slice(0, 3000))}`);
}

async function bridgeIncident(page) {
  return page.evaluate(() => window.__authorityA0BrowserBridge?.incident() ?? null);
}

function headOnFrames(incident) {
  return (incident?.frames ?? []).filter((frame) => frame.scenarioId === "head-on");
}

function hasPlayerCompanionContact(frame) {
  return frame.playerOutcomeBody.contacts.includes("companion") ||
    frame.companionOutcomeAttribution.contacts.includes("player");
}

function trajectoryFrom(frames) {
  return frames.map((frame) => ({
    observationTick: frame.observationTick,
    outcomeTick: frame.outcomeTick,
    player: { ...frame.situated.playerBody.position },
    companion: { ...frame.situated.companionBody.position },
    playerControl: { ...frame.situated.playerControl.move },
    companionCommand: { ...frame.companionVelocityCommand.velocity },
    contact: hasPlayerCompanionContact(frame)
  }));
}

function emitImageChunks(label, buffer) {
  const encoded = buffer.toString("base64");
  const chunkSize = 1200;
  console.log(`[A1_2Z3_IMAGE_BEGIN] ${JSON.stringify({ label, encoding: "base64", bytes: buffer.length, chars: encoded.length })}`);
  for (let offset = 0, index = 0; offset < encoded.length; offset += chunkSize, index += 1) {
    console.log(`[A1_2Z3_IMAGE_CHUNK] ${label} ${index} ${encoded.slice(offset, offset + chunkSize)}`);
  }
  console.log(`[A1_2Z3_IMAGE_END] ${label}`);
}

async function assertNoFault(page, errors) {
  const sentinel = await page.locator("#runtime-fault-sentinel").count();
  invariant(sentinel === 0, "Runtime fault sentinel became visible during A1.2z3 specimen.");
  invariant(errors.page.length === 0, `Page errors observed: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors observed: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests observed: ${errors.requests.join(" | ")}`);
}

const server = await preview({
  logLevel: "error",
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
});

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
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

  await page.goto("http://127.0.0.1:4173/?a0debug=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA0BrowserBridge?.enabled === true, null, { timeout: 10_000 });

  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Head-on contact"), 10_000, "head-on scenario");
  await page.locator('[data-action="cycle-mode"]').click();
  await waitForPanel(page, (text) => text.includes("mode MANUAL"), 10_000, "MANUAL mode");
  await page.waitForTimeout(150);
  await assertNoFault(page, errors);

  const beforeIncident = await bridgeIncident(page);
  const beforeHeadOnCount = headOnFrames(beforeIncident).length;
  const participantBefore = await canvas.screenshot({ type: "jpeg", quality: 55 });
  invariant(participantBefore.length > 1_000, "Participant pre-contact screenshot is unexpectedly small.");

  await page.keyboard.down("d");
  await page.keyboard.down("ArrowLeft");

  let contactFrame = null;
  let participantContact = null;
  const contactDeadline = Date.now() + 3_000;
  while (Date.now() < contactDeadline) {
    const incident = await bridgeIncident(page);
    const newFrames = headOnFrames(incident).slice(beforeHeadOnCount);
    contactFrame = newFrames.find(hasPlayerCompanionContact) ?? null;
    if (contactFrame) {
      participantContact = await canvas.screenshot({ type: "jpeg", quality: 55 });
      break;
    }
    await page.waitForTimeout(20);
  }

  await page.keyboard.up("d");
  await page.keyboard.up("ArrowLeft");
  invariant(contactFrame, "Real browser head-on specimen never reached player/companion contact.");
  invariant(participantContact && participantContact.length > 1_000, "Participant contact screenshot was not captured.");

  await page.waitForTimeout(250);
  const participantAfter = await canvas.screenshot({ type: "jpeg", quality: 55 });
  const researchAtEnd = await page.screenshot({ type: "jpeg", quality: 50, fullPage: true });
  invariant(participantAfter.length > 1_000, "Participant post-contact screenshot is unexpectedly small.");
  invariant(researchAtEnd.length > participantAfter.length, "Research screenshot should contain more than the participant canvas alone.");

  const finalIncident = await bridgeIncident(page);
  const frames = headOnFrames(finalIncident).slice(beforeHeadOnCount);
  const trajectory = trajectoryFrom(frames);
  invariant(trajectory.length > 10, `Head-on specimen produced too few physical frames (${trajectory.length}).`);

  const first = trajectory[0];
  const last = trajectory.at(-1);
  invariant(first && last, "Head-on specimen trajectory is empty.");
  const contactFrames = trajectory.filter((frame) => frame.contact);
  invariant(contactFrames.length > 0, "Head-on specimen lost contact evidence after capture.");

  const playerDisplacement = distance(first.player, last.player);
  const companionDisplacement = distance(first.companion, last.companion);
  invariant(playerDisplacement > 0.25, `Player did not materially move in head-on specimen (${playerDisplacement}).`);
  invariant(companionDisplacement > 0.25, `Companion did not materially move in head-on specimen (${companionDisplacement}).`);

  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-a1-2z3-head-on-browser-specimen-v1",
    authority: "ZERO_A1_2_MOVEMENT_AUTHORITY_BASELINE_ONLY",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: await browser.version(),
    scenario: "head-on",
    control: "MANUAL_BOTH_ACTORS_APPROACH",
    frameCount: trajectory.length,
    firstObservationTick: first.observationTick,
    lastOutcomeTick: last.outcomeTick,
    firstContactObservationTick: contactFrames[0].observationTick,
    contactFrameCount: contactFrames.length,
    playerDisplacement,
    companionDisplacement,
    participantImageBytes: {
      before: participantBefore.length,
      contact: participantContact.length,
      after: participantAfter.length
    },
    researchImageBytes: researchAtEnd.length,
    firstState: { player: first.player, companion: first.companion },
    lastState: { player: last.player, companion: last.companion },
    errors
  };

  console.log(`[AUTHORITY_A1_2Z3_HEAD_ON_BROWSER_SPECIMEN] ${JSON.stringify(summary)}`);
  console.log(`[AUTHORITY_A1_2Z3_TRAJECTORY] ${JSON.stringify(trajectory)}`);

  if (process.env.A1_2Z3_EMIT_VISUAL_BASE64 === "1") {
    emitImageChunks("participant-before", participantBefore);
    emitImageChunks("participant-contact", participantContact);
    emitImageChunks("participant-after", participantAfter);
    emitImageChunks("research-end", researchAtEnd);
  }

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
