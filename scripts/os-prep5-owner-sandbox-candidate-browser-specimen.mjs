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
  return page.locator("#debug-panel").innerText();
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

  await page.goto("http://127.0.0.1:4173/?owner=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await waitForPanel(
    page,
    (text) =>
      text.includes("scenario Open field") &&
      text.includes("mode SPATIAL") &&
      text.includes("actuator NATURAL") &&
      text.includes("A1 OFF"),
    15_000,
    "Owner Sandbox baseline"
  );

  const panel = page.locator("#debug-panel");
  invariant(await panel.evaluate((node) => node.classList.contains("is-owner-sandbox")), "Owner Sandbox class missing.");
  invariant(await panel.evaluate((node) => node.classList.contains("is-collapsed")), "Owner Sandbox research panel did not start collapsed.");
  const panelBox = await panel.boundingBox();
  invariant(panelBox && panelBox.width <= 100, `Owner Sandbox rail is too wide: ${panelBox?.width ?? "missing"}.`);
  invariant(await page.locator(".owner-capture").isVisible(), "Owner Sandbox Save control is not visible.");
  const panelContentDisplay = await page.locator(".debug-panel-content").evaluate(
    (node) => getComputedStyle(node).display
  );
  invariant(panelContentDisplay === "none", `Research panel content is visible in participant mode: ${panelContentDisplay}.`);
  invariant(
    await page.evaluate(() => window.__authorityA12p2BrowserBridge === undefined),
    "P2 bridge is unexpectedly available in ordinary Owner mode."
  );

  const participantImage = await page.locator("#game-root canvas").screenshot({
    type: "jpeg",
    quality: 80
  });
  await writeFile(`${ROOT}/participant-surface.jpg`, participantImage);

  await page.keyboard.press("p");
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "Owner Sandbox pause");
  await page.keyboard.press("1");
  await waitForPanel(
    page,
    (text) => text.includes("scenario Open field") && text.includes("PAUSED") && panelTick(text) === 0,
    15_000,
    "Owner Sandbox reset"
  );

  await page.keyboard.down("d");
  await page.keyboard.press("o");
  await waitForPanel(page, (text) => panelTick(text) === 1, 15_000, "Owner Sandbox single participant step");
  await page.keyboard.up("d");

  const beforeCapture = await panelText(page);
  const beforeTick = panelTick(beforeCapture);
  invariant(beforeTick === 1, `Expected capture at t1, got ${beforeTick}.`);

  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator(".owner-capture").click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  invariant(downloadedPath, "Owner Sandbox Save produced no download path.");
  const incidentBytes = await readFile(downloadedPath);
  await writeFile(`${ROOT}/captured-incident.json`, incidentBytes);
  const incident = JSON.parse(incidentBytes.toString("utf8"));

  const afterTick = panelTick(await panelText(page));
  invariant(afterTick === beforeTick, "Owner Sandbox incident capture advanced the World.");
  invariant(await panel.evaluate((node) => node.classList.contains("is-collapsed")), "Incident capture expanded the research panel.");

  invariant(incident.schema === "companion-brain-lab-owner-sandbox-incident-v1", "Owner Sandbox incident schema mismatch.");
  if (process.env.GITHUB_SHA) {
    invariant(incident.build?.sourceSha === process.env.GITHUB_SHA, "Owner Sandbox incident source SHA mismatch.");
    invariant(incident.build?.state === "PINNED_SOURCE_SHA", "Owner Sandbox CI build is not pinned.");
  }
  invariant(incident.capture?.scenario === "open", "Owner Sandbox incident scenario mismatch.");
  invariant(incident.capture?.mode === "spatial", "Owner Sandbox incident did not preserve SPATIAL baseline.");
  invariant(incident.capture?.actuator === "natural", "Owner Sandbox incident did not preserve NATURAL baseline.");
  invariant(incident.capture?.a1Variant === "off", "Owner Sandbox incident unexpectedly enabled A1 authority.");
  invariant(incident.capture?.paused === true, "Owner Sandbox test capture should remain paused.");
  invariant(incident.p2?.available === false, "Owner Sandbox ordinary entrypoint unexpectedly exposed P2.");

  const causalFrame = incident.frames?.find(
    (frame) => frame.observation?.worldTick === 0 && frame.outcome?.worldTick === 1
  );
  invariant(causalFrame, "Owner Sandbox incident lost the t0 -> t1 causal frame.");
  invariant(
    causalFrame.observation.playerControlMove?.x === 1 &&
      causalFrame.observation.playerControlMove?.y === 0,
    "Owner Sandbox incident lost same-step Owner +X input."
  );

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Owner Sandbox runtime fault sentinel is visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-os-prep5-owner-sandbox-candidate-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    entrypoint: "?owner=1",
    participantSurface: {
      compactRailWidth: panelBox?.width ?? null,
      researchContentDisplay: panelContentDisplay,
      saveControlVisible: true,
      p2Available: false
    },
    baseline: {
      scenario: incident.capture.scenario,
      mode: incident.capture.mode,
      actuator: incident.capture.actuator,
      a1Variant: incident.capture.a1Variant
    },
    incident: {
      schema: incident.schema,
      build: incident.build,
      tick: incident.capture.tick,
      worldAdvancedByCapture: afterTick !== beforeTick,
      capturedOwnerMove: causalFrame.observation.playerControlMove
    },
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP5_OWNER_SANDBOX_CANDIDATE] ${JSON.stringify(summary)}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
