import { chromium } from "playwright-chromium";
import { preview } from "vite";
import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT_PATH = "artifacts/a1-2z4f-tick0-early-live-class-map.json";
const LAST_PROBE_TICK = 12;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

function near(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
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

async function requestProbe(page, expectedTick) {
  const requestId = await page.evaluate(() => window.__authorityA12z4cBrowserBridge.requestProbe());
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (id) => window.__authorityA12z4cBrowserBridge?.snapshot().latest?.requestId === id,
    requestId,
    { timeout: 20_000 }
  );

  const shadow = await z4c(page);
  invariant(shadow?.lastError === null, `tick ${expectedTick}: Z4c probe error: ${shadow?.lastError}`);
  invariant(shadow?.latest?.requestId === requestId, `tick ${expectedTick}: wrong completed request.`);
  const latest = shadow.latest;
  invariant(latest.tick === expectedTick, `expected exact live tick ${expectedTick}, got ${latest.tick}.`);
  invariant(latest.evaluation.sourceTick === latest.tick, `tick ${expectedTick}: evaluation tick misaligned.`);
  invariant(latest.situation.tick === latest.tick, `tick ${expectedTick}: situation tick misaligned.`);
  invariant(latest.situation.situated.snapshot.scenarioId === "head-on", `tick ${expectedTick}: wrong scenario.`);
  invariant(latest.situation.situated.playerControl.move.x === 1 && latest.situation.situated.playerControl.move.y === 0,
    `tick ${expectedTick}: same-step Owner +X input missing.`);
  invariant(latest.evaluation.semantics.horizonPolicy === "NONE_SCAN_ONLY", `tick ${expectedTick}: horizon policy appeared.`);
  invariant(latest.evaluation.semantics.tieBreak === "NONE", `tick ${expectedTick}: tie-break appeared.`);
  invariant(latest.evaluation.semantics.sidePreference === "NONE", `tick ${expectedTick}: side preference appeared.`);
  invariant(latest.evaluation.semantics.movementAuthority === "NONE_SHADOW_ONLY", `tick ${expectedTick}: movement authority appeared.`);

  const live = await a11f(page);
  const frame = live.frames.find((candidate) => candidate.tick === latest.tick && candidate.variant === latest.variant);
  invariant(frame, `tick ${expectedTick}: missing A1.1f frame at exact probe tick.`);
  invariant(intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent), `tick ${expectedTick}: A1 changed companion authority.`);
  invariant(intentsEqual(frame.selectedCompanionIntent, latest.selectedCompanionIntent), `tick ${expectedTick}: executed intent differs from probe observation.`);

  const player = latest.situation.situated.playerBody.position;
  const companion = latest.situation.situated.companionBody.position;
  return {
    tick: latest.tick,
    player: { ...player },
    companion: { ...companion },
    relative: {
      x: companion.x - player.x,
      y: companion.y - player.y,
      distance: Math.hypot(companion.x - player.x, companion.y - player.y)
    },
    baselineCompanionMove: { ...frame.baselineCompanionIntent.move },
    durationMs: Math.round(latest.durationMs * 1000) / 1000,
    horizons: latest.evaluation.results.map(summarizeHorizon)
  };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during Z4f.");
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

  // Freeze the existing workbench first. R1LabScene intentionally preserves pause state across scenario reloads,
  // so the new head-on World remains at exact tick 0 until the first requested single step.
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "pre-reset pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Head-on contact") && text.includes("PAUSED"), 15_000, "paused head-on reset");
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 DIRECT") && text.includes("PASS-THROUGH ONLY") && text.includes("PAUSED"), 10_000, "paused A1 DIRECT");

  await page.keyboard.down("d");
  const probes = [];
  for (let tick = 0; tick <= LAST_PROBE_TICK; tick += 1) {
    probes.push(await requestProbe(page, tick));
  }
  await page.keyboard.up("d");

  const tick0 = probes[0];
  invariant(near(tick0.player.x, 4.5) && near(tick0.player.y, 4), `tick 0 player did not match authored head-on start: ${JSON.stringify(tick0.player)}`);
  invariant(near(tick0.companion.x, 7.5) && near(tick0.companion.y, 4), `tick 0 companion did not match authored head-on start: ${JSON.stringify(tick0.companion)}`);
  invariant(probes.every((probe, index) => probe.tick === index), "Z4f probe sequence skipped or repeated a World tick.");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-authority-a1-2z4f-early-live-class-map-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    authority: "ZERO_MOVEMENT_AUTHORITY_PASSIVE_EVERY_TICK_TRACE",
    scenario: "head-on",
    setup: "PAUSE_BEFORE_SCENARIO_RESET_THEN_OWNER_POSITIVE_X_FROM_EXACT_TICK_ZERO",
    reflectionRule: "POSITIVE_AND_NEGATIVE_TANGENTS_GROUPED_AS_ONE_TANGENT_CLASS_PER_Z4A",
    sampledTicks: [0, LAST_PROBE_TICK],
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
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log("[AUTHORITY_A1_2Z4F_EARLY_LIVE_CLASS_MAP]", JSON.stringify(summary));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
