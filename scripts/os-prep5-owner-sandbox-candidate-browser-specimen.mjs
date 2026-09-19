import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/os-prep5-owner-sandbox-candidate";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function panelTick(text) {
  const match = text.match(/tick\s+(\d+)/);
  return match ? Number(match[1]) : null;
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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2200))}`);
}

function isImmutableBaseline(text) {
  return (
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

  // Deliberately combine participant mode with research/fault flags. Owner review
  // must sanitize them into one immutable participant stimulus.
  await page.goto(
    "http://127.0.0.1:4173/?owner=1&a1debug=1&a1p2=1&semanticpush=1&foundationFaultProbe=1",
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );

  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  const initial = await waitForPanel(
    page,
    (text) => text.includes("scenario Open field") && isImmutableBaseline(text),
    15_000,
    "Owner movement-review baseline"
  );

  const panel = page.locator("#debug-panel");
  invariant(
    await panel.evaluate((node) => node.classList.contains("is-owner-sandbox")),
    "Owner movement-review class missing."
  );
  const panelBox = await panel.boundingBox();
  invariant(panelBox && panelBox.width <= 150, `Owner movement-review rail is too wide: ${panelBox?.width ?? "missing"}.`);

  const ownerControls = page.locator(".owner-review-controls");
  invariant(await ownerControls.isVisible(), "Participant controls are not visible.");
  for (const label of ["Open", "Pillar", "Door", "Head-on", "Reset", "Save"]) {
    invariant(
      await ownerControls.getByRole("button", { name: label, exact: true }).isVisible(),
      `Owner movement-review control missing: ${label}`
    );
  }

  invariant(
    !(await page.locator(".debug-collapse").isVisible()),
    "Research-panel disclosure remains visible in Owner movement-review mode."
  );
  const panelContentDisplay = await page.locator(".debug-panel-content").evaluate(
    (node) => getComputedStyle(node).display
  );
  invariant(
    panelContentDisplay === "none",
    `Research panel content is visible in participant mode: ${panelContentDisplay}.`
  );

  invariant(
    await page.evaluate(() => window.__authorityA12p2BrowserBridge === undefined),
    "P2 bridge survived Owner-review query sanitization."
  );

  // Attempt to mutate the old workbench through its historical keyboard shortcuts.
  // None of these may alter the participant stimulus.
  for (const key of ["m", "n", "t", "p", "o"]) await page.keyboard.press(key);
  const afterResearchKeys = await waitForPanel(
    page,
    (text) => panelTick(text) !== null && panelTick(text) > (panelTick(initial) ?? -1),
    10_000,
    "Owner movement-review continued running after ignored research keys"
  );
  invariant(isImmutableBaseline(afterResearchKeys), "Research keyboard shortcuts mutated the Owner review baseline.");

  await page.screenshot({
    path: `${ROOT}/participant-surface.jpg`,
    type: "jpeg",
    quality: 80,
    fullPage: true
  });

  // Generate ordinary Owner movement and preserve it in a live incident without
  // introducing pause/single-step research controls into the participant surface.
  await page.keyboard.down("d");
  await waitForPanel(
    page,
    (text) => {
      const tick = panelTick(text);
      return tick !== null && tick >= 8;
    },
    10_000,
    "Owner +X movement"
  );
  await page.keyboard.up("d");

  const beforeCapture = await panelText(page);
  invariant(isImmutableBaseline(beforeCapture), "Baseline changed before incident capture.");

  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await ownerControls.getByRole("button", { name: "Save", exact: true }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  invariant(downloadedPath, "Owner movement-review Save produced no download path.");

  const incidentBytes = await readFile(downloadedPath);
  await writeFile(`${ROOT}/captured-incident.json`, incidentBytes);
  const incident = JSON.parse(incidentBytes.toString("utf8"));

  invariant(
    incident.schema === "companion-brain-lab-owner-sandbox-incident-v1",
    "Owner movement-review incident schema mismatch."
  );
  if (process.env.GITHUB_SHA) {
    invariant(incident.build?.sourceSha === process.env.GITHUB_SHA, "Owner movement-review incident source SHA mismatch.");
    invariant(incident.build?.state === "PINNED_SOURCE_SHA", "Owner movement-review CI build is not pinned.");
  }

  invariant(incident.capture?.scenario === "open", "Owner movement-review incident scenario mismatch.");
  invariant(incident.capture?.mode === "spatial", "Owner movement-review did not preserve SPATIAL baseline.");
  invariant(incident.capture?.actuator === "natural", "Owner movement-review did not preserve NATURAL baseline.");
  invariant(incident.capture?.a1Variant === "off", "Owner movement-review unexpectedly enabled A1 authority.");
  invariant(incident.capture?.timeScale === 1, "Owner movement-review did not preserve 1x time.");
  invariant(incident.capture?.paused === false, "Owner movement-review was unexpectedly paused.");
  invariant(incident.p2?.available === false, "Owner movement-review unexpectedly exposed P2.");

  const ownerMoveFrame = [...(incident.frames ?? [])].reverse().find(
    (frame) =>
      frame.observation?.playerControlMove?.x === 1 &&
      frame.observation?.playerControlMove?.y === 0
  );
  invariant(ownerMoveFrame, "Owner movement-review incident lost recent same-step Owner +X evidence.");

  // Scenario switching must remain participant-visible without opening research UI.
  await ownerControls.getByRole("button", { name: "Door", exact: true }).click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Narrow doorway") && isImmutableBaseline(text),
    15_000,
    "Owner movement-review doorway switch"
  );
  invariant(await ownerControls.isVisible(), "Participant controls disappeared after scenario switch.");
  invariant(
    (await page.locator(".debug-panel-content").evaluate((node) => getComputedStyle(node).display)) === "none",
    "Scenario switching exposed research content."
  );

  await ownerControls.getByRole("button", { name: "Reset", exact: true }).click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Narrow doorway") && isImmutableBaseline(text),
    15_000,
    "Owner movement-review reset"
  );

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Owner movement-review runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-os-prep5-movement-review-candidate-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    requestedEntrypoint: "?owner=1&a1debug=1&a1p2=1&semanticpush=1&foundationFaultProbe=1",
    participantSurface: {
      railWidth: panelBox?.width ?? null,
      controls: ["Open", "Pillar", "Door", "Head-on", "Reset", "Save"],
      researchDisclosureVisible: false,
      researchContentDisplay: panelContentDisplay,
      p2Available: false
    },
    immutabilityAttack: {
      attemptedKeys: ["M", "N", "T", "P", "O"],
      remainedSpatial: incident.capture.mode === "spatial",
      remainedNatural: incident.capture.actuator === "natural",
      remainedA1Off: incident.capture.a1Variant === "off",
      remainedTimeScale1: incident.capture.timeScale === 1,
      remainedRunning: incident.capture.paused === false
    },
    incident: {
      schema: incident.schema,
      build: incident.build,
      tick: incident.capture.tick,
      recentOwnerMove: ownerMoveFrame.observation.playerControlMove
    },
    scenarioSwitch: {
      uiControl: "Door",
      result: "doorway",
      researchContentRemainedHidden: true
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP5_MOVEMENT_REVIEW_CANDIDATE] ${JSON.stringify(summary)}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
