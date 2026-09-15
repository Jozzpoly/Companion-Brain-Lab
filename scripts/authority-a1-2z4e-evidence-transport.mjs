import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const marker = "[AUTHORITY_A1_2Z4D_CLASS_SUPPORT] ";
const outputPath = "artifacts/a1-2z4d-class-support.json";

const child = spawn(
  process.execPath,
  ["scripts/authority-a1-2z4d-class-support-browser-trace.mjs"],
  {
    env: process.env,
    stdio: ["inherit", "pipe", "inherit"]
  }
);

child.stdout.setEncoding("utf8");
let stdout = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk;
  process.stdout.write(chunk);
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});

if (exitCode !== 0) {
  throw new Error(`A1.2z4d source trace exited with code ${exitCode}.`);
}

const markerLine = stdout
  .split(/\r?\n/)
  .find((line) => line.startsWith(marker));

if (!markerLine) {
  throw new Error("A1.2z4d source trace completed without its canonical class-support marker.");
}

const evidence = JSON.parse(markerLine.slice(marker.length));
if (evidence.schema !== "companion-brain-lab-authority-a1-2z4d-class-support-v1") {
  throw new Error(`Unexpected A1.2z4d evidence schema: ${evidence.schema}`);
}

await mkdir("artifacts", { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`[AUTHORITY_A1_2Z4E_EVIDENCE_TRANSPORT] ${outputPath}`);
