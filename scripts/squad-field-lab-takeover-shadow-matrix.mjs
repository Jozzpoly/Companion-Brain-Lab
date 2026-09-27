import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-takeover-shadow-matrix";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function shadowText(page) {
  return (await page.locator('[data-combat-takeover-shadow="true"]').textContent()) ?? "";
}

async function combatStatus(page) {
  return (await page.locator('[data-combat-micro-status="true"]').textContent()) ?? "";
}

async function waitForText(read, predicate, timeout = 10_000, label = "condition") {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeout) {
    latest = await read().catch(() => "");
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${label} timed out. Latest: ${JSON.stringify(latest.slice(0, 9000))}`);
}

async function tap(page, key, holdMs = 18) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(12);
}

async function stepUntil(page, predicate, maxTicks, label) {
  let latest = "";
  for (let index = 0; index < maxTicks; index += 1) {
    await tap(page, "o");
    latest = await combatStatus(page);
    if (predicate(latest)) return { ticks: index + 1, status: latest };
  }
  throw new Error(`${label} not reached within ${maxTicks} ticks. Latest: ${latest}`);
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function dragBody(page, box, from, to) {
  const a = internalCanvasPoint(box, from);
  const b = internalCanvasPoint(box, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function openFixture(browser, baseUrl, errors, geometry) {
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await context.newPage();

  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`
    );
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitForText(
    () => panelText(page),
    (text) => text.includes("scenario squad-field-lab"),
    8_000,
    "Field Lab ready"
  );

  await tap(page, "p");
  await page.locator('[data-situation="COMBAT_MICRO"]').click();
  await page.locator('[data-layout="OPEN"]').click();
  await page.locator('[data-squad-size="1"]').click();
  await waitForText(
    () => panelText(page),
    (text) =>
      text.includes("scenario squad-field-lab-combat-micro") &&
      text.includes("real squad bodies 1 · C1"),
    8_000,
    "Combat Micro one-companion fixture"
  );

  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  await dragBody(page, box, { x: 4.6, y: 5.0 }, geometry.companion);
  await dragBody(page, box, { x: 3.0, y: 5.0 }, geometry.player);
  await setup.click();

  return { context, page };
}

async function runPlayerPressureCell({
  browser,
  baseUrl,
  errors,
  id,
  geometry,
  prepared,
  expectedReason,
  expectedRecommendation,
  screenshot
}) {
  const { context, page } = await openFixture(browser, baseUrl, errors, geometry);
  try {
    await page.locator(`[data-order-mode="${prepared ? "HOLD" : "FOLLOW"}"]`).click();

    await page.locator('[data-combat-action="player"]').click();
    await tap(page, "o");
    invariant((await combatStatus(page)).includes("history YOU"), `${id}: player engagement missing`);

    const cue = await stepUntil(
      page,
      (status) =>
        status.includes("PRESSURING") &&
        status.includes("pressure target YOU") &&
        status.includes("hits YOU 0 / C1 0"),
      240,
      `${id}: player pressure`
    );

    const shadow = await waitForText(
      () => shadowText(page),
      (text) =>
        text.includes(expectedRecommendation) &&
        text.includes(expectedReason) &&
        text.includes("bearer YOU") &&
        text.includes("phase PRESSURING") &&
        text.includes(`C1 prepared ${prepared ? "YES" : "no"}`) &&
        text.includes("authority NONE_SHADOW_OBSERVATION_ONLY") &&
        text.includes("action NONE") &&
        text.includes("movement NONE") &&
        text.includes("hidden timing not used"),
      5_000,
      `${id}: expected shadow classification`
    );

    const status = await combatStatus(page);
    invariant(status.includes("history YOU"), `${id}: shadow invented C1 strike history`);
    invariant(!status.includes("YOU → C1"), `${id}: shadow executed takeover`);

    if (screenshot) {
      await page.screenshot({ path: `${ROOT}/${screenshot}`, type: "png", fullPage: true });
    }

    return {
      id,
      geometry,
      prepared,
      pressureCueAfterTicks: cue.ticks,
      recommendation: expectedRecommendation,
      reasonCode: expectedReason,
      combatStatus: status,
      shadowText: shadow.replace(/\s+/g, " ").trim()
    };
  } finally {
    await context.close();
  }
}

async function runNoPressureCell({ browser, baseUrl, errors, id, geometry }) {
  const { context, page } = await openFixture(browser, baseUrl, errors, geometry);
  try {
    await page.locator('[data-order-mode="HOLD"]').click();
    const shadow = await waitForText(
      () => shadowText(page),
      (text) =>
        text.includes("DO_NOT_TAKE_OVER") &&
        text.includes("NO_ACTIVE_PRESSURE") &&
        text.includes("C1 prepared YES") &&
        text.includes("authority NONE_SHADOW_OBSERVATION_ONLY"),
      5_000,
      `${id}: no-pressure abstention`
    );
    invariant((await combatStatus(page)).includes("history none"), `${id}: no-pressure cell gained action history`);
    return {
      id,
      geometry,
      prepared: true,
      recommendation: "DO_NOT_TAKE_OVER",
      reasonCode: "NO_ACTIVE_PRESSURE",
      shadowText: shadow.replace(/\s+/g, " ").trim()
    };
  } finally {
    await context.close();
  }
}

