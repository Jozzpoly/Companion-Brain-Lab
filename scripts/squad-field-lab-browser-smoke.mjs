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

async function tapKey(page, key, holdMs = 55) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

async function repeatTapUntil(page, key, predicate, timeout, label) {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeout) {
    await tapKey(page, key);
    await page.waitForTimeout(100);
    latest = await panelText(page);
    if (predicate(latest)) return latest;
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 5000))}`);
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

  // Squad-size controls rebuild the physical World roster; inactive members are
  // absent from Rapier rather than merely hidden in the HUD.
  await page.locator('[data-squad-size="2"]').click();
  const twoBodies = await waitFor(
    page,
    (value) => value.includes("real squad bodies 2 · C1, C2"),
    6_000,
    "two-body real roster"
  );
  invariant(twoBodies.includes("C1") && twoBodies.includes("C2"), "Two-member roster truth missing.");
  invariant(
    await page.locator('.squad-lab-roster-button[data-member-id="squad-3"]').isDisabled(),
    "C3 remains selectable after physical roster shrinks to two."
  );

  await page.locator('[data-squad-size="4"]').click();
  await waitFor(
    page,
    (value) => value.includes("real squad bodies 4 · C1, C2, C3, C4"),
    6_000,
    "four-body roster restored"
  );

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

  // Freeze the exact live spatial setup before rebuilding the World. Layout
  // A/B is only meaningful if body positions survive, not merely control labels.
  await tapKey(page, "p");
  const pausedBeforeLayouts = await waitFor(
    page,
    (value) => value.includes("PAUSED") && value.includes("Focused · C4"),
    3_000,
    "pause before layout matrix"
  );
  const c4BeforeLayouts = focusedBody(pausedBeforeLayouts);
  invariant(c4BeforeLayouts, "C4 position unavailable before layout matrix.");

  // The same squad/control state must survive multiple physical layouts.
  // These are real World rebuilds with different obstacle sets, not visual presets.
  for (const [layout, obstacleCount] of [
    ["OPEN", 0],
    ["DOORWAY", 2],
    ["PILLAR", 1],
    ["MIXED", 3]
  ]) {
    await page.locator(`[data-layout="${layout}"]`).click();
    const layoutState = await waitFor(
      page,
      (value) =>
        value.includes(`layout ${layout} · obstacles ${obstacleCount}`) &&
        value.includes("C4 MOVE"),
      7_000,
      `${layout} layout preserving squad state`
    );
    invariant(
      layoutState.includes("C4 MOVE"),
      `${layout} rebuild discarded the existing C4 assignment.`
    );
    const c4AfterLayout = focusedBody(layoutState);
    invariant(c4AfterLayout, `${layout} rebuild lost focused C4 body truth.`);
    invariant(
      Math.hypot(
        c4AfterLayout.x - c4BeforeLayouts.x,
        c4AfterLayout.y - c4BeforeLayouts.y
      ) < 0.08,
      `${layout} rebuild reset live C4 position instead of preserving the spatial setup.`
    );
  }
  await screenshot(page, "05-layout-matrix-preserves-squad-state.png");
  await tapKey(page, "p");

  // Let the training world resume normally, then freeze the *current* spatial
  // truth immediately before the situation rebuild. C4 still has MOVE authority,
  // so comparing against the older pre-layout coordinate would incorrectly call
  // legitimate motion a rebuild reset.
  await page.waitForTimeout(180);
  await tapKey(page, "p");
  const pausedBeforePressure = await waitFor(
    page,
    (value) => value.includes("PAUSED") && value.includes("Focused · C4"),
    3_000,
    "pause immediately before pressure switch"
  );
  const c4BeforePressure = focusedBody(pausedBeforePressure);
  invariant(c4BeforePressure, "C4 position unavailable immediately before pressure switch.");

  // The same control state must survive a switch from spatial training into
  // continuous cooperative pressure. C4's independent MOVE assignment is a
  // deliberate canary: switching situations must not reset squad semantics.
  await page.getByRole("button", { name: "Pressure" }).click();
  const pressureLoaded = await waitFor(
    page,
    (value) =>
      value.includes("scenario squad-field-lab-pressure") &&
      value.includes("Cooperative pressure") &&
      value.includes("phase CALM") &&
      value.includes("C4 MOVE"),
    8_000,
    "pressure situation preserving squad control state"
  );
  invariant(pressureLoaded.includes("spacing 1.50"), "Pressure rebuild lost live formation dynamics.");
  const c4InPressure = focusedBody(pressureLoaded);
  invariant(c4InPressure, "C4 position unavailable after pressure rebuild.");
  invariant(
    Math.hypot(
      c4InPressure.x - c4BeforePressure.x,
      c4InPressure.y - c4BeforePressure.y
    ) < 0.25,
    "TRAINING -> PRESSURE transition reset the existing live spatial setup."
  );
  await screenshot(page, "05-pressure-preserves-squad-state.png");

  // Cycle 1: author a real pre-contact responsibility for C2 through the
  // existing world-space control surface. FOLLOW is not expected to magically
  // place it inside REPEL range.
  await page.locator('.squad-lab-roster-button[data-member-id="squad-2"]').click();
  const c2InterceptAnchor = internalCanvasPoint(box, { x: 4.2, y: 4.02 });
  await page.mouse.click(c2InterceptAnchor.x, c2InterceptAnchor.y, { button: "right" });
  await tapKey(page, "p");
  await waitFor(
    page,
    (value) =>
      value.includes("Focused · C2") &&
      value.includes("C2 MOVE") &&
      value.includes("ARRIVED"),
    5_000,
    "C2 reaches authored intercept slot"
  );
  await waitFor(
    page,
    (value) => value.includes("Focused · C2") && value.includes("phase APPROACHING"),
    7_000,
    "pressure cycle 1 approaching with authored C2 intercept"
  );
  const c2Repel = await repeatTapUntil(
    page,
    "Enter",
    (value) =>
      value.includes("REPEL squad-2 -> SUCCEEDED") &&
      value.includes("pressure outcome REPELLED · repelled by squad-2") &&
      value.includes("remembered REPELLED"),
    5_000,
    "C2 materially repels threat"
  );
  invariant(c2Repel.includes("REPEL squad-2 -> SUCCEEDED"), "C2 is still decorative in cooperative pressure.");
  await screenshot(page, "06-c2-material-contribution.png");

  // Cycle 2: put C1+C2 into two distinct authored slots near the threat path and
  // require one selected-group action to produce two real World contributors.
  await waitFor(
    page,
    (value) => value.includes("phase CALM") && value.includes("cycle 2"),
    9_000,
    "pressure cycle 2 calm"
  );
  const spacingPressure = page.locator(".squad-lab-slider input").nth(0);
  await spacingPressure.evaluate((element) => {
    element.value = "0.65";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator('.squad-lab-roster-button[data-member-id="companion"]').click();
  await page.locator('.squad-lab-roster-button[data-member-id="squad-2"]').click({ modifiers: ["Shift"] });
  const pairAnchor = internalCanvasPoint(box, { x: 5.2, y: 5.0 });
  await page.mouse.click(pairAnchor.x, pairAnchor.y, { button: "right" });
  await waitFor(
    page,
    (value) =>
      value.includes("selected C1 + C2") &&
      value.includes("C1 MOVE") &&
      value.includes("C2 MOVE"),
    3_000,
    "C1+C2 receive shared spatial responsibility"
  );
  await waitFor(
    page,
    (value) => value.includes("phase APPROACHING") && value.includes("cycle 2"),
    8_000,
    "pressure cycle 2 approaching with C1+C2 selected"
  );
  const groupRepel = await repeatTapUntil(
    page,
    "Space",
    (value) =>
      value.includes("REPEL companion -> SUCCEEDED") &&
      value.includes("REPEL squad-2 -> SUCCEEDED") &&
      value.includes("pressure outcome REPELLED · repelled by companion, squad-2"),
    5_000,
    "selected group jointly repels threat"
  );
  invariant(
    groupRepel.includes("REPEL companion -> SUCCEEDED") && groupRepel.includes("REPEL squad-2 -> SUCCEEDED"),
    "Selected group action did not produce multi-member material contribution."
  );
  await screenshot(page, "07-selected-group-joint-contribution.png");

  // Cycle 3: player can own the outcome even though the squad is present.
  await waitFor(
    page,
    (value) => value.includes("phase APPROACHING") && value.includes("cycle 3"),
    12_000,
    "pressure cycle 3 approaching"
  );
  const playerRepel = await repeatTapUntil(
    page,
    "e",
    (value) =>
      value.includes("REPEL player -> SUCCEEDED") &&
      value.includes("pressure outcome REPELLED · repelled by player"),
    8_000,
    "player takeover under squad pressure"
  );
  invariant(playerRepel.includes("repelled by player"), "Player could not own cooperative-pressure outcome.");
  await screenshot(page, "08-player-takes-pressure-outcome.png");

  // Cycle 4: no one acts. The situation must have a real consequence, then
  // recover into another calm beat without reloading or changing squad setup.
  await waitFor(
    page,
    (value) => value.includes("phase APPROACHING") && value.includes("cycle 4"),
    12_000,
    "pressure cycle 4 approaching"
  );
  const hit = await waitFor(
    page,
    (value) =>
      value.includes("pressure outcome PLAYER_HIT") &&
      value.includes("remembered PLAYER_HIT") &&
      value.includes("repelled by none"),
    10_000,
    "pressure no-action consequence"
  );
  invariant(hit.includes("PLAYER_HIT"), "Pressure has no material consequence when everyone abstains.");
  await screenshot(page, "09-pressure-no-action-consequence.png");

  const recovered = await waitFor(
    page,
    (value) =>
      value.includes("phase CALM") &&
      value.includes("cycle 5") &&
      value.includes("C4 MOVE"),
    10_000,
    "pressure continuity after no-action consequence"
  );
  invariant(recovered.includes("C4 MOVE"), "Squad assignment state was lost across pressure cycles.");
  await screenshot(page, "10-pressure-cycle-continuity.png");

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-squad-field-lab-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      realRosterCanShrinkAndGrow: true,
      fourEmbodiedMembersVisible: true,
      multiSelectionScopesOrders: true,
      focusedDirectControlMovesRealBody: true,
      presetsGenerateEditableGeometry: true,
      liveSpacingChangesTargets: true,
      worldSpaceSlotDragEditsGeometry: true,
      worldSpaceMoveScopesToSelection: true,
      formationMotorRespondsMaterially: true,
      layoutMatrixPreservesSquadControlState: true,
      layoutMatrixPreservesLiveBodyPositions: true,
      pressurePreservesLiveBodyPositions: true,
      pressurePreservesSquadControlState: true,
      extraSquadMemberCanMateriallyContribute: true,
      selectedGroupCanJointlyContribute: true,
      playerCanTakePressureOutcome: true,
      noActionHasPressureConsequence: true,
      pressureCyclesWithoutResettingSquadState: true
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
