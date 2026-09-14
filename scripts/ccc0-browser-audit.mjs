import { chromium } from "playwright-chromium";
import { preview } from "vite";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTick(text) {
  const match = text.match(/\btick (\d+)\b/);
  return match ? Number(match[1]) : null;
}

function parseAnchor(text) {
  const match = text.match(/\banchor (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function timingSummary(values) {
  const samples = values.filter((value) => Number.isFinite(value) && value >= 0 && value < 5000).sort((a, b) => a - b);
  return {
    count: samples.length,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    maxMs: samples.at(-1) ?? null,
    stallsOver50Ms: samples.filter((value) => value > 50).length,
    stallsOver100Ms: samples.filter((value) => value > 100).length,
    stallsOver250Ms: samples.filter((value) => value > 250).length,
    stallsOver1000Ms: samples.filter((value) => value > 1000).length
  };
}

async function readDownloadJson(download) {
  const stream = await download.createReadStream();
  invariant(stream, "Browser incident download did not expose a readable stream.");
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function panelText(page) {
  return page.locator("#debug-panel").innerText();
}

function sectionDetails(page, sectionId) {
  return page.locator(`details[data-section-id="${sectionId}"]`);
}

async function sectionText(page, sectionId) {
  return sectionDetails(page, sectionId).innerText();
}

async function waitForPanel(page, predicate, timeout = 10_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out after ${timeout}ms. Latest panel: ${JSON.stringify(latest.slice(0, 4000))}`);
}

async function waitForSection(page, sectionId, predicate, timeout = 10_000, label = sectionId) {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await sectionText(page, sectionId).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out after ${timeout}ms. Latest section: ${JSON.stringify(latest.slice(0, 4000))}`);
}

async function openSectionAndProvePersistence(page, sectionId, title) {
  const details = sectionDetails(page, sectionId);
  await details.waitFor({ state: "attached", timeout: 10_000 });
  if (!(await details.evaluate((element) => element.open))) {
    await details.locator("summary").click();
  }
  invariant(await details.evaluate((element) => element.open), `${title}: section did not open after a real summary click.`);

  const beforeTick = parseTick(await panelText(page));
  await page.waitForTimeout(350);
  const afterTick = parseTick(await panelText(page));
  invariant(
    beforeTick !== null && afterTick !== null && afterTick > beforeTick,
    `${title}: World did not advance while disclosure persistence was tested (${beforeTick} -> ${afterTick}).`
  );
  invariant(
    await sectionDetails(page, sectionId).evaluate((element) => element.open),
    `${title}: live panel rebuild closed a user-opened section.`
  );
}

async function waitForScenario(page, label) {
  await waitForPanel(
    page,
    (text) => text.includes(`scenario ${label}`),
    10_000,
    `scenario ${label}`
  );
  await waitForSection(
    page,
    "ccc-where",
    (text) => text.includes("sample t") && !text.includes("SHADOW ERROR"),
    10_000,
    `${label} visible CCC-0 WHERE evidence`
  );
}

async function assertNoFault(page, errors) {
  const sentinel = await page.locator("#runtime-fault-sentinel").count();
  invariant(sentinel === 0, "Runtime fault sentinel became visible during Chromium audit.");
  invariant(errors.page.length === 0, `Page errors observed: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors observed: ${errors.console.join(" | ")}`);
}

async function bootDiagnostics(page, errors) {
  const panel = await page.locator("#debug-panel").innerText().catch(() => "<debug panel unavailable>");
  const fault = await page.locator("#runtime-fault-sentinel").innerText().catch(() => "<no runtime fault sentinel>");
  return JSON.stringify({
    panel: panel.slice(0, 4000),
    fault: fault.slice(0, 4000),
    pageErrors: errors.page,
    consoleErrors: errors.console,
    failedRequests: errors.requests
  });
}

const server = await preview({
  logLevel: "error",
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
});

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };

  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.addInitScript(() => {
    const audit = { intervals: [], startedAt: performance.now() };
    Object.defineProperty(window, "__ccc0BrowserAudit", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: audit
    });
    let last = performance.now();
    const sample = (now) => {
      audit.intervals.push(now - last);
      if (audit.intervals.length > 30_000) audit.intervals.shift();
      last = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  try {
    await waitForPanel(page, (text) => /\btick \d+\b/.test(text), 15_000, "initial World tick");
  } catch (error) {
    throw new Error(`Workbench did not publish a World tick after canvas boot. ${await bootDiagnostics(page, errors)}`, { cause: error });
  }
  invariant(errors.requests.length === 0, `Failed network requests: ${errors.requests.join(" | ")}`);
  await assertNoFault(page, errors);

  const initialText = await panelText(page);
  const initialTick = parseTick(initialText);
  invariant(initialTick !== null, "Could not read initial World tick from causal panel.");
  await page.waitForTimeout(700);
  const runningTick = parseTick(await panelText(page));
  invariant(runningTick !== null && runningTick > initialTick, `World tick did not advance (${initialTick} -> ${runningTick}).`);

  const coordinationToggle = page.locator(".debug-layer-toggle").filter({ hasText: "Coordination" }).locator("input");
  await coordinationToggle.check();
  invariant(await coordinationToggle.isChecked(), "Coordination world layer could not be enabled through the real panel UI.");

  await openSectionAndProvePersistence(page, "ccc-where", "CCC-0 shadow · WHERE");
  await waitForSection(
    page,
    "ccc-where",
    (text) => text.includes("sample t") && !text.includes("SHADOW ERROR"),
    10_000,
    "initial visible CCC-0 WHERE evidence"
  );

  const scenarios = [
    ["scenario-open", "Open field"],
    ["scenario-pillar", "Central pillar"],
    ["scenario-doorway", "Narrow doorway"],
    ["scenario-head-on", "Head-on contact"]
  ];
  const scenarioEvidence = [];
  for (const [action, label] of scenarios) {
    await page.locator(`[data-action="${action}"]`).click();
    await waitForScenario(page, label);
    await page.waitForTimeout(350);
    const text = await panelText(page);
    const tick = parseTick(text);
    invariant(tick !== null && tick > 0, `${label}: World did not run after scenario load.`);
    invariant(await sectionDetails(page, "ccc-where").evaluate((element) => element.open), `${label}: CCC-0 WHERE disclosure state was lost across scenario load.`);
    invariant(text.includes("CCC-0 shadow · PACE"), `${label}: CCC-0 PACE section missing from panel.`);
    invariant(text.includes("CCC-0 shadow · PLAYER FLOW"), `${label}: CCC-0 PLAYER FLOW section missing from panel.`);
    invariant(!text.includes("SHADOW ERROR"), `${label}: shadow coordination reported an error.`);
    scenarioEvidence.push({ label, tick, anchor: parseAnchor(text) });
    await assertNoFault(page, errors);
  }

  await page.locator('[data-action="scenario-open"]').click();
  await waitForScenario(page, "Open field");
  let text = await panelText(page);
  invariant(text.includes("actuator NATURAL"), "Expected NATURAL actuator at browser-audit baseline.");
  await page.locator('[data-action="toggle-actuator"]').click();
  await waitForPanel(page, (value) => value.includes("actuator DIRECT"), 5_000, "DIRECT actuator toggle");
  await page.waitForTimeout(250);
  await assertNoFault(page, errors);
  await page.locator('[data-action="toggle-actuator"]').click();
  await waitForPanel(page, (value) => value.includes("actuator NATURAL"), 5_000, "NATURAL actuator toggle");

  await openSectionAndProvePersistence(page, "ccc-player", "CCC-0 shadow · PLAYER FLOW");
  await waitForSection(
    page,
    "ccc-player",
    (value) => value.includes("source") && !value.includes("unavailable"),
    10_000,
    "visible CCC-0 PLAYER FLOW evidence"
  );

  const beforeInput = parseAnchor(await panelText(page));
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  const [incidentDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    page.locator('[data-action="capture-incident"]').click()
  ]);
  const incident = await readDownloadJson(incidentDownload);
  text = await panelText(page);
  invariant(text.includes("source actual") || text.includes("source requested"), "WASD input did not appear as visible player-flow velocity evidence.");
  await page.keyboard.up("d");
  await page.waitForTimeout(300);

  invariant(incident.schema === "companion-brain-lab-ccc0-causal-incident-v5", `Unexpected incident schema: ${incident.schema}`);
  invariant(Array.isArray(incident.frames) && incident.frames.length > 0, "Incident v5 contained no causal frames.");
  const incidentFrame = incident.frames.at(-1);
  invariant(incidentFrame?.observation?.playerInputMove?.x > 0.5, "Incident v5 did not preserve same-step owner movement input.");
  invariant(Number.isFinite(incidentFrame?.observation?.playerMotionError), "Incident v5 missing pre-step player motionError.");
  invariant(typeof incidentFrame?.decision?.localSafetyState === "string", "Incident v5 missing local safety provenance.");
  invariant(incidentFrame?.decision?.coarseLocalVelocity && Number.isFinite(incidentFrame.decision.coarseLocalVelocity.x), "Incident v5 missing coarse local velocity.");
  invariant("refinementSource" in incidentFrame.decision, "Incident v5 missing refinement provenance field.");
  invariant("naturalRegime" in incidentFrame.decision, "Incident v5 missing NATURAL regime provenance field.");
  invariant(incidentFrame?.command?.preConstraintVelocity && Number.isFinite(incidentFrame.command.preConstraintVelocity.x), "Incident v5 missing pre-constraint velocity.");
  invariant(incidentFrame?.command?.finalConstraintVelocity && Number.isFinite(incidentFrame.command.finalConstraintVelocity.x), "Incident v5 missing final-constraint velocity.");
  invariant(Number.isFinite(incidentFrame?.outcome?.companionMotionError), "Incident v5 missing companion outcome motionError.");
  invariant(incidentFrame?.outcome?.playerActualVelocity && Number.isFinite(incidentFrame.outcome.playerActualVelocity.x), "Incident v5 missing post-World player actual velocity.");
  invariant(Number.isFinite(incidentFrame?.outcome?.playerMotionError), "Incident v5 missing post-World player motionError.");
  invariant(Number.isFinite(incidentFrame?.outcome?.playerDisplacement), "Incident v5 missing post-World player displacement.");

  const afterInput = parseAnchor(await panelText(page));
  invariant(beforeInput && afterInput, "Could not read shadow anchor around keyboard-input probe.");
  invariant(Math.hypot(afterInput.x - beforeInput.x, afterInput.y - beforeInput.y) > 0.05, "Shadow evidence did not respond measurably to real keyboard-driven player motion.");
  invariant(await sectionDetails(page, "ccc-player").evaluate((element) => element.open), "CCC-0 PLAYER FLOW disclosure did not survive live input updates.");

  const longRun = [
    ["w", 500], ["d", 700], ["s", 450], ["a", 650],
    ["w", 350], ["d", 500], ["a", 300], ["s", 550]
  ];
  const longRunStartTick = parseTick(await panelText(page));
  for (const [key, duration] of longRun) {
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(120);
    await assertNoFault(page, errors);
  }
  const longRunEndTick = parseTick(await panelText(page));
  invariant(
    longRunStartTick !== null && longRunEndTick !== null && longRunEndTick - longRunStartTick > 120,
    `Long browser run advanced too few World ticks (${longRunStartTick} -> ${longRunEndTick}).`
  );
  invariant(await sectionDetails(page, "ccc-where").evaluate((element) => element.open), "CCC-0 WHERE disclosure did not survive the long browser run.");
  invariant(await sectionDetails(page, "ccc-player").evaluate((element) => element.open), "CCC-0 PLAYER FLOW disclosure did not survive the long browser run.");

  // One bounded real-browser rehearsal of the confirmed solver-motion -> semantic-objective leak.
  // Freeze the old scenario first so Head-on loads at canonical tick zero. Then let only the manual companion create the contact.
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (value) => value.includes("PAUSED"), 5_000, "pause before canonical Head-on load");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (value) => value.includes("scenario Head-on contact") && value.includes("PAUSED"), 10_000, "paused canonical Head-on scenario");
  await page.locator('[data-action="cycle-mode"]').click();
  await waitForPanel(page, (value) => value.includes("mode MANUAL") && value.includes("PAUSED"), 5_000, "MANUAL mode for solver-motion rehearsal");

  await page.keyboard.down("ArrowLeft");
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (value) => value.includes("RUNNING"), 5_000, "unpause manual push from canonical geometry");
  await page.waitForTimeout(1_050);
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (value) => value.includes("PAUSED"), 5_000, "pause at manual player contact");
  await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(100);

  await page.locator('[data-action="cycle-mode"]').click();
  await waitForPanel(page, (value) => value.includes("mode CHASE"), 5_000, "CHASE transition before relational rehearsal");
  await page.locator('[data-action="cycle-mode"]').click();
  await waitForPanel(page, (value) => value.includes("mode RELATIONAL"), 5_000, "RELATIONAL mode for solver-motion rehearsal");

  const causalBeforeTick = parseTick(await panelText(page));
  invariant(causalBeforeTick !== null, "Could not read paused tick before causal single-step.");
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(
    page,
    (value) => {
      const tick = parseTick(value);
      return tick !== null && tick > causalBeforeTick && value.includes("mode RELATIONAL");
    },
    5_000,
    "RELATIONAL causal single-step"
  );

  const [solverLeakDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    page.locator('[data-action="capture-incident"]').click()
  ]);
  const solverLeakIncident = await readDownloadJson(solverLeakDownload);
  invariant(solverLeakIncident.schema === "companion-brain-lab-ccc0-causal-incident-v5", "Solver-motion rehearsal did not export incident v5.");
  const solverLeakFrame = solverLeakIncident.frames.at(-1);
  const solverInput = solverLeakFrame?.observation?.playerInputMove;
  const solverRequested = solverLeakFrame?.observation?.playerRequestedVelocity;
  const solverActual = solverLeakFrame?.observation?.playerActualVelocity;
  const consumedHeading = solverLeakFrame?.decision?.relationshipPlayerDirection;
  const solverActualSpeed = solverActual ? Math.hypot(solverActual.x, solverActual.y) : 0;
  const solverRequestedSpeed = solverRequested ? Math.hypot(solverRequested.x, solverRequested.y) : Number.POSITIVE_INFINITY;
  const solverInputMagnitude = solverInput ? Math.hypot(solverInput.x, solverInput.y) : Number.POSITIVE_INFINITY;
  const headingDot = solverActual && consumedHeading && solverActualSpeed > 1e-9
    ? (solverActual.x / solverActualSpeed) * consumedHeading.x + (solverActual.y / solverActualSpeed) * consumedHeading.y
    : Number.NEGATIVE_INFINITY;

  invariant(solverInputMagnitude < 1e-6, `Solver-motion rehearsal owner input was not zero: ${JSON.stringify(solverInput)}`);
  invariant(solverRequestedSpeed < 1e-6, `Solver-motion rehearsal player requested velocity was not zero: ${JSON.stringify(solverRequested)}`);
  invariant(solverActualSpeed > 0.1, `Manual companion push did not leave meaningful player actual velocity: ${JSON.stringify(solverActual)}`);
  invariant(
    solverLeakFrame?.observation?.playerContacts?.includes("companion"),
    `Solver-motion rehearsal did not preserve player/companion contact provenance: ${JSON.stringify(solverLeakFrame?.observation?.playerContacts)}`
  );
  invariant(consumedHeading && headingDot > 0.95, `Relationship did not consume the solver-induced player heading: dot=${headingDot}`);
  invariant(typeof solverLeakFrame?.decision?.relationshipLabel === "string", "Solver-motion rehearsal missing relational slot decision.");
  invariant(
    solverLeakFrame?.decision?.relationshipTarget && Number.isFinite(solverLeakFrame.decision.relationshipTarget.x),
    "Solver-motion rehearsal missing relational target."
  );
  await assertNoFault(page, errors);

  const intervals = await page.evaluate(() => window.__ccc0BrowserAudit?.intervals ?? []);
  const timing = timingSummary(intervals);
  invariant(timing.count > 120, `Too few requestAnimationFrame samples (${timing.count}).`);
  invariant(timing.stallsOver1000Ms === 0, `Gross >1s rendering stall observed (${timing.stallsOver1000Ms}).`);
  await assertNoFault(page, errors);

  const finalText = await panelText(page);
  const result = {
    schema: "ccc0-browser-readiness-audit-v1",
    browser: await browser.version(),
    initialTick,
    runningTick,
    scenarioEvidence,
    incidentV5: {
      schema: incident.schema,
      frameCount: incident.frames.length,
      capturedTick: incident.tick,
      lastFrameSequence: incidentFrame?.sequence ?? null,
      ownerInputMove: incidentFrame?.observation?.playerInputMove ?? null,
      localSafetyState: incidentFrame?.decision?.localSafetyState ?? null,
      refinementSource: incidentFrame?.decision?.refinementSource ?? null,
      naturalRegime: incidentFrame?.decision?.naturalRegime ?? null,
      playerMotionErrorAfter: incidentFrame?.outcome?.playerMotionError ?? null
    },
    solverMotionSemanticLeak: {
      capturedTick: solverLeakIncident.tick,
      frameSequence: solverLeakFrame?.sequence ?? null,
      ownerInputMove: solverInput ?? null,
      playerRequestedVelocity: solverRequested ?? null,
      playerActualVelocity: solverActual ?? null,
      playerContacts: solverLeakFrame?.observation?.playerContacts ?? [],
      relationshipPlayerDirection: consumedHeading ?? null,
      relationshipLabel: solverLeakFrame?.decision?.relationshipLabel ?? null,
      relationshipTarget: solverLeakFrame?.decision?.relationshipTarget ?? null,
      headingDot
    },
    finalTick: parseTick(finalText),
    coordinationLayerEnabled: await coordinationToggle.isChecked(),
    persistentDisclosure: {
      where: await sectionDetails(page, "ccc-where").evaluate((element) => element.open),
      playerFlow: await sectionDetails(page, "ccc-player").evaluate((element) => element.open)
    },
    timing,
    errors
  };
  console.log(`[CCC0_BROWSER_AUDIT] ${JSON.stringify(result)}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
