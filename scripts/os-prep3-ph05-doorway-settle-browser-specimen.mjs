import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep3-ph05-doorway-settle";
const PARTICIPANT_DIR = `${ARTIFACT_DIR}/participant`;
const RESEARCH_DIR = `${ARTIFACT_DIR}/research`;
const STEP_SECONDS = 1 / 60;
const PLAYER_SPEED = 3;
const STEP_PROGRESS = STEP_SECONDS * PLAYER_SPEED;
const SCREENSHOT_EVERY = 12;
const INCIDENT_WINDOW = 240;
const EXPECTED_INCIDENT_START_TICK = 120;
const STORY = [
  { id: "outbound-plus-x", keys: ["d"], steps: 120 },
  { id: "immediate-return-minus-x", keys: ["a"], steps: 120 },
  { id: "settle-neutral", keys: [], steps: 120 }
];
const TOTAL_TICKS = STORY.reduce((sum, beat) => sum + beat.steps, 0);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
function distance(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function magnitude(v){ return Math.hypot(v.x,v.y); }
function normalized(v){ const m=magnitude(v); return m>1e-12?{x:v.x/m,y:v.y/m}:{x:0,y:0}; }
function dot(a,b){ return a.x*b.x+a.y*b.y; }
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
  invariant(await currentTick(page)===expected,`PH-05 M1 tick drift before t${expected}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(page,text=>panelTick(text)===expected+1,15000,`PH-05 M1 t${expected}->${expected+1}`);
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
  invariant(p,"PH-05 M1 incident download produced no path.");
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
    command:frame.command.commandedVelocity,
    outcomePosition:frame.outcome.companionPosition,
    requested:frame.outcome.companionRequestedVelocity,
    actual:frame.outcome.companionActualVelocity,
    contacts:frame.outcome.companionContacts,
    postState:frame.post.state,
    routeStatus:frame.decision.routeStatus,
    routePath:frame.decision.routePath
  };
}
function compareTwins(aFrames,bFrames){
  invariant(aFrames.length===INCIDENT_WINDOW&&bFrames.length===INCIDENT_WINDOW,"PH-05 M1 Twin frame count mismatch.");
  let maxPositionError=0,maxVelocityError=0;
  for(let i=0;i<INCIDENT_WINDOW;i++){
    const a=physicalView(aFrames[i]),b=physicalView(bFrames[i]);
    invariant(a.observationTick===b.observationTick,`PH-05 M1 observation mismatch @${i}`);
    invariant(a.outcomeTick===b.outcomeTick,`PH-05 M1 outcome mismatch @${i}`);
    invariant(a.playerControlMove.x===b.playerControlMove.x&&a.playerControlMove.y===b.playerControlMove.y,`PH-05 M1 control mismatch @t${a.observationTick}`);
    maxPositionError=Math.max(maxPositionError,distance(a.playerPosition,b.playerPosition),distance(a.companionPosition,b.companionPosition),distance(a.outcomePosition,b.outcomePosition));
    maxVelocityError=Math.max(maxVelocityError,distance(a.companionActualVelocity,b.companionActualVelocity),distance(a.command,b.command),distance(a.requested,b.requested),distance(a.actual,b.actual));
    invariant(JSON.stringify(a.contacts)===JSON.stringify(b.contacts),`PH-05 M1 contacts differ @t${a.outcomeTick}`);
    invariant(a.postState===b.postState,`PH-05 M1 post-state mismatch @t${a.outcomeTick}`);
    invariant(a.routeStatus===b.routeStatus&&a.routePath===b.routePath,`PH-05 M1 route mismatch @t${a.observationTick}`);
  }
  invariant(maxPositionError<=1e-9,`PH-05 M1 research lens changed position: ${maxPositionError}`);
  invariant(maxVelocityError<=1e-9,`PH-05 M1 research lens changed velocity: ${maxVelocityError}`);
  return {maxPositionError,maxVelocityError};
}
function beatForTick(tick){
  if(tick<120) return "outbound-plus-x";
  if(tick<240) return "immediate-return-minus-x";
  return "settle-neutral";
}
function hasPlayerContact(frame){
  return frame.observation.companionContacts.includes("player")||frame.outcome.companionContacts.includes("player");
}
function countBy(values){
  const out={};
  for(const v of values) out[String(v??"null")]=(out[String(v??"null")]??0)+1;
  return out;
}
function summarize(frames){
  const contacts=frames.filter(hasPlayerContact).map(f=>f.observation.worldTick);
  const returnFrames=frames.filter(f=>f.observation.worldTick<240);
  const settleFrames=frames.filter(f=>f.observation.worldTick>=240);
  let requestedProgress=0,actualProgress=0,backwardTicks=0,stalledTicks=0;
  const steps=[];
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i].observation,b=frames[i+1].observation;
    const dir=normalized(a.playerControlMove);
    const delta={x:b.playerPosition.x-a.playerPosition.x,y:b.playerPosition.y-a.playerPosition.y};
    const forward=dot(delta,dir);
    const expected=magnitude(dir)>0.5?STEP_PROGRESS:0;
    requestedProgress+=expected;
    actualProgress+=forward;
    if(expected>0&&forward<-1e-5) backwardTicks+=1;
    if(expected>0&&forward<expected*0.2) stalledTicks+=1;
    steps.push({tick:a.worldTick,beat:beatForTick(a.worldTick),forward,expected,deficit:Math.max(0,expected-forward)});
  }

  let companionDoorwayReturnTick=null;
  for(const frame of settleFrames){
    const p=frame.observation.companionPosition;
    if(p.x<=5.6 && p.y>=3.3 && p.y<=4.7){
      companionDoorwayReturnTick=frame.observation.worldTick;
      break;
    }
  }

  let settledTick=null;
  for(let i=0;i<=settleFrames.length-6;i++){
    const window=settleFrames.slice(i,i+6);
    if(window.every(f=>magnitude(f.observation.companionActualVelocity)<0.15)){
      settledTick=window[0].observation.worldTick;
      break;
    }
  }

  let routePathChanges=0;
  const routeChangeTicks=[];
  let previousRoutePath=frames[0].decision.routePath;
  for(const frame of frames.slice(1)){
    if(frame.decision.routePath!==previousRoutePath){
      routePathChanges+=1;
      routeChangeTicks.push({tick:frame.observation.worldTick,from:previousRoutePath,to:frame.decision.routePath});
      previousRoutePath=frame.decision.routePath;
    }
  }

  const first=frames[0].observation;
  const last=frames.at(-1).observation;
  const settleStart=settleFrames[0]?.observation??null;
  const settleEnd=settleFrames.at(-1)?.observation??null;
  const finalSeparation=distance(last.playerPosition,last.companionPosition);
  const settleTravel=settleFrames.length>1?settleFrames.slice(1).reduce((sum,f,i)=>sum+distance(settleFrames[i].observation.companionPosition,f.observation.companionPosition),0):0;

  return {
    incidentWindow:{
      firstTick:first.worldTick,
      lastTick:last.worldTick,
      expectedFirstTick:EXPECTED_INCIDENT_START_TICK
    },
    returnPhase:{
      frameCount:returnFrames.length,
      requestedProgress,
      actualProgress,
      progressDeficit:requestedProgress-actualProgress,
      progressFraction:requestedProgress>0?actualProgress/requestedProgress:null,
      backwardTicks,
      stalledTicks
    },
    settlePhase:{
      frameCount:settleFrames.length,
      playerPositionStart:settleStart?.playerPosition??null,
      playerPositionEnd:settleEnd?.playerPosition??null,
      companionPositionStart:settleStart?.companionPosition??null,
      companionPositionEnd:settleEnd?.companionPosition??null,
      companionDoorwayReturnTick,
      settledTick,
      companionTravel:settleTravel,
      finalCompanionSpeed:magnitude(last.companionActualVelocity),
      finalSeparation
    },
    contactTickCount:contacts.length,
    firstContactTick:contacts[0]??null,
    lastContactTick:contacts.at(-1)??null,
    routePathChanges,
    routeChangeTicks,
    routeStatusCounts:countBy(frames.map(f=>f.decision.routeStatus)),
    postStateCounts:countBy(frames.map(f=>f.post.state)),
    postActionCounts:countBy(frames.map(f=>f.post.action??"NONE")),
    spatialStateCounts:countBy(frames.map(f=>f.decision.spatialState)),
    relationshipLabelCounts:countBy(frames.map(f=>f.decision.relationshipLabel)),
    steps
  };
}
async function runTwin({browser,research}){
  const dir=research?RESEARCH_DIR:PARTICIPANT_DIR;
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
  await waitForPanel(page,t=>t.includes("PAUSED"),10000,"PH-05 M1 pause");
  await page.locator('[data-action="scenario-doorway"]').click();
  await waitForPanel(page,t=>t.includes("scenario Narrow doorway")&&t.includes("PAUSED")&&t.includes("mode SPATIAL")&&t.includes("actuator NATURAL")&&t.includes("A1 OFF")&&panelTick(t)===0,15000,"PH-05 M1 doorway reset");
  if(research){
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(page,t=>t.includes("A1 DIRECT")&&t.includes("PAUSED"),10000,"PH-05 M1 A1 pass-through");
  }

  const manifest=[];let imageIndex=0,tick=0;
  manifest.push(await captureCanvas(page,dir,imageIndex++,0,"initial"));
  for(const beat of STORY){
    await setKeys(page,beat.keys);
    for(let i=0;i<beat.steps;i++){
      await singleStep(page,tick); tick+=1;
      if(tick%SCREENSHOT_EVERY===0||i===beat.steps-1) manifest.push(await captureCanvas(page,dir,imageIndex++,tick,beat.id));
    }
  }
  await setKeys(page,[]);
  invariant(tick===TOTAL_TICKS,"PH-05 M1 story tick mismatch.");
  const incident=await captureIncident(page,`${dir}/incident.json`);
  invariant(incident.schema==="companion-brain-lab-owner-sandbox-incident-v1","PH-05 M1 incident schema mismatch.");
  invariant(incident.capture.scenario==="doorway","PH-05 M1 scenario mismatch.");
  invariant(incident.capture.mode==="spatial"&&incident.capture.actuator==="natural","PH-05 M1 baseline mode/actuator mismatch.");
  invariant(incident.capture.a1Variant===(research?"direct":"off"),"PH-05 M1 A1 variant mismatch.");
  invariant(incident.capture.tick===TOTAL_TICKS,"PH-05 M1 capture tick mismatch.");
  invariant(incident.frames.length===INCIDENT_WINDOW,`PH-05 M1 expected ${INCIDENT_WINDOW} incident frames, got ${incident.frames.length}.`);
  invariant(incident.frames[0]?.observation.worldTick===EXPECTED_INCIDENT_START_TICK,`PH-05 M1 incident should begin at t${EXPECTED_INCIDENT_START_TICK}.`);
  invariant(incident.frames.at(-1)?.observation.worldTick===TOTAL_TICKS-1,"PH-05 M1 incident final tick mismatch.");
  if(process.env.GITHUB_SHA){
    invariant(incident.build.sourceSha===process.env.GITHUB_SHA,"PH-05 M1 source SHA mismatch.");
    invariant(incident.build.state==="PINNED_SOURCE_SHA","PH-05 M1 build not pinned.");
  }
  let a11f=null;
  if(research){
    a11f=await page.evaluate(()=>window.__authorityA11fBrowserBridge?.snapshot()??null);
    invariant(a11f?.authority==="PASS_THROUGH_ONLY","PH-05 M1 A1 authority changed.");
    invariant(a11f.lastBridgeError===null,"PH-05 M1 A1 bridge error.");
    invariant(a11f.frameCount===TOTAL_TICKS,`PH-05 M1 expected ${TOTAL_TICKS} A1 frames.`);
    invariant(a11f.frames.every(f=>JSON.stringify(f.baselineCompanionIntent)===JSON.stringify(f.selectedCompanionIntent)),"PH-05 M1 A1 lens changed live intent.");
    await writeFile(`${dir}/a1-1f.json`,JSON.stringify(a11f,null,2));
  }
  invariant(await page.locator("#runtime-fault-sentinel").count()===0,"PH-05 M1 runtime fault sentinel visible.");
  invariant(errors.page.length===0&&errors.console.length===0&&errors.requests.length===0,`PH-05 M1 browser errors: ${JSON.stringify(errors)}`);
  await writeFile(`${dir}/manifest.json`,JSON.stringify({research,story:STORY,stepSeconds:STEP_SECONDS,playerSpeed:PLAYER_SPEED,frames:manifest},null,2));
  await context.close();
  return {incident,manifest,a11f,errors};
}

const server=await preview({logLevel:"error",preview:{host:"127.0.0.1",port:4173,strictPort:true}});
let browser;
try{
  await mkdir(PARTICIPANT_DIR,{recursive:true});await mkdir(RESEARCH_DIR,{recursive:true});
  browser=await chromium.launch({headless:true});
  const participant=await runTwin({browser,research:false});
  const research=await runTwin({browser,research:true});
  const twinNonInterference=compareTwins(participant.incident.frames,research.incident.frames);
  const behavior=summarize(participant.incident.frames);
  const summary={
    schema:"companion-brain-lab-os-prep3-ph05-doorway-settle-v1",
    sourceSha:process.env.GITHUB_SHA??null,
    browser:browser.version(),
    authority:{gameplay:"BASELINE_SPATIAL_NATURAL",a1ResearchTwin:"PASS_THROUGH_ONLY",p2:"NOT_ENABLED",rightOfWayPolicyClaim:"NONE",yieldPolicyClaim:"NONE",priorityClaim:"NONE"},
    story:STORY,
    participant:{imageCount:participant.manifest.length,frameCount:participant.incident.frames.length,build:participant.incident.build},
    research:{imageCount:research.manifest.length,frameCount:research.incident.frames.length,a11fFrameCount:research.a11f.frameCount,a11fAuthority:research.a11f.authority,build:research.incident.build},
    twinNonInterference,
    behavior,
    interpretationStatus:"UNREAD_PARTICIPANT_FIRST_REQUIRED",
    errors:{participant:participant.errors,research:research.errors}
  };
  await writeFile(`${ARTIFACT_DIR}/summary.json`,JSON.stringify(summary,null,2));
  console.log(`[OS_PREP3_PH05_DOORWAY_REVERSAL] ${JSON.stringify(summary)}`);
}finally{
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
