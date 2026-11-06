// True old-Jaskinia × CURRENT Field Lab (not a fake game and not an R1 Pages build).
// Run after building both repos into this repo's dist/ as in the PR workflow.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ART = "artifacts/companion-jaskinia-lived-browser";
const eq = (ok, why) => { if (!ok) throw new Error(why); };
const server = await preview({
  logLevel: "error", preview: {host: "127.0.0.1", port: 4187, strictPort: true}
});
let browser;
try {
  await mkdir(ART, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1620, height: 1000 } });
  await context.addInitScript(() => {
    try { localStorage.setItem("jaskinia:hint", "1"); } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push("pageerror: " + err.message));
  page.on("console", msg => {
    if (msg.type() === "error" && !/favicon/i.test(msg.text()))
      errors.push("console: " + msg.text());
  });

  const base = "http://127.0.0.1:4187";
  await page.goto(base + "/Jozz-Cave-Workbench/index.html", {waitUntil: "domcontentloaded"});
  await page.waitForFunction(() => typeof window.__JASK?.commit === "function", {timeout: 15_000});
  const labId = await page.evaluate(url => {
    const J = window.__JASK;
    const id = J.leafIds(J.L.tree)[0];
    J.commit("probe: live Companion in Jaskinia", L => {
      L.wins[id].type = "przyrzad";
      L.wins[id].pin = null;
      L.wins[id].st = { url, title: "Companion · prawdziwy świat" };
    });
    return id;
  }, base + "/?fieldlab=1");

  const probe = id => {
    const entry = window.__JASK.live().find(x => x.id === id);
    return entry && {
      hello: entry.hello,
      state: entry.state,
      sampleTick: entry.n?.tick ?? null
    };
  };
  await page.waitForFunction(
    ({id}) => {
      const entry = window.__JASK?.live().find(x => x.id === id);
      return entry?.hello?.name === "Companion · Shared Moment" &&
        entry.state?.data?.schema === "companion-lived-moment/v0" &&
        entry.state?.data?.bodies?.some(x => x.id === "companion");
    },
    {id: labId},
    {timeout: 20_000}
  );
  const first = await page.evaluate(probe, labId);
  eq(first.state.data.restorable === false, "Witness falsely advertised replay");
  eq(first.state.data.authority.focused === "companion", "Not the actual squad control");
  eq(first.state.data.world.scenarioId === "squad-field-lab", "Not current Field Lab");
  const frame = page.frameLocator(`.win[data-id="${labId}"] iframe`);
  await frame.locator("#game-root canvas").waitFor({state: "visible", timeout: 12_000});
  await page.screenshot({path: ART + "/01-genuine-jaskinia-and-fieldlab.png", fullPage: true});

  // The important distinction is source World tick, not the host wall clock.
  await page.waitForTimeout(1000);
  const before = await page.evaluate(probe, labId);
  eq(before.state.data.world.tick > first.state.data.world.tick,
    "World tick did not advance while framed by genuine Jaskinia");

  // The Owner flags this exact living situation through Jaskinia's real UX.
  await page.locator(`.win[data-id="${labId}"] .lv-flag`).click();
  await page.locator(".jk-uwaga textarea").fill(
    "Research-only: companion should account for the player's intent here."
  );
  await page.keyboard.press("Control+Enter");
  await page.waitForFunction(() => window.__JASK?.uwagi?.some(
    x => x.text.startsWith("Research-only: companion should account")
  ), {timeout: 5_000});
  const note = await page.evaluate(() => window.__JASK.uwagi.find(
    x => x.text.startsWith("Research-only: companion should account")
  ));
  eq(note.przyrzad?.dane?.schema === "companion-lived-moment/v0",
    "Jaskinia did not pin real World data to the Owner remark");
  eq(Number.isInteger(note.przyrzad.dane.world.tick),
    "No World tick at the time of note");
  eq(note.przyrzad.dane.world.tick >= before.state.data.world.tick,
    "Note attached a stale World tick");
  const panel = await frame.locator("#debug-panel").textContent();
  eq(panel.includes("Owner remark received from Jaskinia"),
    "Source lab did not receive the Jaskinia Owner feedback");
  await page.screenshot({path: ART + "/02-note-and-source-ack.png", fullPage: true});

  // Native Jaskinia UX must not silently replace the live world on rearrangement.
  const tickBefore = (await page.evaluate(probe, labId)).state.data.world.tick;
  await page.locator(`.win[data-id="${labId}"] .b-mx`).click();
  await page.waitForTimeout(500);
  await page.locator(`.win[data-id="${labId}"] .b-mx`).click();
  await page.waitForTimeout(600);
  const tickAfter = (await page.evaluate(probe, labId)).state.data.world.tick;
  eq(tickAfter >= tickBefore, "Jaskinia maximize restored a new/restarted World");

  // Do not disguise visual usability as a successful transport test. The Field
  // Lab currently has THREE large columns. Measure its actual world footprint
  // when hosted inside the real, freely rearrangeable Jaskinia window.
  const measureLab = () => frame.locator("#lab-shell").evaluate(root => {
    const rect = node => {
      const b = node?.getBoundingClientRect();
      return b ? { width: Math.round(b.width), height: Math.round(b.height) } : null;
    };
    return {
      viewport: {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight},
      worldPane: rect(root.querySelector("#game-pane")),
      worldCanvas: rect(root.querySelector("#game-root canvas")),
      hud: rect(root.querySelector(".squad-field-lab-hud")),
      debug: rect(root.querySelector("#debug-panel"))
    };
  });
  const desktopLayout = await measureLab();
  await page.setViewportSize({width: 430, height: 860});
  await page.waitForTimeout(750);
  const narrowLayout = await measureLab();
  eq(desktopLayout.worldCanvas?.width >= 650,
    "World-first desktop Jaskinia still sacrificed the World to toolbars: " + JSON.stringify(desktopLayout));
  eq(narrowLayout.worldCanvas?.width >= 300,
    "World-first narrow Jaskinia still sacrificed the World to toolbars: " + JSON.stringify(narrowLayout));

  const squadDrawer = frame.locator('[data-workspace-drawer="squad"]');
  const microscopeDrawer = frame.locator('[data-workspace-drawer="microscope"]');
  await squadDrawer.click();
  eq(await frame.locator(".squad-field-lab-hud").evaluate(el => el.classList.contains("is-workspace-open")),
    "Squad tools did not reopen as the original full HUD");
  await microscopeDrawer.click();
  eq(await frame.locator("#debug-panel").evaluate(el => el.classList.contains("is-workspace-open")),
    "The existing causal microscope cannot be reopened");
  eq(!(await frame.locator(".squad-field-lab-hud").evaluate(el => el.classList.contains("is-workspace-open"))),
    "Two compact drawers interfere instead of handing over the viewport");
  await frame.locator('body').press("Escape");
  eq(!(await frame.locator("#debug-panel").evaluate(el => el.classList.contains("is-workspace-open"))),
    "Escape did not restore the unobstructed World");
  await page.screenshot({path: ART + "/03-jaskinia-narrow-world-first.png", fullPage: true});
  await page.setViewportSize({width: 1620, height: 1000});
  await page.waitForTimeout(750);
  const recoveredTick = (await page.evaluate(probe, labId)).state?.data?.world.tick;
  eq(recoveredTick >= tickAfter, "Viewport transition replaced or reset the World");
  eq(errors.length === 0, "Browser errors: " + errors.join(" | "));

  console.log(JSON.stringify({
    status: "PASS in bounded real-browser reproduction",
    source: "CURRENT Field Lab + old Jaskinia real windows",
    recordedTick: note.przyrzad.dane.world.tick,
    fromTick: first.state.data.world.tick,
    afterTick: tickAfter,
    recoveredAfterNarrowTick: recoveredTick,
    viewportEvidence: {desktop: desktopLayout, narrow: narrowLayout},
    usabilityWarning: "Responsive World footprint recovered. This does NOT qualify mobile input, Owner feel, or sustained layout quality.",
    caveat: "No Owner feel qualification; this is not solver replay or autonomous teammate"
  }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
