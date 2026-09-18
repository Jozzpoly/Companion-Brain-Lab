import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep1-incident";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
    await page.waitForTimeout(50);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2500))}`);
}

async function p2(page) {
  return page.evaluate(() => window.__authorityA12p2BrowserBridge?.snapshot() ?? null);
}

async function frameCount(page) {
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? null);
}

async function singleStep(page) {
  const before = await frameCount(page);
  invariant(Number.isInteger(before), "A1.1f frame count unavailable before OS-PREP-1 step.");
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= count + 1,
    before,
    { timeout: 15_000 }
  );
}

async function assertNoFault(page, errors) {
  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel became visible during OS-PREP-1 incident specimen."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1&a1p2=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA12p2BrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "initial pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Head-on contact") && text.includes("PAUSED") && text.includes("A1 OFF"),
    15_000,
    "paused head-on reset"
  );
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(
    page,
    (text) =>
      text.includes("PAUSED") &&
      text.includes("A1 DIRECT") &&
      text.includes("waiting for first SPATIAL decision"),
    10_000,
    "paused A1 DIRECT pre-decision"
  );

  await page.keyboard.down("d");
  await page.waitForTimeout(50);

  await page.locator('[data-action="p2-preview"]').click();
  await page.waitForFunction(
    () => window.__authorityA12p2BrowserBridge?.snapshot().latestPreview?.sourceTick === 0,
    null,
    { timeout: 15_000 }
  );
  const previewEvidence = (await p2(page)).latestPreview;
  invariant(previewEvidence?.projection.frontierState === "SINGLETON_H1_FRONTIER", "OS-PREP-1 expected tick-0 singleton H1 frontier.");
  invariant(previewEvidence.playerMove.x === 1 && previewEvidence.playerMove.y === 0, "OS-PREP-1 preview lost Owner +X.");
  const candidate = previewEvidence.projection.candidates[0];
  invariant(candidate, "OS-PREP-1 preview produced no candidate.");

  await page.locator('[data-action="p2-arm-singleton"]').click();
  await page.waitForFunction(
    (proposalId) => window.__authorityA12p2BrowserBridge?.snapshot().armed?.proposalId === proposalId,
    candidate.proposalId,
    { timeout: 15_000 }
  );

  await singleStep(page);
  await page.waitForFunction(
    () => window.__authorityA12p2BrowserBridge?.snapshot().latestApplication?.status === "APPLIED_OUTCOME_CONFIRMED",
    null,
    { timeout: 15_000 }
  );

  const beforeCaptureP2 = await p2(page);
  const beforeCaptureFrameCount = await frameCount(page);
  invariant(beforeCaptureP2.applicationCount === 1, "OS-PREP-1 expected exactly one P2 application before capture.");
  invariant(beforeCaptureP2.armed === null, "OS-PREP-1 P2 did not auto-disarm.");
  invariant(beforeCaptureP2.latestApplication?.sourceTick === 0, "OS-PREP-1 P2 source tick mismatch.");
  invariant(beforeCaptureP2.latestApplication?.outcomeTick === 1, "OS-PREP-1 P2 outcome tick mismatch.");
  invariant(beforeCaptureP2.latestApplication?.proposalId === candidate.proposalId, "OS-PREP-1 P2 proposal identity mismatch.");
  invariant((beforeCaptureP2.latestApplication?.a0CommandVelocityError ?? Infinity) <= 1e-9, "OS-PREP-1 P2 A0 command mismatch.");

  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator('[data-action="capture-incident"]').click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  invariant(downloadedPath, "OS-PREP-1 incident download produced no local path.");
  const incidentBytes = await readFile(downloadedPath);
  await writeFile(`${ARTIFACT_DIR}/downloaded-incident.json`, incidentBytes);
  const incident = JSON.parse(incidentBytes.toString("utf8"));

  const afterCaptureP2 = await p2(page);
  const afterCaptureFrameCount = await frameCount(page);

  invariant(
    incident.schema === "companion-brain-lab-owner-sandbox-incident-v1",
    `OS-PREP-1 incident schema mismatch: ${incident.schema}`
  );
  if (process.env.GITHUB_SHA) {
    invariant(incident.build?.sourceSha === process.env.GITHUB_SHA, "OS-PREP-1 incident source SHA does not match GITHUB_SHA.");
    invariant(incident.build?.state === "PINNED_SOURCE_SHA", "OS-PREP-1 CI build was not marked PINNED_SOURCE_SHA.");
  }

  invariant(incident.capture?.scenario === "head-on", "OS-PREP-1 incident scenario mismatch.");
  invariant(incident.capture?.tick === 1, `OS-PREP-1 incident expected capture tick 1, got ${incident.capture?.tick}.`);
  invariant(incident.capture?.paused === true, "OS-PREP-1 incident lost paused capture state.");
  invariant(incident.capture?.mode === "spatial", "OS-PREP-1 incident mode mismatch.");
  invariant(incident.capture?.actuator === "direct", "OS-PREP-1 incident actuator mismatch.");
  invariant(incident.capture?.a1Variant === "direct", "OS-PREP-1 incident A1 variant mismatch.");

  const causalFrame = incident.frames?.find(
    (frame) => frame.observation?.worldTick === 0 && frame.outcome?.worldTick === 1
  );
  invariant(causalFrame, "OS-PREP-1 incident missing t0 -> t1 causal frame.");
  invariant(
    causalFrame.observation.playerControlMove?.x === 1 &&
    causalFrame.observation.playerControlMove?.y === 0,
    "OS-PREP-1 incident lost same-step Owner +X control."
  );

  invariant(incident.p2?.available === true, "OS-PREP-1 incident did not mark P2 available.");
  const capturedP2 = incident.p2?.snapshot;
  invariant(capturedP2?.applicationCount === 1, "OS-PREP-1 incident lost exact P2 application count.");
  invariant(capturedP2?.armCount === 1, "OS-PREP-1 incident lost P2 arm count.");
  invariant(capturedP2?.previewCount === 1, "OS-PREP-1 incident lost P2 preview count.");
  invariant(capturedP2?.armed === null, "OS-PREP-1 incident captured P2 as still armed.");
  invariant(capturedP2?.latestApplication?.proposalId === candidate.proposalId, "OS-PREP-1 incident changed P2 proposal identity.");
  invariant(capturedP2?.latestApplication?.sourceTick === 0, "OS-PREP-1 captured P2 source tick mismatch.");
  invariant(capturedP2?.latestApplication?.outcomeTick === 1, "OS-PREP-1 captured P2 outcome tick mismatch.");
  invariant(
    (capturedP2?.latestApplication?.a0CommandVelocityError ?? Infinity) <= 1e-9,
    "OS-PREP-1 captured P2 command/outcome mismatch."
  );

  invariant(afterCaptureFrameCount === beforeCaptureFrameCount, "Capturing an incident advanced the causal/World frame.");
  invariant(afterCaptureP2.previewCount === beforeCaptureP2.previewCount, "Incident capture changed P2 preview count.");
  invariant(afterCaptureP2.armCount === beforeCaptureP2.armCount, "Incident capture changed P2 arm count.");
  invariant(afterCaptureP2.applicationCount === beforeCaptureP2.applicationCount, "Incident capture changed P2 application count.");
  invariant(afterCaptureP2.armed === null, "Incident capture re-armed P2.");

  await page.keyboard.up("d");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-os-prep1-incident-browser-specimen-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    downloadedFilename: download.suggestedFilename(),
    incidentSchema: incident.schema,
    build: incident.build,
    capture: incident.capture,
    playerControlMove: causalFrame.observation.playerControlMove,
    p2: {
      previewCount: capturedP2.previewCount,
      armCount: capturedP2.armCount,
      applicationCount: capturedP2.applicationCount,
      proposalId: capturedP2.latestApplication.proposalId,
      sourceTick: capturedP2.latestApplication.sourceTick,
      outcomeTick: capturedP2.latestApplication.outcomeTick,
      a0CommandVelocityError: capturedP2.latestApplication.a0CommandVelocityError
    },
    captureNonInterference: {
      frameCountBefore: beforeCaptureFrameCount,
      frameCountAfter: afterCaptureFrameCount,
      p2Before: {
        previewCount: beforeCaptureP2.previewCount,
        armCount: beforeCaptureP2.armCount,
        applicationCount: beforeCaptureP2.applicationCount
      },
      p2After: {
        previewCount: afterCaptureP2.previewCount,
        armCount: afterCaptureP2.armCount,
        applicationCount: afterCaptureP2.applicationCount
      }
    },
    errors
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP1_INCIDENT_BROWSER] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
