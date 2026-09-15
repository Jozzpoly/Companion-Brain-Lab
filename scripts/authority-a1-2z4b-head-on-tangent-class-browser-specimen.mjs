import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const WORLD_FRAMES = 60;
const EXPECTED_COMPONENT = 3 / Math.sqrt(2);
const ARTIFACT_DIR = "artifacts/a1-2z4b";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
}

function approx(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2000))}`);
}

async function bridgeIncident(page) {
  return page.evaluate(() => window.__authorityA0BrowserBridge?.incident() ?? null);
}

function headOnFrames(incident) {
  return (incident?.frames ?? []).filter((frame) => frame.scenarioId === "head-on");
}

function hasPairContact(frame) {
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
    centerDistance: distance(frame.situated.playerBody.position, frame.situated.companionBody.position),
    contact: hasPairContact(frame)
  }));
}

async function waitForNewHeadOnFrames(page, baseCount, count, timeout = 5_000) {
  await page.waitForFunction(
    ({ baseCount, count }) => {
      const frames = (window.__authorityA0BrowserBridge?.incident().frames ?? [])
        .filter((frame) => frame.scenarioId === "head-on");
      return frames.length >= baseCount + count;
    },
    { baseCount, count },
    { timeout }
  );
}

async function assertNoFault(page, errors, label) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, `${label}: runtime fault sentinel visible.`);
  invariant(errors.page.length === 0, `${label}: page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `${label}: console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `${label}: request errors: ${errors.requests.join(" | ")}`);
}

async function runVariant(browser, variant) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  try {
    await page.goto("http://127.0.0.1:4173/?a0debug=1", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const canvas = page.locator("#game-root canvas");
    await canvas.waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForFunction(() => window.__authorityA0BrowserBridge?.enabled === true, null, { timeout: 10_000 });
    await page.locator('[data-action="scenario-head-on"]').click();
    await waitForPanel(page, (text) => text.includes("scenario Head-on contact"), 10_000, `${variant.id} head-on`);
    await page.locator('[data-action="cycle-mode"]').click();
    await waitForPanel(
      page,
      (text) => text.includes("mode MANUAL") && text.includes("A1 OFF"),
      10_000,
      `${variant.id} MANUAL/A1 OFF`
    );
    await page.waitForTimeout(150);
    await assertNoFault(page, errors, variant.id);

    // Capture the participant pre-action frame first. Screenshot capture itself can
    // span multiple live World steps, so the A0 frame baseline must be sampled
    // afterwards or those idle steps contaminate the bounded action window.
    const participantBefore = await canvas.screenshot({ type: "jpeg", quality: 60 });
    const beforeIncident = await bridgeIncident(page);
    const baseCount = headOnFrames(beforeIncident).length;

    await page.keyboard.down("d");
    await page.keyboard.down("ArrowRight");
    await page.keyboard.down(variant.verticalKey);

    await waitForNewHeadOnFrames(page, baseCount, 30);
    const participantMid = await canvas.screenshot({ type: "jpeg", quality: 60 });
    await waitForNewHeadOnFrames(page, baseCount, WORLD_FRAMES);

    await page.keyboard.up("d");
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up(variant.verticalKey);

    const participantAfter = await canvas.screenshot({ type: "jpeg", quality: 60 });
    const researchAfter = await page.screenshot({ type: "jpeg", quality: 55, fullPage: true });
    const incident = await bridgeIncident(page);
    const frames = headOnFrames(incident).slice(baseCount, baseCount + WORLD_FRAMES);
    const trajectory = trajectoryFrom(frames);

    invariant(trajectory.length === WORLD_FRAMES, `${variant.id}: expected ${WORLD_FRAMES} frames, got ${trajectory.length}.`);
    const active = trajectory.filter((frame) => frame.playerControl.x > 0.99);
    invariant(active.length >= 55, `${variant.id}: too few active player frames (${active.length}).`);

    const commandFrames = active.filter((frame) =>
      approx(frame.companionCommand.x, EXPECTED_COMPONENT, 1e-5) &&
      approx(frame.companionCommand.y, variant.expectedY, 1e-5)
    );
    invariant(commandFrames.length >= 55, `${variant.id}: browser command did not match the Z4 tangent velocity often enough (${commandFrames.length}).`);

    const contacts = trajectory.filter((frame) => frame.contact);
    invariant(contacts.length === 0, `${variant.id}: tangent class still produced ${contacts.length} player/companion contact frames.`);

    const first = trajectory[0];
    const last = trajectory.at(-1);
    invariant(first && last, `${variant.id}: empty trajectory.`);
    const minCenterDistance = Math.min(...trajectory.map((frame) => frame.centerDistance));
    const playerDisplacement = distance(first.player, last.player);
    const companionDisplacement = distance(first.companion, last.companion);
    invariant(playerDisplacement > 1.5, `${variant.id}: player displacement too small (${playerDisplacement}).`);
    invariant(companionDisplacement > 1.5, `${variant.id}: companion displacement too small (${companionDisplacement}).`);

    await assertNoFault(page, errors, variant.id);
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await writeFile(`${ARTIFACT_DIR}/${variant.id}-before.jpg`, participantBefore);
    await writeFile(`${ARTIFACT_DIR}/${variant.id}-mid.jpg`, participantMid);
    await writeFile(`${ARTIFACT_DIR}/${variant.id}-after.jpg`, participantAfter);
    await writeFile(`${ARTIFACT_DIR}/${variant.id}-research.jpg`, researchAfter);

    return {
      id: variant.id,
      semanticClass: "REFLECTED_TANGENT_ALTERNATIVE",
      control: {
        player: "D",
        companion: ["ArrowRight", variant.verticalKey],
        expectedCompanionVelocity: { x: EXPECTED_COMPONENT, y: variant.expectedY }
      },
      frameCount: trajectory.length,
      activeFrameCount: active.length,
      exactCommandFrameCount: commandFrames.length,
      contactFrameCount: contacts.length,
      minCenterDistance,
      playerDisplacement,
      companionDisplacement,
      firstState: { player: first.player, companion: first.companion },
      lastState: { player: last.player, companion: last.companion },
      trajectory,
      imageBytes: {
        before: participantBefore.length,
        mid: participantMid.length,
        after: participantAfter.length,
        research: researchAfter.length
      },
      errors
    };
  } finally {
    await page.keyboard.up("d").catch(() => undefined);
    await page.keyboard.up("ArrowRight").catch(() => undefined);
    await page.keyboard.up(variant.verticalKey).catch(() => undefined);
    await context.close();
  }
}

const variants = [
  { id: "tangent-negative-y", verticalKey: "ArrowUp", expectedY: -EXPECTED_COMPONENT },
  { id: "tangent-positive-y", verticalKey: "ArrowDown", expectedY: EXPECTED_COMPONENT }
];

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const variant of variants) results.push(await runVariant(browser, variant));

  const mirrorInitialError = distance(results[0].firstState.player, results[1].firstState.player) +
    distance(results[0].firstState.companion, results[1].firstState.companion);
  invariant(mirrorInitialError <= 1e-9, `Tangent specimens did not start from the same physical state (${mirrorInitialError}).`);

  const summary = {
    schema: "companion-brain-lab-a1-2z4b-head-on-tangent-class-browser-v1",
    authority: "ZERO_A1_2_MOVEMENT_AUTHORITY_MANUAL_SPECIMEN_ONLY",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: await browser.version(),
    scenario: "head-on",
    worldFramesPerVariant: WORLD_FRAMES,
    relationToZ4: "EXECUTES_BOTH_REFLECTED_TANGENT_COMMANDS_AS_BOUNDED_MANUAL_BROWSER_SPECIMENS_NO_SELECTOR_CLAIM",
    results: results.map(({ trajectory, ...result }) => result)
  };
  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  await writeFile(`${ARTIFACT_DIR}/trajectories.json`, JSON.stringify(results.map((result) => ({ id: result.id, trajectory: result.trajectory })), null, 2));
  console.log(`[AUTHORITY_A1_2Z4B_HEAD_ON_TANGENT_CLASS_BROWSER] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
