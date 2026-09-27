import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-takeover-shadow";

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
  await page.waitForTimeout(100);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4184, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };

  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`
    );
  });

  await page.goto("http://127.0.0.1:4184/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
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
  await dragBody(page, box, { x: 4.6, y: 5.0 }, { x: 10.8, y: 5.0 });
  await dragBody(page, box, { x: 3.0, y: 5.0 }, { x: 11.35, y: 4.45 });
  await setup.click();

  // Explicit preparation exists before the pressure episode, but pressure itself
  // is still required. Readiness alone must not be mistaken for takeover need.
  await page.locator('[data-order-mode="HOLD"]').click();
  const calmShadow = await waitForText(
    () => shadowText(page),
    (text) =>
      text.includes("DO_NOT_TAKE_OVER") &&
      text.includes("NO_ACTIVE_PRESSURE") &&
      text.includes("C1 prepared YES") &&
      text.includes("authority NONE_SHADOW_OBSERVATION_ONLY") &&
      text.includes("action NONE") &&
      text.includes("movement NONE"),
    5_000,
    "prepared no-pressure shadow abstention"
  );
  invariant(calmShadow.includes("hidden timing not used"), "Shadow does not disclose timing boundary.");

  // YOU engages. C1 must remain observational until World exposes PRESSURING YOU.
  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  invariant((await combatStatus(page)).includes("history YOU"), "Player engagement missing.");

  const pressureCue = await stepUntil(
    page,
    (status) =>
      status.includes("PRESSURING") &&
      status.includes("pressure target YOU") &&
      status.includes("hits YOU 0 / C1 0"),
    220,
    "visible player pressure"
  );

  const positiveShadow = await waitForText(
    () => shadowText(page),
    (text) =>
      text.includes("TAKE_OVER") &&
      text.includes("TAKEOVER_CONDITIONS_PRESENT") &&
      text.includes("bearer YOU") &&
      text.includes("phase PRESSURING") &&
      text.includes("C1 prepared YES") &&
      text.includes("strike-now YES") &&
      text.includes("authority NONE_SHADOW_OBSERVATION_ONLY"),
    5_000,
    "positive takeover recommendation"
  );
  invariant(positiveShadow.includes("hidden timing not used"), "Positive shadow used hidden timing.");

  // The recommendation itself must have zero causal authority. Let several World
  // ticks pass without authoring a C1 action and prove C1 never appears in history.
  for (let index = 0; index < 5; index += 1) await tap(page, "o");
  const afterShadowOnlyTicks = await combatStatus(page);
  invariant(afterShadowOnlyTicks.includes("HP 2/3"), `Shadow mutated hostile HP: ${afterShadowOnlyTicks}`);
  invariant(afterShadowOnlyTicks.includes("pressure target YOU"), `Shadow transferred responsibility: ${afterShadowOnlyTicks}`);
  invariant(afterShadowOnlyTicks.includes("history YOU"), `Shadow invented C1 action history: ${afterShadowOnlyTicks}`);
  invariant(!afterShadowOnlyTicks.includes("YOU → C1"), "Shadow recommendation executed a takeover.");

  await page.screenshot({
    path: `${ROOT}/01-positive-shadow-no-authority.png`,
    type: "png",
    fullPage: true
  });

  // Counterfactual: remove preparation while the same factual pressure still exists.
  await page.locator('[data-order-mode="FOLLOW"]').click();
  const unpreparedShadow = await waitForText(
    () => shadowText(page),
    (text) =>
      text.includes("DO_NOT_TAKE_OVER") &&
      text.includes("COMPANION_NOT_PREPARED") &&
      text.includes("bearer YOU") &&
      text.includes("phase PRESSURING") &&
      text.includes("C1 prepared no") &&
      text.includes("strike-now YES"),
    5_000,
    "unprepared pressure counterfactual"
  );
  invariant(
    (await combatStatus(page)).includes("history YOU"),
    "Removing preparation changed World combat history without a combat action."
  );

  // Re-establish explicit readiness. The same material pressure should recover
  // the recommendation without hidden timing or a new combat event.
  await page.locator('[data-order-mode="HOLD"]').click();
  await waitForText(
    () => shadowText(page),
    (text) =>
      text.includes("TAKE_OVER") &&
      text.includes("TAKEOVER_CONDITIONS_PRESENT") &&
      text.includes("C1 prepared YES"),
    5_000,
    "takeover recommendation recovers with explicit preparation"
  );

  // Only a real authored World action may now transfer responsibility.
  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  const manualTakeover = await combatStatus(page);
  invariant(manualTakeover.includes("HP 1/3"), `Manual C1 STRIKE did not affect World: ${manualTakeover}`);
  invariant(manualTakeover.includes("pressure target C1"), `Manual C1 STRIKE did not transfer responsibility: ${manualTakeover}`);
  invariant(manualTakeover.includes("history YOU → C1"), `Manual takeover history missing: ${manualTakeover}`);

  const recoveryShadow = await waitForText(
    () => shadowText(page),
    (text) =>
      text.includes("DO_NOT_TAKE_OVER") &&
      text.includes("NO_ACTIVE_PRESSURE") &&
      text.includes("bearer C1") &&
      text.includes("phase RECOVERING") &&
      text.includes("authority NONE_SHADOW_OBSERVATION_ONLY"),
    5_000,
    "shadow withdraws during post-takeover recovery"
  );
  invariant(recoveryShadow.includes("action NONE"), "Recovery shadow gained action authority.");

  const c1Pressured = await stepUntil(
    page,
    (status) =>
      status.includes("PRESSURING") &&
      status.includes("pressure target C1"),
    220,
    "visible C1 pressure after takeover"
  );
  const alreadyBearerShadow = await waitForText(
    () => shadowText(page),
    (text) =>
      text.includes("DO_NOT_TAKE_OVER") &&
      text.includes("COMPANION_ALREADY_BEARER") &&
      text.includes("bearer C1") &&
      text.includes("phase PRESSURING") &&
      text.includes("authority NONE_SHADOW_OBSERVATION_ONLY"),
    5_000,
    "shadow refuses redundant takeover when C1 already bears pressure"
  );
  invariant(alreadyBearerShadow.includes("action NONE"), "Already-bearer shadow gained action authority.");

  await page.screenshot({
    path: `${ROOT}/02-shadow-withdraws-after-manual-takeover.png`,
    type: "png",
    fullPage: true
  });

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-takeover-shadow-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    positiveCueAfterTicks: pressureCue.ticks,
    observations: {
      preparedWithoutPressureDoesNotRecommendTakeover: true,
      playerPressurePreparedAndInRangeRecommendsTakeover: true,
      recommendationHasZeroWorldActionAuthority: true,
      recommendationHasZeroMovementAuthority: true,
      recommendationDoesNotChangeHp: true,
      recommendationDoesNotTransferResponsibility: true,
      recommendationDoesNotInventStrikeHistory: true,
      removingPreparationSuppressesRecommendationUnderSamePressure: true,
      restoringPreparationRecoversRecommendation: true,
      manualC1StrikeAloneTransfersResponsibility: true,
      shadowWithdrawsDuringRecoveryAfterTakeover: true,
      shadowRefusesRedundantTakeoverWhenC1LaterBearsPressure: true,
      c1PressureAfterTakeoverObservedAfterTicks: c1Pressured.ticks,
      hiddenPressureTimingNotUsedForDecision: true
    },
    interpretationBoundary:
      "This qualifies a zero-authority shadow classification seam against the manually discovered takeover relation. It does not qualify autonomous STRIKE, a complete policy, combat quality, teammate feel, or Owner-facing behavior.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_TAKEOVER_SHADOW]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
