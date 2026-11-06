import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ART = "artifacts/companion-cover-physical-browser";
const assert = (x, msg) => { if (!x) throw new Error(msg); };
const server = await preview({
  logLevel: "error", preview: {host: "127.0.0.1", port: 4188, strictPort: true}
});
let browser;
async function tap(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(35);
  await page.keyboard.up(key);
}
async function runEncounter(cover) {
  const context = await browser.newContext({viewport:{width:1800,height:1060}});
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  const status = page.locator('[data-combat-micro-status="true"]');
  const active = page.locator('[data-c1-cover="toggle"]');
  try {
    await page.goto("http://127.0.0.1:4188/?fieldlab=1", {waitUntil:"domcontentloaded"});
    await page.locator("#game-root canvas").waitFor({state:"visible"});
    await tap(page, "p"); // Freeze before selecting authored test conditions.
    await page.locator('[data-situation="COMBAT_MICRO"]').click();
    await page.locator('[data-layout="OPEN"]').click();
    await page.locator('[data-squad-size="1"]').click();
    await page.waitForFunction(() =>
      document.querySelector("#debug-panel")?.textContent?.includes("scenario squad-field-lab-combat-micro") &&
      document.querySelector("#debug-panel")?.textContent?.includes("layout OPEN")
    ,null,{timeout:12000});
    assert((await status.textContent()).includes("HP 3/3"), "initial Combat Micro not pristine");
    assert(!(await active.getAttribute("aria-pressed")).includes("true"), "C1 Cover not default OFF");
    if (cover) {
      await active.click();
      assert(await active.getAttribute("aria-pressed") === "true", "C1 Cover not explicitly armed");
      await page.locator("#game-root canvas").click({position:{x:180,y:180}});
      await tap(page,"c");
      assert(await active.getAttribute("aria-pressed") === "false",
        "C keyboard command could not revoke C1 Cover");
      await tap(page,"c");
      assert(await active.getAttribute("aria-pressed") === "true",
        "C keyboard command could not re-arm C1 Cover");
    }
    await page.screenshot({path:`${ART}/${cover?"cover":"baseline"}-01-before.png`});
    await tap(page, "t"); // 2x fixed-step simulation, not a fake speed or physics.
    await tap(page, "p"); // Start.
    await page.waitForFunction(({cover}) => {
      const s = document.querySelector('[data-combat-micro-status="true"]')?.textContent ?? "";
      return cover ? s.includes("history C1") : /hits YOU [1-9]/.test(s);
    }, {cover}, {timeout:15000});
    const result = (await status.textContent()) ?? "";
    const debug = (await page.locator("#debug-panel").textContent()) ?? "";
    const coverStatus = (await page.locator('[data-c1-cover-status="true"]').textContent()) ?? "";
    await page.screenshot({path:`${ART}/${cover?"cover":"baseline"}-02-material-outcome.png`});
    assert(errs.length === 0, "browser errors: " + errs.join(" | "));
    assert(cover
      ? result.includes("history C1") && result.includes("pressure target C1") && result.includes("HP 2/3")
      : result.includes("history none") && /hits YOU [1-9]/.test(result),
      "unqualified comparison result: " + JSON.stringify({cover,result,coverStatus}));
    if (cover) {
      assert(debug.includes("C1 live-cover STRIKE attempt"),
        "no source-visible C1 autonomy evidence in causal microscope");
      await tap(page, "p");
      await active.click();
      assert(await active.getAttribute("aria-pressed") === "false",
        "Owner cannot explicitly revoke live C1 cover");
    }
    return {result,coverStatus,sourceTrace:debug.includes("C1 live-cover STRIKE attempt")};
  } finally { await context.close(); }
}
try {
  await mkdir(ART,{recursive:true});
  browser = await chromium.launch({headless:true});
  const baseline = await runEncounter(false);
  const covered = await runEncounter(true);
  console.log(JSON.stringify({
    status:"PASS / physically distinct opt-in C1 agency",
    baseline,
    covered,
    warning:"COMBAT_MICRO OPEN only. No Owner acceptance or broad teammate cognition."
  },null,2));
} finally {
  if(browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
