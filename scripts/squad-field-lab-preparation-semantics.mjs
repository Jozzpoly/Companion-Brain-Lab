import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-preparation-semantics";

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
  throw new Error(`${label} timed out. Latest: ${JSON.stringify(latest.slice(0, 10000))}`);
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

function parseC1Anchor(text, mode) {
  const flat = text.replace(/\s+/g, " ");
  const match = flat.match(new RegExp(`C1 ${mode} @(-?\\d+(?:\\.\\d+)?),(-?\\d+(?:\\.\\d+)?) · ARRIVED`));
  if (!match) throw new Error(`Could not parse ARRIVED C1 ${mode} anchor from panel: ${flat.slice(0, 8000)}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function openFixture(browser, port, errors) {
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

  await page.goto(`http://127.0.0.1:${port}/?fieldlab=1`, {
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

  // Deliberately inside STRIKE range so this campaign tests preparation
  // semantics rather than the already-qualified observation→execution boundary.
  await dragBody(page, box, { x: 4.6, y: 5.0 }, { x: 11.85, y: 5.90 });
  await dragBody(page, box, { x: 3.0, y: 5.0 }, { x: 11.35, y: 4.45 });
  await setup.click();

  return { context, page, canvas, box };
}

async function createPressureOnPlayer(page) {
  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  invariant((await combatStatus(page)).includes("history YOU"), "Player engagement missing.");

  return stepUntil(
    page,
    (status) =>
      status.includes("PRESSURING") &&
      status.includes("pressure target YOU") &&
      status.includes("hits YOU 0 / C1 0"),
    220,
    "visible player pressure"
  );
}

async function manualC1Takeover(page, label) {
  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  const status = await combatStatus(page);
  invariant(status.includes("HP 1/3"), `${label}: C1 manual STRIKE did not damage hostile: ${status}`);
  invariant(status.includes("pressure target C1"), `${label}: manual STRIKE did not transfer responsibility: ${status}`);
  invariant(status.includes("history YOU → C1"), `${label}: manual takeover history missing: ${status}`);
  return status;
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4187, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const errors = { page: [], console: [], requests: [] };
  const results = {};

  // Positive control: currently-qualified explicit HOLD preparation.
  {
    const { context, page } = await openFixture(browser, 4187, errors);
    try {
      await page.locator('[data-order-mode="HOLD"]').click();
      await waitForText(
        () => panelText(page),
        (text) => text.includes("C1 HOLD") && text.includes("ARRIVED"),
        5_000,
        "HOLD preparation"
      );

      const cue = await createPressureOnPlayer(page);
      const shadow = await waitForText(
        () => shadowText(page),
        (text) =>
          text.includes("TAKE_OVER · TAKEOVER_CONDITIONS_PRESENT") &&
          text.includes("C1 prepared YES") &&
          text.includes("source FIELD_LAB_HOLD") &&
          text.includes("strike-now YES"),
        5_000,
        "HOLD positive control shadow"
      );
      const takeover = await manualC1Takeover(page, "HOLD control");

      results.hold = {
        pressureCueAfterTicks: cue.ticks,
        shadow: shadow.replace(/\s+/g, " ").trim(),
        manualTakeoverStatus: takeover
      };
    } finally {
      await context.close();
    }
  }

  // Falsifier: preserve exactly the same target geometry but change only the
  // assignment label from HOLD to MOVE. If MOVE is ARRIVED/stable and manual
  // takeover is materially valid, HOLD-only preparation is under-specified.
  {
    const { context, page, box } = await openFixture(browser, 4187, errors);
    try {
      await page.locator('[data-order-mode="HOLD"]').click();
      const holdPanel = await waitForText(
        () => panelText(page),
        (text) => text.includes("C1 HOLD") && text.includes("ARRIVED"),
        5_000,
        "temporary HOLD anchor derivation"
      );
      const anchor = parseC1Anchor(holdPanel, "HOLD");

      const anchorPoint = internalCanvasPoint(box, anchor);
      await page.mouse.click(anchorPoint.x, anchorPoint.y, { button: "right" });

      const movePanel = await waitForText(
        () => panelText(page),
        (text) =>
          /C1 MOVE @-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)? · ARRIVED/.test(text.replace(/\s+/g, " ")) &&
          text.includes("order MOVE · ARRIVED") &&
          text.includes("requested 0.00, 0.00"),
        5_000,
        "MOVE-equivalent arrived state"
      );

      // Let ordinary World ticks prove the MOVE target is not merely an
      // instantaneous UI state. No combat has begun yet.
      for (let i = 0; i < 8; i += 1) await tap(page, "o");
      const stablePanel = (await panelText(page)).replace(/\s+/g, " ");
      invariant(
        /C1 MOVE @-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)? · ARRIVED/.test(stablePanel) &&
          stablePanel.includes("authority FORMATION · order MOVE · ARRIVED") &&
          stablePanel.includes("requested 0.00, 0.00"),
        "MOVE-equivalent preparation did not remain stably ARRIVED before pressure."
      );
      invariant((await combatStatus(page)).includes("history none"), "MOVE-equivalent setup invented combat history.");

      const cue = await createPressureOnPlayer(page);
      const shadow = await waitForText(
        () => shadowText(page),
        (text) =>
          text.includes("DO_NOT_TAKE_OVER · COMPANION_NOT_PREPARED") &&
          text.includes("bearer YOU") &&
          text.includes("phase PRESSURING") &&
          text.includes("C1 prepared no") &&
          text.includes("source FIELD_LAB_MOVE") &&
          text.includes("strike-now YES"),
        5_000,
        "MOVE-equivalent shadow underclassification"
      );

      await page.screenshot({
        path: `${ROOT}/01-move-arrived-shadow-refuses.png`,
        type: "png",
        fullPage: true
      });

      const takeover = await manualC1Takeover(page, "MOVE-equivalent");

      await page.screenshot({
        path: `${ROOT}/02-move-arrived-manual-takeover-succeeds.png`,
        type: "png",
        fullPage: true
      });

      results.moveArrived = {
        anchor,
        pressureCueAfterTicks: cue.ticks,
        stableBeforePressure: true,
        shadow: shadow.replace(/\s+/g, " ").trim(),
        manualTakeoverStatus: takeover,
        assignmentEvidence: movePanel.replace(/\s+/g, " ").trim()
      };
    } finally {
      await context.close();
    }
  }

  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-preparation-semantics-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Is the currently-qualified preparation concept materially equivalent to the HOLD command label, or can another stable assignment preserve the same takeover opportunity while the shadow refuses it?",
    results,
    observations: {
      holdPreparedControlRecommendsTakeover: true,
      holdPreparedControlSupportsManualTakeover: true,
      moveCanReuseSameSpatialAnchorAsHold: true,
      moveArrivedRemainsStableBeforePressure: true,
      moveArrivedRemainsFactuallyInStrikeRangeDuringPlayerPressure: true,
      currentShadowRejectsMoveArrivedAsNotPrepared: true,
      manualTakeoverStillSucceedsFromMoveArrivedState: true,
      currentPreparationPredicateThereforeUnderClassifiesMaterialReadiness: true,
      noWorldRuleChanged: true,
      noAutonomousAuthorityAdded: true
    },
    verdict:
      "HOLD_ONLY_PREPARATION_SEMANTIC_FALSIFIED_BY_ARRIVED_MOVE_COUNTEREXAMPLE",
    interpretationBoundary:
      "This is a negative semantic result against assignment.mode === HOLD as the preparation definition. It does not establish that every ARRIVED MOVE is prepared, nor a final readiness semantic. It shows only that HOLD is not necessary for a materially valid, stable takeover-ready state.",
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_PREPARATION_SEMANTICS]", JSON.stringify(summary));
} finally {
  if (browser) await browser.close();
  await server.close();
}
