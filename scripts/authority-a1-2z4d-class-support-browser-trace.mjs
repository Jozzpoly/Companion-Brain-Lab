import { chromium } from "playwright-chromium";
import { preview } from "vite";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

function normalizeOrigin(origin) {
  if (origin === "RELATIVE_TANGENT_POSITIVE" || origin === "RELATIVE_TANGENT_NEGATIVE") return "TANGENT";
  if (origin === "HOLD" || origin === "MAINTAIN_CURRENT") return "HOLD_MAINTAIN";
  if (origin === "PLAYER_FEED_FORWARD") return "PLAYER_FEED_FORWARD";
  if (origin === "RELATIVE_RADIAL_INWARD") return "RADIAL_INWARD";
  if (origin === "RELATIVE_RADIAL_OUTWARD") return "RADIAL_OUTWARD";
  return origin;
}

function summarizeHorizon(result) {
  const candidateSignatures = result.frontierCandidates.map((candidate) =>
    [...new Set(candidate.originFamilies.map(normalizeOrigin))].sort().join("+") || "UNKNOWN"
  );
  const classes = [...new Set(
    result.frontierCandidates.flatMap((candidate) => candidate.originFamilies.map(normalizeOrigin))
  )].sort();
  return {
    h: result.horizonSeconds,
    state: result.shadowDecisionState,
    candidateCount: result.frontierCandidates.length,
    tangentPresent: classes.includes("TANGENT"),
    classes,
    signatures: [...new Set(candidateSignatures)].sort()
  };
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
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 1200))}`);
}

async function a11f(page) {
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
}

async function z4c(page) {
  return page.evaluate(() => window.__authorityA12z4cBrowserBridge?.snapshot() ?? null);
}

async function waitForA11fCount(page, minimum, timeout = 15_000) {
  await page.waitForFunction(
    (value) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= value,
    minimum,
    { timeout }
  );
}

async function requestCompactProbe(page, label) {
  const requestId = await page.evaluate(() => window.__authorityA12z4cBrowserBridge.requestProbe());
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (id) => window.__authorityA12z4cBrowserBridge?.snapshot().latest?.requestId === id,
    requestId,
    { timeout: 20_000 }
  );

  const shadow = await z4c(page);
  invariant(shadow?.lastError === null, `${label}: Z4c probe error: ${shadow?.lastError}`);
  invariant(shadow?.latest?.requestId === requestId, `${label}: wrong completed request.`);
  const latest = shadow.latest;
  invariant(latest.evaluation.sourceTick === latest.tick, `${label}: evaluation tick misaligned.`);
  invariant(latest.situation.tick === latest.tick, `${label}: situation tick misaligned.`);
  invariant(latest.evaluation.semantics.horizonPolicy === "NONE_SCAN_ONLY", `${label}: horizon policy appeared.`);
  invariant(latest.evaluation.semantics.tieBreak === "NONE", `${label}: tie-break appeared.`);
  invariant(latest.evaluation.semantics.sidePreference === "NONE", `${label}: side preference appeared.`);
  invariant(latest.evaluation.semantics.movementAuthority === "NONE_SHADOW_ONLY", `${label}: movement authority appeared.`);

  const live = await a11f(page);
  const frame = live.frames.find((candidate) => candidate.tick === latest.tick && candidate.variant === latest.variant);
  invariant(frame, `${label}: missing A1.1f frame at exact probe tick ${latest.tick}.`);
  invariant(intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent), `${label}: A1 changed companion authority.`);
  invariant(intentsEqual(frame.selectedCompanionIntent, latest.selectedCompanionIntent), `${label}: executed intent differs from probe observation.`);

  return {
    label,
    tick: latest.tick,
    playerMove: latest.situation.situated.playerControl.move,
    player: latest.situation.situated.playerBody.position,
    companion: latest.situation.situated.companionBody.position,
    baselineCompanionMove: frame.baselineCompanionIntent.move,
    durationMs: Math.round(latest.durationMs * 1000) / 1000,
    horizons: latest.evaluation.results.map(summarizeHorizon)
  };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during Z4d.");
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
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.goto("http://127.0.0.1:4173/?a1debug=1&a1z4c=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA12z4cBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });

  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Head-on contact") && text.includes("A1 OFF"), 15_000, "head-on reset");
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 DIRECT") && text.includes("PASS-THROUGH ONLY"), 10_000, "A1 DIRECT");
  await waitForA11fCount(page, 6);

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED") && text.includes("A1 DIRECT"), 10_000, "initial pause");

  const probes = [];
  probes.push(await requestCompactProbe(page, "settled-live"));

  const beforeApproach = (await a11f(page)).frameCount;
  await page.keyboard.down("d");
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForA11fCount(page, beforeApproach + 12);
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "approach-12 pause");
  probes.push(await requestCompactProbe(page, "owner-approach-12"));

  const beforeLater = (await a11f(page)).frameCount;
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForA11fCount(page, beforeLater + 18);
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "approach-30 pause");
  probes.push(await requestCompactProbe(page, "owner-approach-30"));
  await page.keyboard.up("d");

  const finalBridge = await z4c(page);
  invariant(finalBridge.requestCount === 3 && finalBridge.completedCount === 3, "Z4d expected exactly three completed Z4c probes.");
  invariant(probes[1].playerMove.x === 1 && probes[2].playerMove.x === 1, "Z4d approach probes lost same-step Owner +X input.");
  await assertNoFault(page, errors);

  console.log("[AUTHORITY_A1_2Z4D_CLASS_SUPPORT]", JSON.stringify({
    schema: "companion-brain-lab-authority-a1-2z4d-class-support-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    authority: "ZERO_MOVEMENT_AUTHORITY_PASSIVE_CLASS_TRACE",
    scenario: "head-on",
    reflectionRule: "POSITIVE_AND_NEGATIVE_TANGENTS_GROUPED_AS_ONE_TANGENT_CLASS_PER_Z4A",
    probes,
    semantics: {
      frontierOnly: true,
      numericMirrorWinnerIgnored: true,
      horizonPolicy: "NONE",
      sidePreference: "NONE",
      selector: "NONE",
      movementAuthority: "NONE"
    },
    errors
  }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
