import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/stage-b-live-browser";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function waitForPanel(page, predicate, timeout = 15_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2600))}`);
}

function tickFromPanel(text) {
  const match = text.match(/tick\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

function hasOrdinaryBaseline(text) {
  return (
    text.includes("scenario Open field") &&
    text.includes("mode SPATIAL") &&
    text.includes("actuator NATURAL") &&
    text.includes("A1 OFF") &&
    text.includes("RUNNING") &&
    text.includes("1x")
  );
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
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

  // Ordinary root runtime only: no Owner mode, no research query flags, no input.
  await page.goto("http://127.0.0.1:4173/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });

  const initial = await waitForPanel(
    page,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("Stage B · live shared responsibility") &&
      text.includes("world pressure QUIET") &&
      text.includes("companion action REGROUP"),
    15_000,
    "ordinary Stage B baseline"
  );
  const initialTick = tickFromPanel(initial);
  invariant(initialTick !== null, "Stage B baseline exposed no world tick.");

  const responding = await waitForPanel(
    page,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("world pressure ACTIVE") &&
      text.includes("companion action RESPOND_TO_THREAT") &&
      text.includes("LIVE RESPOND_TO_THREAT") &&
      text.includes("baseline relationship"),
    15_000,
    "live responsibility takeover"
  );
  const respondingTick = tickFromPanel(responding);
  invariant(
    respondingTick !== null && respondingTick > initialTick,
    "Stage B responsibility takeover did not advance World time."
  );

  await page.screenshot({
    path: `${ROOT}/responding.png`,
    type: "png",
    fullPage: true
  });

  const contained = await waitForPanel(
    page,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("world pressure RECOVERING") &&
      text.includes("outcome CONTAINED") &&
      text.includes("resolved by companion") &&
      text.includes("companion action REGROUP") &&
      text.includes("LIVE REGROUP"),
    20_000,
    "World-owned containment and regroup"
  );
  const containedTick = tickFromPanel(contained);
  invariant(
    containedTick !== null && respondingTick !== null && containedTick > respondingTick,
    "Stage B containment/regroup did not advance World time."
  );
  invariant(
    !contained.includes("outcome BREACHED"),
    "First ordinary Stage B episode breached instead of being contained."
  );

  await page.screenshot({
    path: `${ROOT}/contained-regroup.png`,
    type: "png",
    fullPage: true
  });

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Stage B runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-stage-b-live-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    browser: browser.version(),
    entrypoint: "/",
    playerInputInjected: false,
    baseline: {
      tick: initialTick,
      mode: "SPATIAL",
      actuator: "NATURAL",
      a1: "OFF",
      pressure: "QUIET",
      action: "REGROUP"
    },
    responsibilityTakeover: {
      tick: respondingTick,
      pressure: "ACTIVE",
      action: "RESPOND_TO_THREAT",
      baselineRelationshipRemainsVisible: true
    },
    factualOutcome: {
      tick: containedTick,
      pressure: "RECOVERING",
      outcome: "CONTAINED",
      resolvedBy: "companion",
      actionAfterResolution: "REGROUP"
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[STAGE_B_LIVE_BROWSER] ${JSON.stringify(summary)}`);
  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
