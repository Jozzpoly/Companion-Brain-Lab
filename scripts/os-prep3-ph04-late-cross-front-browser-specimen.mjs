import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep3-ph04-late-cross-front";
const PARTICIPANT_DIR = `${ARTIFACT_DIR}/participant`;
const RESEARCH_DIR = `${ARTIFACT_DIR}/research`;
const STEP_SECONDS = 1 / 60;
const PLAYER_SPEED = 3;
const STEP_PROGRESS = STEP_SECONDS * PLAYER_SPEED;
const SCREENSHOT_EVERY = 6;
const STORY = [
  { id: "establish-plus-x", keys: ["d"], steps: 36 },
  { id: "late-cross-front", keys: ["d", "w"], steps: 36 },
  { id: "resume-plus-x", keys: ["d"], steps: 48 }
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
  invariant(await currentTick(page)===expected,`PH-04 B1 tick drift before t${expected}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(page,text=>panelTick(text)===expected+1,15000,`PH-04 B1 t${expected}->${expected+1}`);
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
  invariant(p,"PH-04 B1 incident download produced no path.");
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
    contacts:frame.outcome.companionContacts
  };
}
function compareTwins(aFrames,bFrames){
  invariant(aFrames.length===TOTAL_TICKS&&bFrames.length===TOTAL_TICKS,"PH-04 B1 Twin frame count mismatch.");
  let maxPositionError=0,maxVelocityError=0;
  for(let i=0;i<TOTAL_TICKS;i++){
    const a=physicalView(aFrames[i]),b=physicalView(bFrames[i]);
    invariant(a.observationTick===b.observationTick,`PH-04 B1 observation mismatch @${i}`);
    invariant(a.outcomeTick===b.outcomeTick,`PH-04 B1 outcome mismatch @${i}`);
    invariant(a.playerControlMove.x===b.playerControlMove.x&&a.playerControlMove.y===b.playerControlMove.y,`PH-04 B1 control mismatch @t${a.observationTick}`);
    maxPositionError=Math.max(maxPositionError,distance(a.playerPosition,b.playerPosition),distance(a.companionPosition,b.companionPosition),distance(a.outcomePosition,b.outcomePosition));
    maxVelocityError=Math.max(maxVelocityError,distance(a.companionActualVelocity,b.companionActualVelocity),distance(a.command,b.command),distance(a.requested,b.requested),distance(a.actual,b.actual));
    invariant(JSON.stringify(a.contacts)===JSON.stringify(b.contacts),`PH-04 B1 contact mismatch @t${a.outcomeTick}`);
  }
  invariant(maxPositionError<=1e-9,`PH-04 B1 research lens changed position: ${maxPositionError}`);
  invariant(maxVelocityError<=1e-9,`PH-04 B1 research lens changed velocity: ${maxVelocityError}`);
  return {maxPositionError,maxVelocityError};
}
function beatForTick(tick){
  let cursor=0;
  for(const beat of STORY){
    if(tick>=cursor&&tick<cursor+beat.steps) return beat.id;
    cursor+=beat.steps;
  }
  return "after-story";
}
function hasPlayerContact(frame){
  return frame.observation.companionContacts.includes("player")||frame.outcome.companionContacts.includes("player");
}
function summarize(frames){
  let requestedProgress=0,actualProgress=0,lateralMagnitudeSum=0,backwardTicks=0,stalledTicks=0;
  const steps=[];
  const ideal={...frames[0].observation.playerPosition};
  let idealPosition={...ideal};
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i].observation,b=frames[i+1].observation;
    const dir=normalized(a.playerControlMove);
    const delta={x:b.playerPosition.x-a.playerPosition.x,y:b.playerPosition.y-a.playerPosition.y};
    const forward=dot(delta,dir);
    const tangent={x:-dir.y,y:dir.x};
    const lateral=Math.abs(dot(delta,tangent));
    const expected=magnitude(dir)>0.5?STEP_PROGRESS:0;
    requestedProgress+=expected;
    actualProgress+=forward;
    lateralMagnitudeSum+=lateral;
    if(forward < -1e-5) backwardTicks+=1;
    if(expected>0 && forward < expected*0.2) stalledTicks+=1;
    idealPosition={x:idealPosition.x+dir.x*expected,y:idealPosition.y+dir.y*expected};
    steps.push({tick:a.worldTick,beat:beatForTick(a.worldTick),control:a.playerControlMove,forward,lateral,expected,deficit:Math.max(0,expected-forward)});
  }
  const last=frames.at(-1).observation.playerPosition;
  const terminalError={x:last.x-idealPosition.x,y:last.y-idealPosition.y};
  const contacts=frames.filter(hasPlayerContact).map(f=>f.observation.worldTick);
  const crossSteps=steps.filter(s=>s.beat==="late-cross-front");
  const shadows=frames.map(f=>f.decision.shadowCoordination).filter(Boolean);
  const sameTickShadows=shadows.filter(s=>s.ageTicks===0);
  const conflictSamples=sameTickShadows.filter(s=>s.authoritativeFlowConflictState!=="CLEAR"||s.preferredFlowConflictState!=="CLEAR");
  const separations=frames.map(f=>({
    tick:f.observation.worldTick,
    value:distance(f.observation.playerPosition,f.observation.companionPosition)
  }));
  const closest=separations.reduce((a,b)=>b.value<a.value?b:a,separations[0]);
  return {
    requestedProgress,actualProgress,
    progressDeficit:requestedProgress-actualProgress,
    progressFraction:requestedProgress>0?actualProgress/requestedProgress:null,
    integratedLateralMagnitude:lateralMagnitudeSum,
    terminalIdealPosition:idealPosition,
    terminalObservedPosition:last,
    terminalPositionError:terminalError,
    backwardTicks,stalledTicks,
    contactTickCount:contacts.length,
    firstContactTick:contacts[0]??null,
    lastContactTick:contacts.at(-1)??null,
    closestSeparation:closest,
    crossEpisode:{
      requestedProgress:crossSteps.reduce((s,v)=>s+v.expected,0),
      actualProgress:crossSteps.reduce((s,v)=>s+v.forward,0),
      progressDeficit:crossSteps.reduce((s,v)=>s+v.deficit,0),
      integratedLateralMagnitude:crossSteps.reduce((s,v)=>s+v.lateral,0)
    },
    sameTickFlowSamples:sameTickShadows.map(s=>({
      shadowTick:s.shadowTick,
      preferred:s.preferredFlowConflictState,
      authoritative:s.authoritativeFlowConflictState,
      authoritativePhysicalClearance:s.authoritativeFlowPhysicalClearance,
      authoritativeComfortClearance:s.authoritativeFlowComfortClearance
    })),
    firstFlowConflict:conflictSamples[0]?{
      shadowTick:conflictSamples[0].shadowTick,
      preferred:conflictSamples[0].preferredFlowConflictState,
      authoritative:conflictSamples[0].authoritativeFlowConflictState,
      authoritativePhysicalClearance:conflictSamples[0].authoritativeFlowPhysicalClearance,
      authoritativeComfortClearance:conflictSamples[0].authoritativeFlowComfortClearance
    }:null,
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
  await waitForPanel(page,t=>t.includes("PAUSED"),10000,"PH-04 B1 pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page,t=>t.includes("scenario Head-on contact")&&t.includes("PAUSED")&&t.includes("mode SPATIAL")&&t.includes("actuator NATURAL")&&t.includes("A1 OFF")&&panelTick(t)===0,15000,"PH-04 B1 reset");
  if(research){
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(page,t=>t.includes("A1 DIRECT")&&t.includes("PAUSED"),10000,"PH-04 B1 A1 pass-through");
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
  invariant(tick===TOTAL_TICKS,"PH-04 B1 story tick mismatch.");
  const incident=await captureIncident(page,`${dir}/incident.json`);
  invariant(incident.schema==="companion-brain-lab-owner-sandbox-incident-v1","PH-04 B1 incident schema mismatch.");
  invariant(incident.capture.scenario==="head-on","PH-04 B1 scenario mismatch.");
  invariant(incident.capture.mode==="spatial"&&incident.capture.actuator==="natural","PH-04 B1 baseline mode/actuator mismatch.");
  invariant(incident.capture.a1Variant===(research?"direct":"off"),"PH-04 B1 A1 variant mismatch.");
  invariant(incident.capture.tick===TOTAL_TICKS&&incident.frames.length===TOTAL_TICKS,"PH-04 B1 incident window mismatch.");
  if(process.env.GITHUB_SHA){
    invariant(incident.build.sourceSha===process.env.GITHUB_SHA,"PH-04 B1 source SHA mismatch.");
    invariant(incident.build.state==="PINNED_SOURCE_SHA","PH-04 B1 build not pinned.");
  }
  let a11f=null;
  if(research){
    a11f=await page.evaluate(()=>window.__authorityA11fBrowserBridge?.snapshot()??null);
    invariant(a11f?.authority==="PASS_THROUGH_ONLY","PH-04 B1 A1 authority changed.");
    invariant(a11f.lastBridgeError===null,"PH-04 B1 A1 bridge error.");
    invariant(a11f.frameCount===TOTAL_TICKS,`PH-04 B1 expected ${TOTAL_TICKS} A1 frames.`);
    invariant(a11f.frames.every(f=>JSON.stringify(f.baselineCompanionIntent)===JSON.stringify(f.selectedCompanionIntent)),"PH-04 B1 A1 lens changed live intent.");
    await writeFile(`${dir}/a1-1f.json`,JSON.stringify(a11f,null,2));
  }
  invariant(await page.locator("#runtime-fault-sentinel").count()===0,"PH-04 B1 runtime fault sentinel visible.");
  invariant(errors.page.length===0&&errors.console.length===0&&errors.requests.length===0,`PH-04 B1 browser errors: ${JSON.stringify(errors)}`);
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
    schema:"companion-brain-lab-os-prep3-ph04-late-cross-front-v1",
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
  console.log(`[OS_PREP3_PH04_LATE_CROSS_FRONT] ${JSON.stringify(summary)}`);
}finally{
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
