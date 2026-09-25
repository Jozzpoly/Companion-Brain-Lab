import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-task-pressure-strategies";
const TICKS = 300;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function waitFor(page, predicate, timeout = 10_000, label = "condition") {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 6500))}`);
}

async function tap(page, key, holdMs = 14) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(8);
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function dragWorld(page, canvas, from, to) {
  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable.");
  const start = internalCanvasPoint(box, from);
  const end = internalCanvasPoint(box, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(70);
}

async function moveSelected(page, canvas, target) {
  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable for MOVE.");
  const point = internalCanvasPoint(box, target);
  await page.mouse.click(point.x, point.y, { button: "right" });
  await page.waitForTimeout(45);
}

function taskState(text) {
  const match = text.match(
    /phase (IDLE|ACTIVE|COMPLETED|SETTLED) · progress (\d+)\/(\d+)t[\s\S]*?player (COMMITTED|outside) · task (CONTESTED|clear)[\s\S]*?player↔hostile contact (YES|no)/
  );
  if (!match) return null;
  return {
    phase: match[1],
    progress: Number(match[2]),
    required: Number(match[3]),
    committed: match[4] === "COMMITTED",
    contested: match[5] === "CONTESTED",
    playerHostileContact: match[6] === "YES"
  };
}

async function resetAuthoredStart(page, canvas, c1Position) {
  await tap(page, "r");
  await waitFor(
    page,
    (value) =>
      value.includes("scenario squad-field-lab-task-pressure") &&
      value.includes("phase IDLE · progress 0/180t"),
    8_000,
    "reset task pressure"
  );

  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  await dragWorld(page, canvas, { x: 8.2, y: 5.0 }, { x: 9.0, y: 5.0 });
  await dragWorld(page, canvas, { x: 10.4, y: 5.0 }, c1Position);
  await setup.click();

  await page.locator('.squad-lab-roster-button[data-member-id="companion"]').click();
  await page.getByRole("button", { name: /Hold here/ }).click();
  await waitFor(page, (value) => value.includes("C1 HOLD"), 4_000, "C1 starting HOLD");
}

async function runVariant(page, canvas, variant) {
  await resetAuthoredStart(page, canvas, variant.c1Start);

  let maxProgress = 0;
  let contestedTicks = 0;
  let playerContactTicks = 0;
  let c1HostileContactTicks = 0;
  let firstContestTick = null;
  let firstPlayerContactTick = null;
  let firstC1ContactTick = null;
  let completionTick = null;
  let settledTick = null;
  let latest = null;
  const interventionTicks = [];

  for (let tick = 1; tick <= TICKS; tick += 1) {
    const intervention = variant.interventions?.find((entry) => entry.tick === tick);
    if (intervention) {
      await moveSelected(page, canvas, intervention.target);
      interventionTicks.push(tick);
    }

    await tap(page, "o");
    const text = await panelText(page);
    latest = taskState(text);
    invariant(latest, `${variant.id}: task state missing at tick ${tick}`);

    maxProgress = Math.max(maxProgress, latest.progress);
    if (latest.contested) {
      contestedTicks += 1;
      if (firstContestTick === null) {
        firstContestTick = tick;
        await page.screenshot({
          path: `${ROOT}/${variant.id}-first-contest.png`,
          type: "png",
          fullPage: true
        });
      }
    }
    if (latest.playerHostileContact) {
      playerContactTicks += 1;
      if (firstPlayerContactTick === null) firstPlayerContactTick = tick;
    }

    const c1Contact = /Focused · C1[\s\S]*?contacts [^\n]*hostile×\d+/.test(text);
    if (c1Contact) {
      c1HostileContactTicks += 1;
      if (firstC1ContactTick === null) {
        firstC1ContactTick = tick;
        await page.screenshot({
          path: `${ROOT}/${variant.id}-first-screen-contact.png`,
          type: "png",
          fullPage: true
        });
      }
    }

    if (completionTick === null && (latest.phase === "COMPLETED" || latest.phase === "SETTLED")) {
      completionTick = tick;
    }
    if (settledTick === null && latest.phase === "SETTLED") settledTick = tick;
  }

  await page.screenshot({
    path: `${ROOT}/${variant.id}-final.png`,
    type: "png",
    fullPage: true
  });

  return {
    id: variant.id,
    description: variant.description,
    c1Start: variant.c1Start,
    interventions: variant.interventions ?? [],
    interventionTicks,
    maxProgress,
    contestedTicks,
    playerContactTicks,
    c1HostileContactTicks,
    firstContestTick,
    firstPlayerContactTick,
    firstC1ContactTick,
    completionTick,
    settledTick,
    final: latest
  };
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4180, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.goto("http://127.0.0.1:4180/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (value) => value.includes("scenario squad-field-lab"), 8_000, "Field Lab ready");

  await tap(page, "p");
  await page.locator('[data-situation="TASK_PRESSURE"]').click();
  await waitFor(page, (value) => value.includes("scenario squad-field-lab-task-pressure"), 8_000, "task pressure");
  await page.locator('[data-layout="OPEN"]').click();
  await waitFor(page, (value) => value.includes("layout OPEN · obstacles 0"), 6_000, "open task layout");
  await page.locator('[data-squad-size="1"]').click();
  await waitFor(page, (value) => value.includes("real squad bodies 1"), 5_000, "one companion");

  const variants = [
    {
      id: "parked-away",
      description: "C1 HOLDs away from the threat lane.",
      c1Start: { x: 7.0, y: 2.0 }
    },
    {
      id: "pre-screen",
      description: "C1 begins on the threat lane and HOLDs a physical screen.",
      c1Start: { x: 10.55, y: 5.0 }
    },
    {
      id: "off-axis-screen",
      description: "C1 HOLDs near the task but one metre off the threat lane.",
      c1Start: { x: 10.55, y: 6.0 }
    },
    {
      id: "early-intercept",
      description: "C1 starts poorly positioned and receives a MOVE to the screen at t20.",
      c1Start: { x: 7.0, y: 2.0 },
      interventions: [{ tick: 20, target: { x: 10.55, y: 5.0 } }]
    },
    {
      id: "late-intercept",
      description: "C1 starts poorly positioned and receives the same MOVE only at t80.",
      c1Start: { x: 7.0, y: 2.0 },
      interventions: [{ tick: 80, target: { x: 10.55, y: 5.0 } }]
    }
  ];

  const results = [];
  for (const variant of variants) {
    results.push(await runVariant(page, canvas, variant));
  }

  const byId = Object.fromEntries(results.map((entry) => [entry.id, entry]));
  const parked = byId["parked-away"];
  const pre = byId["pre-screen"];
  const off = byId["off-axis-screen"];
  const early = byId["early-intercept"];
  const late = byId["late-intercept"];

  invariant(parked.maxProgress < 180 && parked.contestedTicks > 20, "parked-away baseline lost sustained pressure.");
  invariant(pre.maxProgress === 180 && pre.completionTick !== null, "pre-screen no longer completes task.");
  invariant(pre.c1HostileContactTicks > 20, "pre-screen completion was not supported by material C1↔hostile contact.");
  invariant(off.maxProgress < pre.maxProgress - 20, "off-axis placement was not materially worse than the physical screen.");
  invariant(off.c1HostileContactTicks < pre.c1HostileContactTicks / 4, "off-axis placement still behaved like the central screen.");
  invariant(early.interventionTicks.includes(20), "early intercept intervention was not issued.");
  invariant(late.interventionTicks.includes(80), "late intercept intervention was not issued.");

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-task-pressure-strategies-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Does Shared Task Under Pressure expose distinct manual responsibilities, or collapse to one magic body placement?",
    variants: results,
    fixedFacts: {
      sameTaskCenter: true,
      samePlayerCommitPosition: true,
      sameHostileHomeAndMotionLaw: true,
      noRepelUsed: true,
      noAutonomyUsed: true
    },
    interpretationBoundary:
      "Descriptive manual-strategy evidence only. No ranking, behavior semantic, teammate feel, or autonomy promotion.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_TASK_PRESSURE_STRATEGIES]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
