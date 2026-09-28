import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-readiness-boundary";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function shadowText(page) {
  return (await page.locator('[data-combat-takeover-shadow="true"]').textContent()) ?? "";
}

async function waitForText(read, predicate, timeout = 8_000, label = "condition") {
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

function parseFocusedBody(text) {
  const flat = text.replace(/\s+/g, " ");
  const match = flat.match(/Focused · C1 .*? body (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not parse C1 body from panel: ${flat.slice(0, 9000)}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4188, strictPort: true }
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

  await page.goto("http://127.0.0.1:4188/?fieldlab=1", {
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
    (text) => text.includes("scenario squad-field-lab-combat-micro"),
    8_000,
    "Combat Micro fixture"
  );

  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  await dragBody(page, box, { x: 4.6, y: 5.0 }, { x: 8.0, y: 5.0 });
  await setup.click();

  const baseline = await waitForText(
    () => panelText(page),
    (text) => text.includes("Focused · C1"),
    4_000,
    "focused C1 baseline"
  );
  const body = parseFocusedBody(baseline);

  // Default slot is +1.55m on X at orientation 0 / spacing 1.
  // Author a MOVE target ~0.21m ahead of the current body. This lies:
  //   outside the motor stop tolerance 0.18m,
  //   inside the display/trial ARRIVED tolerance 0.18*1.35 = 0.243m.
  // A materially "settled" readiness seam should not promote this state while
  // the formation motor still requests motion.
  const desiredTarget = { x: body.x + 0.21, y: body.y };
  const moveAnchor = { x: desiredTarget.x - 1.55, y: desiredTarget.y };
  const p = internalCanvasPoint(box, moveAnchor);
  await page.mouse.click(p.x, p.y, { button: "right" });

  // One real World step makes the current MOVE request observable.
  await tap(page, "o");

  const materialState = await waitForText(
    () => panelText(page),
    (text) => {
      const flat = text.replace(/\s+/g, " ");
      return (
        flat.includes("authority FORMATION · order MOVE · ARRIVED") &&
        /target -?\d+(?:\.\d+)?, -?\d+(?:\.\d+)? · distance 0\.2\dm/.test(flat) &&
        !flat.includes("requested 0.00, 0.00")
      );
    },
    5_000,
    "display-arrived but motor-still-moving state"
  );

  const flatMaterial = materialState.replace(/\s+/g, " ");
  const readiness = await shadowText(page);

  // Research expectation: ARRIVED display slack must not be enough to claim
  // settled material readiness while the motor still wants to move.
  invariant(
    readiness.includes("C1 prepared no") &&
      readiness.includes("readiness INDEPENDENT_ANCHOR_NOT_SETTLED") &&
      readiness.includes("source FIELD_LAB_MOVE_INDEPENDENT_ANCHOR_NOT_SETTLED"),
    `Readiness falsely promoted a still-moving ARRIVED-display state: ${readiness.replace(/\s+/g, " ")}`
  );

  await page.screenshot({
    path: `${ROOT}/01-arrived-display-but-motor-moving.png`,
    type: "png",
    fullPage: true
  });

  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-readiness-boundary-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    authoredTargetOffsetMeters: 0.21,
    slotToleranceMeters: 0.18,
    displayArrivedThresholdMeters: 0.243,
    observations: {
      fieldLabDisplayClassifiesStateArrived: true,
      targetRemainsOutsideMotorStopTolerance: true,
      formationMotorStillRequestsMotion: true,
      readinessDoesNotPromoteDisplaySlackToSettledPreparation: true,
      noActionAuthorityAdded: true
    },
    panel: flatMaterial,
    shadow: readiness.replace(/\s+/g, " ").trim(),
    interpretationBoundary:
      "This distinguishes the coarse Field Lab ARRIVED display band from material takeover preparation. A state may be visually ARRIVED yet still be actively moving toward its independent target; that state must not be promoted as settled readiness merely because it lies within the display/trial slack.",
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_READINESS_BOUNDARY]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
