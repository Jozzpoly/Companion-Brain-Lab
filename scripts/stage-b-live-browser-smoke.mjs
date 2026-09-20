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
      text.includes("selected action REGROUP · AUTONOMY"),
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
      text.includes("selected action RESPOND_TO_THREAT · AUTONOMY") &&
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

  const commandHud = page.locator('[data-player-command-hud="true"]');
  invariant(await commandHud.isVisible(), "Player-facing command HUD is missing.");
  const followButton = commandHud.getByRole("button", { name: "Follow me", exact: true });
  const holdButton = commandHud.getByRole("button", { name: "Hold here", exact: true });
  const atWillButton = commandHud.getByRole("button", { name: "At will", exact: true });
  invariant(await followButton.isVisible(), "Player-direction Follow me control is missing.");
  invariant(await holdButton.isVisible(), "Player-direction Hold here control is missing.");
  invariant(await atWillButton.isVisible(), "Player-direction At will control is missing.");

  await followButton.click();
  const followConflict = await waitForPanel(
    page,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("world pressure ACTIVE") &&
      text.includes("directive FOLLOW_ME") &&
      text.includes("local brain proposes RESPOND_TO_THREAT") &&
      text.includes("selected FOLLOW_PLAYER · source PLAYER_DIRECTIVE") &&
      text.includes("FOLLOW_ME currently outranks the autonomous threat-response proposal"),
    8_000,
    "FOLLOW_ME versus autonomous threat proposal"
  );

  await page.screenshot({
    path: `${ROOT}/command-conflict-follow.png`,
    type: "png",
    fullPage: true
  });

  await holdButton.click();
  const holdConflict = await waitForPanel(
    page,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("world pressure ACTIVE") &&
      text.includes("directive HOLD_HERE") &&
      text.includes("hold anchor") &&
      text.includes("local brain proposes RESPOND_TO_THREAT") &&
      text.includes("selected HOLD_POSITION · source PLAYER_DIRECTIVE") &&
      text.includes("HOLD_HERE currently outranks the autonomous threat-response proposal"),
    8_000,
    "HOLD_HERE versus autonomous threat proposal"
  );

  await atWillButton.click();
  const autonomyRestored = await waitForPanel(
    page,
    (text) =>
      hasOrdinaryBaseline(text) &&
      text.includes("world pressure ACTIVE") &&
      text.includes("directive AT_WILL") &&
      text.includes("local brain proposes RESPOND_TO_THREAT") &&
      text.includes("selected RESPOND_TO_THREAT · source AUTONOMY"),
    8_000,
    "AT_WILL restoration of local autonomy"
  );

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
        text.includes("selected action RESPOND_TO_THREAT · AUTONOMY") &&
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
      text.includes("selected action REGROUP · AUTONOMY") &&
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
    commandAutonomy: {
      followMe: {
        directiveVisible: followConflict.includes("directive FOLLOW_ME"),
        autonomousProposalPreserved: followConflict.includes("local brain proposes RESPOND_TO_THREAT"),
        selected: "FOLLOW_PLAYER",
        source: "PLAYER_DIRECTIVE"
      },
      holdHere: {
        directiveVisible: holdConflict.includes("directive HOLD_HERE"),
        autonomousProposalPreserved: holdConflict.includes("local brain proposes RESPOND_TO_THREAT"),
        selected: "HOLD_POSITION",
        source: "PLAYER_DIRECTIVE"
      },
      atWill: {
        autonomyRestored: autonomyRestored.includes("selected RESPOND_TO_THREAT · source AUTONOMY")
      }
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

  // Regression for the Owner feedback: teammate=1 on moving main must no longer
  // become a hidden-debug participant shell. The rejected public artifact stays
  // pinned to its historical SHA; current development keeps the microscope.
  const workbenchContext = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });
  const workbenchPage = await workbenchContext.newPage();
  const workbenchErrors = { page: [], console: [], requests: [] };
  workbenchPage.on("pageerror", (error) => workbenchErrors.page.push(error.message));
  workbenchPage.on("console", (message) => {
    if (message.type() === "error") workbenchErrors.console.push(message.text());
  });
  workbenchPage.on("requestfailed", (request) => {
    workbenchErrors.requests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`
    );
  });

  await workbenchPage.goto("http://127.0.0.1:4173/?teammate=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await workbenchPage.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  const workbenchPanel = workbenchPage.locator("#debug-panel");

  invariant(
    !(await workbenchPanel.evaluate((node) => node.classList.contains("is-teammate-sandbox"))),
    "Moving main resurrected the rejected teammate hidden-debug shell."
  );
  invariant(
    await workbenchPage.locator(".debug-collapse").isVisible(),
    "Current workbench lost the causal-panel disclosure control."
  );
  invariant(
    (await workbenchPage.locator(".debug-panel-content").evaluate(
      (node) => getComputedStyle(node).display
    )) !== "none",
    "Current workbench hides causal/debug content."
  );
  invariant(
    await workbenchPage.locator('[data-player-command-hud="true"]').isVisible(),
    "Current workbench is missing the fast player command HUD."
  );
  invariant(
    await workbenchPage.getByText("Player direction ↔ local autonomy", { exact: true }).isVisible(),
    "Current workbench is missing directive/autonomy causal state."
  );

  await workbenchPage.screenshot({
    path: `${ROOT}/command-autonomy-workbench.png`,
    type: "png",
    fullPage: true
  });

  invariant(
    await workbenchPage.locator("#runtime-fault-sentinel").count() === 0,
    "Current command/autonomy workbench faulted."
  );
  invariant(workbenchErrors.page.length === 0, `Workbench page errors: ${workbenchErrors.page.join(" | ")}`);
  invariant(workbenchErrors.console.length === 0, `Workbench console errors: ${workbenchErrors.console.join(" | ")}`);
  invariant(workbenchErrors.requests.length === 0, `Workbench failed requests: ${workbenchErrors.requests.join(" | ")}`);

  summary.workbenchSurface = {
    query: "?teammate=1",
    fullCausalWorkbenchVisible: true,
    playerCommandHudVisible: true,
    hiddenDebugContractRetiredOnMovingMain: true,
    errors: workbenchErrors
  };

  await workbenchContext.close();
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[STAGE_B_LIVE_BROWSER] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
