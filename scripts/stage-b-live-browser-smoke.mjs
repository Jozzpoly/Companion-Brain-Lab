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

function threatPosition(text) {
  const match = text.match(/advancing threat\s+(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
      text.includes("advancing threat") &&
      text.includes("threat advancing") &&
      text.includes("companion action RESPOND_TO_THREAT") &&
      text.includes("LIVE RESPOND_TO_THREAT") &&
      text.includes("baseline relationship"),
    15_000,
    "live responsibility takeover"
  );
  const respondingTick = tickFromPanel(responding);
  const firstThreatPosition = threatPosition(responding);
  invariant(
    respondingTick !== null && respondingTick > initialTick,
    "Stage B responsibility takeover did not advance World time."
  );
  invariant(firstThreatPosition, "Stage B active panel exposed no advancing threat position.");

  const advancing = await waitForPanel(
    page,
    (text) => {
      const tick = tickFromPanel(text);
      const position = threatPosition(text);
      return (
        tick !== null &&
        respondingTick !== null &&
        tick >= respondingTick + 20 &&
        text.includes("world pressure ACTIVE") &&
        text.includes("companion action RESPOND_TO_THREAT") &&
        position !== null &&
        firstThreatPosition !== null &&
        distance(position, firstThreatPosition) > 0.08
      );
    },
    10_000,
    "advancing threat movement before intercept"
  );
  const advancingThreatPosition = threatPosition(advancing);
  invariant(advancingThreatPosition, "Advancing Stage B specimen lost threat position.");

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
      baselineRelationshipRemainsVisible: true,
      firstThreatPosition,
      advancingThreatPosition,
      observedThreatMovement: distance(firstThreatPosition, advancingThreatPosition)
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

  await context.close();

  const participantContext = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });
  const participantPage = await participantContext.newPage();
  const participantErrors = { page: [], console: [], requests: [] };
  participantPage.on("pageerror", (error) => participantErrors.page.push(error.message));
  participantPage.on("console", (message) => {
    if (message.type() === "error") participantErrors.console.push(message.text());
  });
  participantPage.on("requestfailed", (request) => {
    participantErrors.requests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`
    );
  });

  await participantPage.goto(
    "http://127.0.0.1:4173/?teammate=1&a1debug=1&a1p2=1&semanticpush=1&foundationFaultProbe=1",
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );
  await participantPage.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  const participantPanel = participantPage.locator("#debug-panel");
  invariant(
    await participantPanel.evaluate((node) => node.classList.contains("is-teammate-sandbox")),
    "Stage B participant surface did not enter teammate review mode."
  );
  invariant(
    !(await participantPage.locator(".debug-collapse").isVisible()),
    "Teammate participant surface exposes research-panel disclosure."
  );
  invariant(
    (await participantPage.locator(".debug-panel-content").evaluate(
      (node) => getComputedStyle(node).display
    )) === "none",
    "Teammate participant surface exposes research content."
  );
  const participantControls = participantPage.locator(".owner-review-controls");
  invariant(await participantControls.isVisible(), "Teammate participant controls are missing.");
  invariant(
    (await participantControls.locator(".owner-review-title").textContent()) === "Stage B slice",
    "Stage B participant title is wrong."
  );
  invariant(
    (await participantControls.locator(".owner-review-hint").textContent()) === "WASD to move",
    "Stage B participant hint leaks expected companion behavior."
  );
  invariant(
    await participantControls.getByRole("button", { name: "Reset", exact: true }).isVisible(),
    "Teammate participant control missing: Reset"
  );
  const participantSave = participantControls.locator(".owner-capture");
  invariant(
    await participantSave.isVisible(),
    "Teammate participant Save control is not visible."
  );
  invariant(
    (await participantSave.textContent())?.trim() === "Save",
    "Teammate participant capture control lost its visible Save label."
  );
  for (const forbidden of ["Open", "Pillar", "Door", "Head-on"]) {
    invariant(
      (await participantControls.getByRole("button", { name: forbidden, exact: true }).count()) === 0,
      `Teammate participant surface leaked scenario control: ${forbidden}`
    );
  }

  // Research and historical movement-review keys must not mutate this one stimulus.
  for (const key of ["m", "n", "t", "p", "o", "2", "3", "4"]) {
    await participantPage.keyboard.press(key);
  }
  await participantPage.waitForTimeout(150);
  const participantBaseline = await waitForPanel(
    participantPage,
    (text) => hasOrdinaryBaseline(text) && text.includes("world pressure QUIET"),
    15_000,
    "teammate participant immutable baseline"
  );
  invariant(
    participantBaseline.includes("scenario Open field"),
    "Teammate participant surface escaped the Open fixture."
  );

  invariant(
    (await participantPage.locator(".teammate-review-status").count()) === 0,
    "Stage B participant UI leaks live semantic/action state."
  );
  const participantActive = await waitForPanel(
    participantPage,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("world pressure ACTIVE") &&
      text.includes("companion action RESPOND_TO_THREAT"),
    15_000,
    "hidden Stage B participant authority state"
  );

  await participantPage.screenshot({
    path: `${ROOT}/teammate-surface.png`,
    type: "png",
    fullPage: true
  });

  invariant(
    await participantPage.locator("#runtime-fault-sentinel").count() === 0,
    "Teammate participant runtime fault sentinel is visible."
  );
  invariant(participantErrors.page.length === 0, `Participant page errors: ${participantErrors.page.join(" | ")}`);
  invariant(participantErrors.console.length === 0, `Participant console errors: ${participantErrors.console.join(" | ")}`);
  invariant(participantErrors.requests.length === 0, `Participant failed requests: ${participantErrors.requests.join(" | ")}`);

  summary.participantSurface = {
    query: "?teammate=1",
    title: await participantPage.title(),
    researchFlagsSanitized: true,
    scenario: "open",
    mode: "SPATIAL",
    actuator: "NATURAL",
    a1: "OFF",
    timeScale: "1x",
    visibleControls: ["Reset", "Save"],
    forbiddenScenarioControlsAbsent: true,
    hiddenAuthorityObserved:
      participantActive.includes("world pressure ACTIVE") &&
      participantActive.includes("companion action RESPOND_TO_THREAT"),
    semanticStateVisibleToParticipant: false,
    errors: participantErrors
  };

  await participantContext.close();
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[STAGE_B_LIVE_BROWSER] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
