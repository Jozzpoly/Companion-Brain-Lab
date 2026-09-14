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

async function panelText(page) {
  return page.locator("#debug-panel").innerText();
}

async function waitForScenario(page, label) {
  await page.waitForFunction(
    (expected) => document.querySelector("#debug-panel")?.textContent?.includes(`scenario ${expected}`),
    label,
    { timeout: 10_000 }
  );
  await page.waitForFunction(() => {
    const text = document.querySelector("#debug-panel")?.textContent ?? "";
    return text.includes("CCC-0 shadow · WHERE") && text.includes("sample t") && !text.includes("SHADOW ERROR");
  }, { timeout: 10_000 });
}

async function assertNoFault(page, errors) {
  const sentinel = await page.locator("#runtime-fault-sentinel").count();
  invariant(sentinel === 0, "Runtime fault sentinel became visible during Chromium audit.");
  invariant(errors.page.length === 0, `Page errors observed: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors observed: ${errors.console.join(" | ")}`);
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

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => /\btick \d+\b/.test(document.querySelector("#debug-panel")?.textContent ?? ""), { timeout: 15_000 });
  invariant(errors.requests.length === 0, `Failed network requests: ${errors.requests.join(" | ")}`);

  const initialText = await panelText(page);
  const initialTick = parseTick(initialText);
  invariant(initialTick !== null, "Could not read initial World tick from causal panel.");
  await page.waitForTimeout(700);
  const runningTick = parseTick(await panelText(page));
  invariant(runningTick !== null && runningTick > initialTick, `World tick did not advance (${initialTick} -> ${runningTick}).`);

  const coordinationToggle = page.locator(".debug-layer-toggle").filter({ hasText: "Coordination" }).locator("input");
  await coordinationToggle.check();
  invariant(await coordinationToggle.isChecked(), "Coordination world layer could not be enabled through the real panel UI.");

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
    invariant(text.includes("CCC-0 shadow · PACE"), `${label}: CCC-0 PACE evidence missing from panel.`);
    invariant(text.includes("CCC-0 shadow · PLAYER FLOW"), `${label}: CCC-0 PLAYER FLOW evidence missing from panel.`);
    invariant(!text.includes("SHADOW ERROR"), `${label}: shadow coordination reported an error.`);
    scenarioEvidence.push({ label, tick, anchor: parseAnchor(text) });
    await assertNoFault(page, errors);
  }

  await page.locator('[data-action="scenario-open"]').click();
  await waitForScenario(page, "Open field");
  let text = await panelText(page);
  invariant(text.includes("actuator NATURAL"), "Expected NATURAL actuator at browser-audit baseline.");
  await page.locator('[data-action="toggle-actuator"]').click();
  await page.waitForFunction(() => document.querySelector("#debug-panel")?.textContent?.includes("actuator DIRECT"), { timeout: 5_000 });
  await page.waitForTimeout(250);
  await assertNoFault(page, errors);
  await page.locator('[data-action="toggle-actuator"]').click();
  await page.waitForFunction(() => document.querySelector("#debug-panel")?.textContent?.includes("actuator NATURAL"), { timeout: 5_000 });

  const beforeInput = parseAnchor(await panelText(page));
  await page.keyboard.down("d");
  await page.waitForTimeout(650);
  text = await panelText(page);
  invariant(text.includes("source actual") || text.includes("source requested"), "WASD input did not appear as live player-flow velocity evidence.");
  await page.keyboard.up("d");
  await page.waitForTimeout(450);
  const afterInput = parseAnchor(await panelText(page));
  invariant(beforeInput && afterInput, "Could not read shadow anchor around keyboard-input probe.");
  invariant(Math.hypot(afterInput.x - beforeInput.x, afterInput.y - beforeInput.y) > 0.05, "Shadow evidence did not respond measurably to real keyboard-driven player motion.");

  // Longer mixed-input/browser run. This is deliberately not a feel oracle; it is
  // a real rendering/input/runtime survival probe that can catch browser-only faults
  // and gross stalls which deterministic simulation tests cannot see.
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
    finalTick: parseTick(finalText),
    coordinationLayerEnabled: await coordinationToggle.isChecked(),
    timing,
    errors
  };
  console.log(`[CCC0_BROWSER_AUDIT] ${JSON.stringify(result)}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