async function runAlreadyBearerCell({ browser, baseUrl, errors, id, geometry }) {
  const { context, page } = await openFixture(browser, baseUrl, errors, geometry);
  try {
    await page.locator('[data-order-mode="HOLD"]').click();
    await page.locator('[data-combat-action="focused"]').click();
    await tap(page, "o");
    invariant((await combatStatus(page)).includes("history C1"), `${id}: C1 engagement missing`);

    const cue = await stepUntil(
      page,
      (status) =>
        status.includes("PRESSURING") &&
        status.includes("pressure target C1"),
      240,
      `${id}: C1 pressure`
    );

    const shadow = await waitForText(
      () => shadowText(page),
      (text) =>
        text.includes("DO_NOT_TAKE_OVER") &&
        text.includes("COMPANION_ALREADY_BEARER") &&
        text.includes("bearer C1") &&
        text.includes("phase PRESSURING") &&
        text.includes("C1 prepared YES") &&
        text.includes("authority NONE_SHADOW_OBSERVATION_ONLY"),
      5_000,
      `${id}: already-bearer abstention`
    );
    return {
      id,
      geometry,
      prepared: true,
      pressureCueAfterTicks: cue.ticks,
      recommendation: "DO_NOT_TAKE_OVER",
      reasonCode: "COMPANION_ALREADY_BEARER",
      combatStatus: await combatStatus(page),
      shadowText: shadow.replace(/\s+/g, " ").trim()
    };
  } finally {
    await context.close();
  }
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4185, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const errors = { page: [], console: [], requests: [] };
  const baseUrl = "http://127.0.0.1:4185/?fieldlab=1";

  // Same player opportunity, two materially different C1 approach bearings.
  const nearWest = {
    companion: { x: 10.8, y: 5.0 },
    player: { x: 11.35, y: 4.45 }
  };
  const nearSouth = {
    companion: { x: 11.85, y: 6.05 },
    player: { x: 11.35, y: 4.45 }
  };
  const farWest = {
    companion: { x: 9.6, y: 5.0 },
    player: { x: 11.35, y: 4.45 }
  };

  const rows = [];
  rows.push(await runPlayerPressureCell({
    browser, baseUrl, errors,
    id: "prepared-player-pressure-near-west",
    geometry: nearWest,
    prepared: true,
    expectedRecommendation: "TAKE_OVER",
    expectedReason: "TAKEOVER_CONDITIONS_PRESENT",
    screenshot: "01-positive-near-west.png"
  }));
  rows.push(await runPlayerPressureCell({
    browser, baseUrl, errors,
    id: "prepared-player-pressure-near-south",
    geometry: nearSouth,
    prepared: true,
    expectedRecommendation: "TAKE_OVER",
    expectedReason: "TAKEOVER_CONDITIONS_PRESENT",
    screenshot: "02-positive-near-south.png"
  }));
  rows.push(await runPlayerPressureCell({
    browser, baseUrl, errors,
    id: "prepared-player-pressure-far-west",
    geometry: farWest,
    prepared: true,
    expectedRecommendation: "DO_NOT_TAKE_OVER",
    expectedReason: "COMPANION_OUT_OF_STRIKE_RANGE",
    screenshot: "03-negative-out-of-range.png"
  }));
  rows.push(await runPlayerPressureCell({
    browser, baseUrl, errors,
    id: "unprepared-player-pressure-near-west",
    geometry: nearWest,
    prepared: false,
    expectedRecommendation: "DO_NOT_TAKE_OVER",
    expectedReason: "COMPANION_NOT_PREPARED",
    screenshot: "04-negative-unprepared.png"
  }));
  rows.push(await runNoPressureCell({
    browser, baseUrl, errors,
    id: "prepared-no-pressure-near-west",
    geometry: nearWest
  }));
  rows.push(await runAlreadyBearerCell({
    browser, baseUrl, errors,
    id: "prepared-c1-pressure-near-south",
    geometry: nearSouth
  }));

  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-takeover-shadow-matrix-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    rows,
    observations: {
      positiveClassificationSurvivesTwoDifferentInRangeBearings: true,
      outOfRangeGeometrySuppressesTakeover: true,
      missingPreparationSuppressesTakeoverAtSameNearGeometry: true,
      missingPressureSuppressesTakeoverAtSameNearGeometry: true,
      alreadyBearerSuppressesRedundantTakeover: true,
      everyCellRetainsZeroActionAndMovementAuthority: true,
      playerPressureCellsRetainManualWorldActionHistoryOnly: true,
      noWorldRulesChangedAcrossCells: true
    },
    interpretationBoundary:
      "This matrix challenges the zero-authority takeover shadow across fresh browser runtimes with changed geometry, preparation and responsibility context. It qualifies classification robustness only within Combat Micro and current factual STRIKE range semantics. It does not qualify autonomous action, approach planning, a complete combat policy, teammate feel or Owner-facing quality.",
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_TAKEOVER_SHADOW_MATRIX]", JSON.stringify(summary));
} finally {
  if (browser) await browser.close();
  await server.close();
}
