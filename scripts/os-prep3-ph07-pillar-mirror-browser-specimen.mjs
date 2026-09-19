import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/os-prep3-ph07-pillar-mirror";
const WORLD_HEIGHT = 8;
const TOTAL_TICKS = 216;
const SCREENSHOT_EVERY = 12;
const STORIES = {
  top: [
    { id: "top-pre-nudge", keys: ["w"], steps: 48 },
    { id: "forward", keys: ["d"], steps: 120 },
    { id: "top-return-center", keys: ["s"], steps: 48 }
  ],
  bottom: [
    { id: "bottom-pre-nudge", keys: ["s"], steps: 48 },
    { id: "forward", keys: ["d"], steps: 120 },
    { id: "bottom-return-center", keys: ["w"], steps: 48 }
  ]
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
function distance(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function mirrorPoint(v){ return {x:v.x,y:WORLD_HEIGHT-v.y}; }
function mirrorVector(v){ return {x:v.x,y:-v.y}; }
function panelTick(text){ const m=text.match(/tick\s+(\d+)/); return m?Number(m[1]):null; }
async function panelText(page){ return page.locator("#debug-panel").innerText(); }
async function waitForPanel(page,predicate,timeout=15000,label="panel condition"){
  const start=Date.now(); let latest="";
  while(Date.now()-start<timeout){
    latest=await panelText(page).catch(()=>"");
    if(predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0,2400))}`);
}
async function currentTick(page){
  const t=panelTick(await panelText(page));
  invariant(Number.isInteger(t),"Could not parse World tick.");
  return t;
}
async function singleStep(page,expected){
  invariant(await currentTick(page)===expected,`PH-07 tick drift before t${expected}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(page,text=>panelTick(text)===expected+1,15000,`PH-07 t${expected}->${expected+1}`);
}
async function setKeys(page,active){
  for(const key of ["w","a","s","d"]){
    if(active.includes(key)) await page.keyboard.down(key);
    else await page.keyboard.up(key).catch(()=>{});
  }
}
async function captureCanvas(page,dir,index,tick,beat){
  const file=`frame-${String(index).padStart(3,"0")}-t${String(tick).padStart(3,"0")}-${beat}.jpg`;
  const bytes=await page.locator("#game-root canvas").screenshot({type:"jpeg",quality:78});
  await writeFile(`${dir}/${file}`,bytes);
  return {tick,beat,file,bytes:bytes.length};
}
async function captureIncident(page,pathOut){
  const wait=page.waitForEvent("download",{timeout:15000});
  await page.locator('[data-action="capture-incident"]').click();
  const dl=await wait; const p=await dl.path();
  invariant(p,"PH-07 incident download produced no path.");
  const bytes=await readFile(p); await writeFile(pathOut,bytes);
  return JSON.parse(bytes.toString("utf8"));
}
function physicalView(frame){
  return {
    observationTick:frame.observation.worldTick,
    outcomeTick:frame.outcome.worldTick,
    playerControlMove:frame.observation.playerControlMove,
    playerPosition:frame.observation.playerPosition,
    companionPosition:frame.observation.companionPosition,
    companionActualVelocity:frame.observation.companionActualVelocity,
    commandedVelocity:frame.command.commandedVelocity,
    companionOutcomePosition:frame.outcome.companionPosition,
    companionRequestedVelocity:frame.outcome.companionRequestedVelocity,
    companionOutcomeVelocity:frame.outcome.companionActualVelocity,
    contacts:frame.outcome.companionContacts,
    routeStatus:frame.decision.routeStatus,
    routePath:frame.decision.routePath,
    relationshipLabel:frame.decision.relationshipLabel,
    relationshipTarget:frame.decision.relationshipTarget
  };
}
function compareTwin(aFrames,bFrames,label){
  invariant(aFrames.length===TOTAL_TICKS&&bFrames.length===TOTAL_TICKS,`${label} Twin frame count mismatch.`);
  let maxPositionError=0,maxVelocityError=0;
  for(let i=0;i<TOTAL_TICKS;i++){
    const a=physicalView(aFrames[i]),b=physicalView(bFrames[i]);
    invariant(a.observationTick===b.observationTick,`${label} observation tick mismatch @${i}`);
    invariant(a.outcomeTick===b.outcomeTick,`${label} outcome tick mismatch @${i}`);
    invariant(a.playerControlMove.x===b.playerControlMove.x&&a.playerControlMove.y===b.playerControlMove.y,`${label} control mismatch @t${a.observationTick}`);
    maxPositionError=Math.max(maxPositionError,distance(a.playerPosition,b.playerPosition),distance(a.companionPosition,b.companionPosition),distance(a.companionOutcomePosition,b.companionOutcomePosition));
    maxVelocityError=Math.max(maxVelocityError,distance(a.companionActualVelocity,b.companionActualVelocity),distance(a.commandedVelocity,b.commandedVelocity),distance(a.companionRequestedVelocity,b.companionRequestedVelocity),distance(a.companionOutcomeVelocity,b.companionOutcomeVelocity));
    invariant(JSON.stringify(a.contacts)===JSON.stringify(b.contacts),`${label} contact mismatch @t${a.outcomeTick}`);
  }
  invariant(maxPositionError<=1e-9,`${label} research lens changed positions: ${maxPositionError}`);
  invariant(maxVelocityError<=1e-9,`${label} research lens changed velocities: ${maxVelocityError}`);
  return {maxPositionError,maxVelocityError};
}
function mirrorCompare(topFrames,bottomFrames){
  invariant(topFrames.length===bottomFrames.length,"PH-07 mirror frame count mismatch.");
  let maxPlayerPositionError=0,maxCompanionPositionError=0,maxCommandError=0,maxActualVelocityError=0,maxTargetError=0;
  let firstPhysicalDivergence=null,firstDecisionDivergence=null;
  const rows=[];
  for(let i=0;i<topFrames.length;i++){
    const t=physicalView(topFrames[i]),b=physicalView(bottomFrames[i]);
    const bp=mirrorPoint(b.playerPosition);
    const bc=mirrorPoint(b.companionPosition);
    const bcmd=mirrorVector(b.commandedVelocity);
    const bact=mirrorVector(b.companionActualVelocity);
    const bt=b.relationshipTarget?mirrorPoint(b.relationshipTarget):null;
    const playerErr=distance(t.playerPosition,bp);
    const companionErr=distance(t.companionPosition,bc);
    const commandErr=distance(t.commandedVelocity,bcmd);
    const actualErr=distance(t.companionActualVelocity,bact);
    const targetErr=t.relationshipTarget&&bt?distance(t.relationshipTarget,bt):null;
    maxPlayerPositionError=Math.max(maxPlayerPositionError,playerErr);
    maxCompanionPositionError=Math.max(maxCompanionPositionError,companionErr);
    maxCommandError=Math.max(maxCommandError,commandErr);
    maxActualVelocityError=Math.max(maxActualVelocityError,actualErr);
    if(targetErr!==null) maxTargetError=Math.max(maxTargetError,targetErr);
    if(firstPhysicalDivergence===null&&(companionErr>1e-5||commandErr>1e-5||actualErr>1e-5)){
      firstPhysicalDivergence={tick:t.observationTick,companionPositionError:companionErr,commandError:commandErr,actualVelocityError:actualErr};
    }
    const decisionMismatch =
      t.routeStatus!==b.routeStatus ||
      (targetErr!==null&&targetErr>1e-5);
    if(firstDecisionDivergence===null&&decisionMismatch){
      firstDecisionDivergence={
        tick:t.observationTick,
        topRouteStatus:t.routeStatus,bottomRouteStatus:b.routeStatus,
        topRoutePath:t.routePath,bottomRoutePath:b.routePath,
        topRelationshipLabel:t.relationshipLabel,bottomRelationshipLabel:b.relationshipLabel,
        mirroredTargetError:targetErr
      };
    }
    rows.push({
      tick:t.observationTick,
      playerPositionError:playerErr,
      companionPositionError:companionErr,
      commandError,
      actualVelocityError:actualErr,
      mirroredTargetError:targetErr,
      topRouteStatus:t.routeStatus,
      bottomRouteStatus:b.routeStatus,
      topRoutePath:t.routePath,
      bottomRoutePath:b.routePath,
      topRelationshipLabel:t.relationshipLabel,
      bottomRelationshipLabel:b.relationshipLabel
    });
  }
  return {maxPlayerPositionError,maxCompanionPositionError,maxCommandError,maxActualVelocityError,maxTargetError,firstPhysicalDivergence,firstDecisionDivergence,rows};
}

async function run({browser,side,research}){
  const dir=`${ROOT}/${side}/${research?"research":"participant"}`;
  await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const errors={page:[],console:[],requests:[]};
  page.on("pageerror",e=>errors.page.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.console.push(m.text());});
  page.on("requestfailed",r=>errors.requests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText??"failed"}`));
  await page.goto(research?"http://127.0.0.1:4173/?a1debug=1":"http://127.0.0.1:4173/",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#game-root canvas").waitFor({state:"visible",timeout:15000});
  if(research) await page.waitForFunction(()=>window.__authorityA11fBrowserBridge?.enabled===true,null,{timeout:10000});
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page,t=>t.includes("PAUSED"),10000,`PH-07 ${side} pause`);
  await page.locator('[data-action="scenario-pillar"]').click();
  await waitForPanel(page,t=>t.includes("scenario Central pillar")&&t.includes("PAUSED")&&t.includes("mode SPATIAL")&&t.includes("actuator NATURAL")&&t.includes("A1 OFF")&&panelTick(t)===0,15000,`PH-07 ${side} reset`);
  if(research){
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(page,t=>t.includes("A1 DIRECT")&&t.includes("PAUSED"),10000,`PH-07 ${side} A1 pass-through`);
  }
  const manifest=[];let imageIndex=0,tick=0;
  manifest.push(await captureCanvas(page,dir,imageIndex++,0,"initial"));
  for(const beat of STORIES[side]){
    await setKeys(page,beat.keys);
    for(let i=0;i<beat.steps;i++){
      await singleStep(page,tick);tick+=1;
      if(tick%SCREENSHOT_EVERY===0||i===beat.steps-1) manifest.push(await captureCanvas(page,dir,imageIndex++,tick,beat.id));
    }
  }
  await setKeys(page,[]);
  invariant(tick===TOTAL_TICKS,`PH-07 ${side} story tick mismatch.`);
  const incident=await captureIncident(page,`${dir}/incident.json`);
  invariant(incident.schema==="companion-brain-lab-owner-sandbox-incident-v1",`PH-07 ${side} incident schema mismatch.`);
  invariant(incident.capture.scenario==="pillar",`PH-07 ${side} scenario mismatch.`);
  invariant(incident.capture.mode==="spatial"&&incident.capture.actuator==="natural",`PH-07 ${side} baseline mode/actuator mismatch.`);
  invariant(incident.capture.a1Variant===(research?"direct":"off"),`PH-07 ${side} A1 variant mismatch.`);
  invariant(incident.capture.tick===TOTAL_TICKS&&incident.frames.length===TOTAL_TICKS,`PH-07 ${side} incident window mismatch.`);
  if(process.env.GITHUB_SHA){
    invariant(incident.build.sourceSha===process.env.GITHUB_SHA,`PH-07 ${side} source SHA mismatch.`);
    invariant(incident.build.state==="PINNED_SOURCE_SHA",`PH-07 ${side} build not pinned.`);
  }
  let a11f=null;
  if(research){
    a11f=await page.evaluate(()=>window.__authorityA11fBrowserBridge?.snapshot()??null);
    invariant(a11f?.authority==="PASS_THROUGH_ONLY",`PH-07 ${side} A1 authority changed.`);
    invariant(a11f.lastBridgeError===null,`PH-07 ${side} A1 bridge error.`);
    invariant(a11f.frameCount===TOTAL_TICKS,`PH-07 ${side} expected ${TOTAL_TICKS} A1 frames.`);
    invariant(a11f.frames.every(f=>JSON.stringify(f.baselineCompanionIntent)===JSON.stringify(f.selectedCompanionIntent)),`PH-07 ${side} A1 lens changed live intent.`);
    await writeFile(`${dir}/a1-1f.json`,JSON.stringify(a11f,null,2));
  }
  invariant(await page.locator("#runtime-fault-sentinel").count()===0,`PH-07 ${side} runtime fault sentinel visible.`);
  invariant(errors.page.length===0&&errors.console.length===0&&errors.requests.length===0,`PH-07 ${side} browser errors: ${JSON.stringify(errors)}`);
  await writeFile(`${dir}/manifest.json`,JSON.stringify({side,research,story:STORIES[side],frames:manifest},null,2));
  await context.close();
  return {incident,manifest,a11f,errors};
}

const server=await preview({logLevel:"error",preview:{host:"127.0.0.1",port:4173,strictPort:true}});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const topParticipant=await run({browser,side:"top",research:false});
  const bottomParticipant=await run({browser,side:"bottom",research:false});
  const topResearch=await run({browser,side:"top",research:true});
  const bottomResearch=await run({browser,side:"bottom",research:true});
  const topTwin=compareTwin(topParticipant.incident.frames,topResearch.incident.frames,"top");
  const bottomTwin=compareTwin(bottomParticipant.incident.frames,bottomResearch.incident.frames,"bottom");
  const mirror=mirrorCompare(topParticipant.incident.frames,bottomParticipant.incident.frames);
  await writeFile(`${ROOT}/mirror-comparison.json`,JSON.stringify(mirror,null,2));
  const summary={
    schema:"companion-brain-lab-os-prep3-ph07-pillar-mirror-v1",
    sourceSha:process.env.GITHUB_SHA??null,
    browser:browser.version(),
    authority:{gameplay:"BASELINE_SPATIAL_NATURAL",a1ResearchTwin:"PASS_THROUGH_ONLY",p2:"NOT_ENABLED",sidePreferenceClaim:"NONE"},
    stories:STORIES,
    participant:{topImages:topParticipant.manifest.length,bottomImages:bottomParticipant.manifest.length},
    research:{topA11fFrames:topResearch.a11f.frameCount,bottomA11fFrames:bottomResearch.a11f.frameCount},
    twinNonInterference:{top:topTwin,bottom:bottomTwin},
    mirror:{
      maxPlayerPositionError:mirror.maxPlayerPositionError,
      maxCompanionPositionError:mirror.maxCompanionPositionError,
      maxCommandError:mirror.maxCommandError,
      maxActualVelocityError:mirror.maxActualVelocityError,
      maxTargetError:mirror.maxTargetError,
      firstPhysicalDivergence:mirror.firstPhysicalDivergence,
      firstDecisionDivergence:mirror.firstDecisionDivergence
    },
    interpretationStatus:"UNREAD_PARTICIPANT_FIRST_REQUIRED",
    errors:{topParticipant:topParticipant.errors,bottomParticipant:bottomParticipant.errors,topResearch:topResearch.errors,bottomResearch:bottomResearch.errors}
  };
  await writeFile(`${ROOT}/summary.json`,JSON.stringify(summary,null,2));
  console.log(`[OS_PREP3_PH07_PILLAR_MIRROR] ${JSON.stringify(summary)}`);
}finally{
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
