import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-doorway-discovery";
const TRACE_TICKS = 150;

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
    await page.waitForTimeout(30);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 6000))}`);
}

async function tap(page, key, holdMs = 18) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(18);
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function setNumeric(page, parameter, value) {
  const numeric = page.locator(`[data-parameter="${parameter}"] .squad-lab-number-input`);
  await numeric.fill(String(value));
  await numeric.press("Enter");
  await numeric.blur();
  await page.waitForTimeout(50);
}

function parseComparison(text) {
  const rows = [];
  const pattern = /(C[1-4]) · Δpath ([+-]?\d+\.\d+)m · Δtarget (n\/a|[+-]?\d+\.\d+m) · ΔmotionErr ([+-]?\d+\.\d+) · blocked ([+-]?\d+)t \/ longest ([+-]?\d+)t · contacts ([+-]?\d+)t · authority transitions ([+-]?\d+) · order transitions ([+-]?\d+)/g;
  let match;
  while ((match = pattern.exec(text))) {
    rows.push({
      member: match[1],
      pathDelta: Number(match[2]),
      targetErrorDelta: match[3] === "n/a" ? null : Number(match[3].slice(0, -1)),
      motionErrorDelta: Number(match[4]),
      blockedTicksDelta: Number(match[5]),
      longestBlockedRunDelta: Number(match[6]),
      contactTicksDelta: Number(match[7]),
      authorityTransitionsDelta: Number(match[8]),
      orderTransitionsDelta: Number(match[9])
    });
  }
  return rows;
}

function parseTick(value) {
  return value === "none" ? null : Number(value.slice(0, -1));
}

function parseMeters(value) {
  return value === "n/a" ? null : Number(value.slice(0, -1));
}

function parseExposure(text) {
  const rows = [];
  const pattern = /(C[1-4]) exposure · first\/last blocked A (none|\d+t)\/(none|\d+t) → B (none|\d+t)\/(none|\d+t) · first contact A (none|\d+t) → B (none|\d+t) · block episodes A (\d+) → B (\d+) · final A (DIRECT|MOVING|ARRIVED|BLOCKED|INVALID_TARGET|n\/a) \/ (n\/a|\d+\.\d+m) → B (DIRECT|MOVING|ARRIVED|BLOCKED|INVALID_TARGET|n\/a) \/ (n\/a|\d+\.\d+m)/g;
  let match;
  while ((match = pattern.exec(text))) {
    rows.push({
      member: match[1],
      firstBlockedA: parseTick(match[2]),
      lastBlockedA: parseTick(match[3]),
      firstBlockedB: parseTick(match[4]),
      lastBlockedB: parseTick(match[5]),
      firstContactA: parseTick(match[6]),
      firstContactB: parseTick(match[7]),
      blockedEpisodesA: Number(match[8]),
      blockedEpisodesB: Number(match[9]),
      finalStatusA: match[10],
      finalTargetErrorA: parseMeters(match[11]),
      finalStatusB: match[12],
      finalTargetErrorB: parseMeters(match[13])
    });
  }
  return rows;
}

function aggregate(rows) {
  return rows.reduce((result, row) => ({
    pathDelta: result.pathDelta + row.pathDelta,
    targetErrorDelta:
      result.targetErrorDelta + (row.targetErrorDelta ?? 0),
    targetErrorComparableMembers:
      result.targetErrorComparableMembers + (row.targetErrorDelta === null ? 0 : 1),
    motionErrorDelta: result.motionErrorDelta + row.motionErrorDelta,
    blockedTicksDelta: result.blockedTicksDelta + row.blockedTicksDelta,
    longestBlockedRunDelta: result.longestBlockedRunDelta + row.longestBlockedRunDelta,
    contactTicksDelta: result.contactTicksDelta + row.contactTicksDelta
  }), {
    pathDelta: 0,
    targetErrorDelta: 0,
    targetErrorComparableMembers: 0,
    motionErrorDelta: 0,
    blockedTicksDelta: 0,
    longestBlockedRunDelta: 0,
    contactTicksDelta: 0
  });
}

async function recordTrace(page, slot, onTick = null) {
  const button = page.locator(`[data-trial-toggle="${slot}"]`);
  await button.click();
  await waitFor(page, (value) => value.includes(`recording ${slot}`), 8_000, `trace ${slot} starts`);
  for (let index = 0; index < TRACE_TICKS; index += 1) {
    await tap(page, "o");
    if (onTick) await onTick(index + 1);
  }
  await waitFor(
    page,
    (value) => value.includes(`recording ${slot} · ${TRACE_TICKS} ticks`),
    5_000,
    `trace ${slot} reaches ${TRACE_TICKS} ticks`
  );
  await button.click();
  await waitFor(page, (value) => value.includes("not recording"), 4_000, `trace ${slot} stops`);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4176, strictPort: true }
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

  await page.goto("http://127.0.0.1:4176/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(
    page,
    (value) => value.includes("scenario squad-field-lab"),
    8_000,
    "initial Field Lab"
  );

  await tap(page, "p");
  await waitFor(page, (value) => value.includes("PAUSED"), 3_000, "pause discovery setup");

  await page.locator('[data-squad-size="4"]').click();
  await waitFor(page, (value) => value.includes("real squad bodies 4"), 5_000, "four-member roster");
  await page.getByRole("button", { name: "ALL", exact: true }).click();
  await waitFor(page, (value) => value.includes("selected C1 + C2 + C3 + C4"), 3_000, "select all");

  await page.locator('[data-layout="DOORWAY"]').click();
  await waitFor(
    page,
    (value) => value.includes("layout DOORWAY · obstacles 2"),
    5_000,
    "doorway layout"
  );

  await page.getByRole("button", { name: "diamond", exact: true }).click();
  await setNumeric(page, "spacingScale", 1.0);
  await page.locator('[data-dynamics-scope="GROUP"]').click();
  await setNumeric(page, "responsiveness", 0.82);
  await setNumeric(page, "slotTolerance", 0.18);
  await setNumeric(page, "slowdownRadius", 0.72);
  const clearOverrides = page.locator('[data-clear-dynamics-overrides="true"]');
  if (await clearOverrides.isEnabled()) {
    await clearOverrides.click();
  }

  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable.");
  const doorwayGoal = internalCanvasPoint(box, { x: 10.8, y: 5.0 });
  await page.mouse.click(doorwayGoal.x, doorwayGoal.y, { button: "right" });
  await waitFor(
    page,
    (value) =>
      value.includes("C1 MOVE") &&
      value.includes("C2 MOVE") &&
      value.includes("C3 MOVE") &&
      value.includes("C4 MOVE") &&
      value.includes("spacing 1.00"),
    4_000,
    "baseline doorway MOVE"
  );

  await page.locator('[data-experiment-capture="A"]').click();
  const inputA = page.locator('[data-experiment-slot="A"] .squad-lab-experiment-label');
  await inputA.fill("doorway diamond baseline");
  await inputA.blur();
  await page.waitForTimeout(60);

  const variants = [
    {
      id: "compact-spacing",
      label: "diamond spacing 0.50",
      apply: async () => {
        await setNumeric(page, "spacingScale", 0.50);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "spacing-065",
      label: "diamond spacing 0.65",
      apply: async () => {
        await setNumeric(page, "spacingScale", 0.65);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "spacing-075",
      label: "diamond spacing 0.75",
      apply: async () => {
        await setNumeric(page, "spacingScale", 0.75);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "spacing-080",
      label: "diamond spacing 0.80",
      apply: async () => {
        await setNumeric(page, "spacingScale", 0.80);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "spacing-085",
      label: "diamond spacing 0.85",
      apply: async () => {
        await setNumeric(page, "spacingScale", 0.85);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "spacing-090",
      label: "diamond spacing 0.90",
      apply: async () => {
        await setNumeric(page, "spacingScale", 0.90);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "post-contact-compress-075",
      label: "diamond 1.00 then 0.80 at t75",
      apply: async () => {},
      expectedDiff: null,
      intervention: async (tick) => {
        if (tick === 75) {
          await setNumeric(page, "spacingScale", 0.80);
        }
      },
      interventionDescription: "spacingScale 1.00 → 0.80 after tick 75"
    },
    {
      id: "post-contact-compress",
      label: "diamond 1.00 then 0.80 at t90",
      apply: async () => {},
      expectedDiff: null,
      intervention: async (tick) => {
        if (tick === 90) {
          await setNumeric(page, "spacingScale", 0.80);
        }
      },
      interventionDescription: "spacingScale 1.00 → 0.80 after tick 90"
    },
    {
      id: "post-contact-compress-110",
      label: "diamond 1.00 then 0.80 at t110",
      apply: async () => {},
      expectedDiff: null,
      intervention: async (tick) => {
        if (tick === 110) {
          await setNumeric(page, "spacingScale", 0.80);
        }
      },
      interventionDescription: "spacingScale 1.00 → 0.80 after tick 110"
    },
    {
      id: "expanded-spacing",
      label: "diamond spacing 1.50",
      apply: async () => {
        await setNumeric(page, "spacingScale", 1.50);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "slow-response",
      label: "diamond response 0.27",
      apply: async () => {
        await setNumeric(page, "responsiveness", 0.27);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "max-response",
      label: "diamond response 1.00",
      apply: async () => {
        await setNumeric(page, "responsiveness", 1.00);
      },
      expectedDiff: "DYNAMICS"
    },
    {
      id: "column-shape",
      label: "column spacing 1.00",
      apply: async () => {
        await page.getByRole("button", { name: "column", exact: true }).click();
        await page.waitForTimeout(60);
      },
      expectedDiff: "FORMATION"
    }
  ];

  const results = [];

  for (const variant of variants) {
    for (const slot of ["A", "B"]) {
      const clearTrace = page.locator(`[data-trial-clear="${slot}"]`);
      if (await clearTrace.isEnabled()) {
        await clearTrace.click();
      }
    }

    await page.locator('[data-experiment-restore="A"]').click();
    await waitFor(
      page,
      (value) =>
        value.includes("layout DOORWAY · obstacles 2") &&
        value.includes("selected C1 + C2 + C3 + C4") &&
        value.includes("spacing 1.00") &&
        value.includes("C1 MOVE") &&
        value.includes("C4 MOVE"),
      7_000,
      `restore baseline before ${variant.id}`
    );

    await variant.apply();

    await page.locator('[data-experiment-capture="B"]').click();
    const inputB = page.locator('[data-experiment-slot="B"] .squad-lab-experiment-label');
    await inputB.fill(variant.label);
    await inputB.blur();
    await page.waitForTimeout(70);

    const setupDiff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
    if (variant.expectedDiff) {
      invariant(
        setupDiff.includes(variant.expectedDiff),
        `${variant.id} setup diff missing ${variant.expectedDiff}: ${setupDiff}`
      );
    } else {
      invariant(
        setupDiff.includes("identical setup state"),
        `${variant.id} should begin from identical A/B setup state: ${setupDiff}`
      );
    }
    invariant(
      !setupDiff.includes("POSITIONS"),
      `${variant.id} changed embodied starting positions: ${setupDiff}`
    );
    invariant(
      !setupDiff.includes("ORDERS"),
      `${variant.id} changed MOVE responsibility: ${setupDiff}`
    );

    await recordTrace(page, "A");
    const baselineFinal = await panelText(page);

    await recordTrace(page, "B", variant.intervention ?? null);
    const comparisonText = await waitFor(
      page,
      (value) =>
        value.includes("Trial / Trace A/B") &&
        value.includes("Δpath") &&
        value.includes("blocked") &&
        value.includes("contacts"),
      5_000,
      `${variant.id} temporal comparison`
    );

    if (variant.interventionDescription) {
      invariant(
        comparisonText.includes("authored interventions · A 0 · B 1"),
        `${variant.id} trace did not expose intervention count: ${comparisonText.slice(0, 3500)}`
      );
      invariant(
        comparisonText.includes("B t90 · FORMATION · GROUP · spacingScale · 1.00 → 0.80"),
        `${variant.id} trace lost authored spacing intervention provenance`
      );
    }

    const rows = parseComparison(comparisonText);
    invariant(rows.length === 4, `${variant.id} expected four member deltas, got ${rows.length}`);
    const exposure = parseExposure(comparisonText);
    invariant(
      exposure.length === 4,
      `${variant.id} expected four exposure timing rows, got ${exposure.length}`
    );
    const totals = aggregate(rows);
    const finalStatuses = {};
    for (const member of ["C1", "C2", "C3", "C4"]) {
      const match = comparisonText.match(new RegExp(`${member} MOVE @[^·]+ · (DIRECT|MOVING|ARRIVED|BLOCKED|INVALID_TARGET)`));
      finalStatuses[member] = match?.[1] ?? null;
    }

    results.push({
      id: variant.id,
      label: variant.label,
      setupDiff,
      intervention: variant.interventionDescription ?? null,
      members: rows,
      exposure,
      totals,
      finalStatuses,
      baselineFinalHadBlocked: baselineFinal.includes("· BLOCKED")
    });

    await page.screenshot({
      path: `${ROOT}/${variant.id}.png`,
      type: "png",
      fullPage: true
    });
  }

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-doorway-discovery-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "For the same four-member doorway MOVE, are temporal failures dominated by formation geometry/spacing or by movement responsiveness?",
    controlledBaseline: {
      situation: "TRAINING",
      layout: "DOORWAY",
      roster: 4,
      selection: "ALL",
      preset: "DIAMOND",
      spacingScale: 1.0,
      responsiveness: 0.82,
      slotTolerance: 0.18,
      slowdownRadius: 0.72,
      moveAnchor: { x: 10.8, y: 5.0 },
      traceTicks: TRACE_TICKS
    },
    variants: results,
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_DOORWAY_DISCOVERY]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
