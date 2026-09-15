import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const sourceScript = "scripts/authority-a1-2z4f-tick0-early-live-class-map.mjs";
const outputPath = "artifacts/a1-2z4f-diagnostic.json";
const exitCodePath = "artifacts/a1-2z4f-exit-code.txt";
const tailLimit = 16_000;

const child = spawn(process.execPath, [sourceScript], {
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"]
});

let stdout = "";
let stderr = "";

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
  process.stderr.write(chunk);
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (code) => resolve(code ?? 1));
});

const diagnostic = {
  schema: "companion-brain-lab-authority-a1-2z4f-diagnostic-v1",
  sourceSha: process.env.GITHUB_SHA ?? null,
  sourceScript,
  exitCode,
  stdoutTail: stdout.slice(-tailLimit),
  stderrTail: stderr.slice(-tailLimit)
};

await mkdir("artifacts", { recursive: true });
await writeFile(outputPath, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8");
await writeFile(exitCodePath, `${exitCode}\n`, "utf8");
console.log(`[AUTHORITY_A1_2Z4F_DIAGNOSTIC_TRANSPORT] exit=${exitCode} path=${outputPath}`);
