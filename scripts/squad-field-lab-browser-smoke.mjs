import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-browser";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(page, selector) {
  return (await page.locator(selector).textContent()) ?? "";
}

async function panelText(page) {
  return text(page, "#debug-panel");
}

async function waitFor(page, predicate, timeout = 12_000, label = "condition") {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 5000))}`);
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

function focusedBody(textValue) {
  const match = textValue.match(/body (-?\d+\.\d+), (-?\d+\.\d+)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function focusedTarget(textValue) {
  const match = textValue.match(/target (-?\d+\.\d+), (-?\d+\.\d+)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function focusedLocalSlot(textValue) {
  const match = textValue.match(/slot local (-?\d+\.\d+), (-?\d+\.\d+)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${ROOT}/${name}.png`, type: "png", fullPage: true });
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
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
    viewport: { width: 1700, height: 1050 },
    recordVideo: {
      dir: `${ROOT}/video`,
      size: { width: 1280, height: 790 }
    }
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

  await page.goto("http://127.0.0.1:4173/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('[data-squad-field-lab-hud="true"]').waitFor({ state: "visible", timeout: 10_000 });
  await waitFor(
    page,
    (value) => value.includes("scenario squad-field-lab") && value.includes("focus C1"),
    8_000,
    "Field Lab initial state"
  );

  invariant(
    await page.locator(".squad-lab-roster-button[data-member-id]").count() === 4,
    "Field Lab roster does not expose four real squad members."
  );
  await screenshot(page, "00-field-lab-initial.png");

  // Selection must be real control scope, not decorative highlighting.
  await page.locator('.squad-lab-roster-button[data-member-id="squad-2"]').click();
  await page.locator('.squad-lab-roster-button[data-member-id="squad-3"]').click({ modifiers: ["Shift"] });
  const multi = await waitFor(
    page,
    (value) => value.includes("selected C2 + C3") && value.includes("focus C2"),
    3_000,
    "multi-selection"
  );
  invariant(multi.includes("C1 FOLLOW") && multi.includes("C4 FOLLOW"), "Unselected members disappeared from group truth.");

  await page.getByRole("button", { name: "Hold here" }).click();
  const held = await waitFor(
    page,
    (value) =>
      value.includes("C2 HOLD") &&
      value.includes("C3 HOLD") &&
      value.includes("C1 FOLLOW") &&
      value.includes("C4 FOLLOW"),
    3_000,
    "selection-scoped HOLD"
  );
  invariant(held.includes("C1 FOLLOW"), "HOLD leaked from selection into C1.");
  await screenshot(page, "01-selection-scoped-hold.png");

  await page.getByRole("button", { name: "Follow" }).click();
  await waitFor(
    page,
    (value) => value.includes("C2 FOLLOW") && value.includes("C3 FOLLOW"),
    3_000,
    "selected FOLLOW restoration"
  );

  // Direct control is a distinct authority source for one focused real body.
  await page.locator('.squad-lab-roster-button[data-member-id="squad-2"]').click();
  await page.getByRole("button", { name: /Direct/ }).click();
  const beforeDirectText = await waitFor(
    page,
    (value) => value.includes("Focused · C2") && value.includes("authority DIRECT"),
    3_000,
    "C2 direct authority"
  );
  const beforeDirect = focusedBody(beforeDirectText);
  invariant(beforeDirect, "Focused C2 body position unavailable before direct drive.");
  await holdKey(page, "ArrowLeft", 450);
  const afterDirectText = await waitFor(
    page,
    (value) => {
      const pos = focusedBody(value);
      return Boolean(pos && pos.x < beforeDirect.x - 0.15 && value.includes("authority DIRECT"));
    },
    3_000,
    "direct manual movement"
  );
  const afterDirect = focusedBody(afterDirectText);
  invariant(afterDirect && afterDirect.x < beforeDirect.x - 0.15, "Direct authority did not materially move C2.");
  await screenshot(page, "02-direct-focused-companion.png");
  await page.getByRole("button", { name: /Direct C2: ON/ }).click();

  // Presets generate editable slot geometry rather than selecting an opaque mode.
  await page.locator('.squad-lab-roster-button[data-member-id="squad-4"]').click();
  await page.getByRole("button", { name: "wedge" }).click();
  const wedge = await waitFor(
    page,
    (value) => value.includes("Focused · C4") && value.includes("slot local 2.25, 1.35"),
    3_000,
    "generated wedge slot"
  );
  const slotBefore = focusedLocalSlot(wedge);
  invariant(slotBefore, "Generated C4 wedge slot unavailable.");

  // Spacing is a live dynamics control and must move the current spatial target.
  const targetBeforeSpacing = focusedTarget(wedge);
  invariant(targetBeforeSpacing, "Focused formation target unavailable before spacing change.");
  const spacingInput = page.locator(".squad-lab-slider input").nth(0);
  await spacingInput.evaluate((element) => {
    const input = element;
    input.value = "1.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const spaced = await waitFor(
    page,
    (value) => {
      const target = focusedTarget(value);
      return Boolean(target && Math.hypot(target.x - targetBeforeSpacing.x, target.y - targetBeforeSpacing.y) > 0.5);
    },
    3_000,
    "spacing changes formation target"
  );
  const targetAfterSpacing = focusedTarget(spaced);
  invariant(targetAfterSpacing, "Focused target unavailable after spacing change.");

  // Drag the actual world-space slot handle. The resulting local geometry must
  // change and remain ordinary editable data after the wedge generator ran.
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable.");
  const dragFrom = internalCanvasPoint(box, targetAfterSpacing);
  const dragToWorld = { x: targetAfterSpacing.x, y: targetAfterSpacing.y + 0.9 };
  const dragTo = internalCanvasPoint(box, dragToWorld);
  await page.mouse.move(dragFrom.x, dragFrom.y);
  await page.mouse.down();
  await page.mouse.move(dragTo.x, dragTo.y, { steps: 8 });
  await page.mouse.up();

  const edited = await waitFor(
    page,
    (value) => {
      const slot = focusedLocalSlot(value);
      return Boolean(slot && Math.abs(slot.y - slotBefore.y) > 0.35);
    },
    4_000,
    "world-space slot drag"
  );
  const slotAfter = focusedLocalSlot(edited);
  invariant(slotAfter && Math.abs(slotAfter.y - slotBefore.y) > 0.35, "Slot handle drag did not edit canonical formation geometry.");
  await screenshot(page, "03-wedge-generated-then-slot-edited.png");

  // Right-click world issues a MOVE only to the selected member.
  const movePoint = internalCanvasPoint(box, { x: 12.8, y: 7.2 });
  await page.mouse.click(movePoint.x, movePoint.y, { button: "right" });
  const movedOrder = await waitFor(
    page,
    (value) => value.includes("C4 MOVE") && value.includes("C1 FOLLOW") && value.includes("C2 FOLLOW") && value.includes("C3 FOLLOW"),
    3_000,
    "selection-scoped world MOVE"
  );
  invariant(movedOrder.includes("C1 FOLLOW"), "World MOVE leaked into unselected C1.");
  await screenshot(page, "04-world-space-move-selected.png");

  // The formation motor must materially move C4 toward that new responsibility point.
  const beforeMove = focusedBody(movedOrder);
  invariant(beforeMove, "C4 body unavailable before MOVE.");
  const afterMoveText = await waitFor(
    page,
    (value) => {
      const pos = focusedBody(value);
      return Boolean(pos && Math.hypot(pos.x - beforeMove.x, pos.y - beforeMove.y) > 0.45);
    },
    5_000,
    "formation motor follows world-space MOVE"
  );
  const afterMove = focusedBody(afterMoveText);
  invariant(afterMove && Math.hypot(afterMove.x - beforeMove.x, afterMove.y - beforeMove.y) > 0.45,
    "C4 did not materially respond to its world-space MOVE order.");

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-squad-field-lab-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      fourEmbodiedMembersVisible: true,
      multiSelectionScopesOrders: true,
      focusedDirectControlMovesRealBody: true,
      presetsGenerateEditableGeometry: true,
      liveSpacingChangesTargets: true,
      worldSpaceSlotDragEditsGeometry: true,
      worldSpaceMoveScopesToSelection: true,
      formationMotorRespondsMaterially: true
    },
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[SQUAD_FIELD_LAB_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
