export type RuntimeFaultSource = "window-error" | "unhandled-rejection" | "manual";

export interface RuntimeFaultRecord {
  schema: "companion-brain-lab-runtime-fault-v1";
  source: RuntimeFaultSource;
  timestamp: string;
  message: string;
  stack: string | null;
  filename: string | null;
  line: number | null;
  column: number | null;
}

function errorLike(value: unknown): { message: string; stack: string | null } {
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack ?? null };
  }
  if (typeof value === "string") return { message: value, stack: null };
  try {
    return { message: JSON.stringify(value), stack: null };
  } catch {
    return { message: String(value), stack: null };
  }
}

export function normalizeRuntimeFault(options: {
  source: RuntimeFaultSource;
  value: unknown;
  timestamp?: string;
  filename?: string | null;
  line?: number | null;
  column?: number | null;
}): RuntimeFaultRecord {
  const normalized = errorLike(options.value);
  return {
    schema: "companion-brain-lab-runtime-fault-v1",
    source: options.source,
    timestamp: options.timestamp ?? new Date().toISOString(),
    message: normalized.message || "Unknown runtime fault",
    stack: normalized.stack,
    filename: options.filename ?? null,
    line: options.line ?? null,
    column: options.column ?? null
  };
}

function downloadFault(record: RuntimeFaultRecord): void {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `companion-runtime-fault-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createFaultSurface(record: RuntimeFaultRecord): HTMLElement {
  const surface = document.createElement("section");
  surface.id = "runtime-fault-sentinel";
  surface.setAttribute("role", "alert");
  Object.assign(surface.style, {
    position: "fixed",
    inset: "12px 12px auto auto",
    width: "min(620px, calc(100vw - 24px))",
    maxHeight: "calc(100vh - 24px)",
    overflow: "auto",
    zIndex: "2147483647",
    padding: "14px",
    border: "2px solid #ff7b72",
    borderRadius: "8px",
    background: "#1f1113",
    color: "#f0f3f6",
    boxShadow: "0 12px 40px rgba(0,0,0,.55)",
    font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  });

  const heading = document.createElement("div");
  heading.textContent = "RUNTIME FAULT — SIMULATION FAIL-STOPPED";
  Object.assign(heading.style, { fontWeight: "800", color: "#ff7b72", marginBottom: "8px" });

  const summary = document.createElement("div");
  summary.textContent = `${record.source} · ${record.timestamp}`;
  Object.assign(summary.style, { color: "#c9d1d9", marginBottom: "8px" });

  const message = document.createElement("div");
  message.textContent = record.message;
  Object.assign(message.style, { whiteSpace: "pre-wrap", marginBottom: "8px" });

  const location = document.createElement("div");
  location.textContent = record.filename
    ? `${record.filename}${record.line !== null ? `:${record.line}` : ""}${record.column !== null ? `:${record.column}` : ""}`
    : "location unavailable";
  Object.assign(location.style, { color: "#8b949e", marginBottom: "8px" });

  const stack = document.createElement("pre");
  stack.textContent = record.stack ?? "stack unavailable";
  Object.assign(stack.style, {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    padding: "8px",
    margin: "0 0 10px",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: "6px"
  });

  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", gap: "8px", flexWrap: "wrap" });
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Download fault JSON";
  save.addEventListener("click", () => downloadFault(record));
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload workbench";
  reload.addEventListener("click", () => window.location.reload());
  for (const button of [save, reload]) {
    Object.assign(button.style, {
      padding: "7px 10px",
      border: "1px solid #6e7681",
      borderRadius: "6px",
      background: "#21262d",
      color: "#f0f3f6",
      cursor: "pointer"
    });
  }
  actions.append(save, reload);

  surface.append(heading, summary, message, location, stack, actions);
  return surface;
}

export function installRuntimeFaultSentinel(): (record: RuntimeFaultRecord) => void {
  let firstFault: RuntimeFaultRecord | null = null;

  const report = (record: RuntimeFaultRecord): void => {
    if (firstFault) return;
    firstFault = record;
    const existing = document.querySelector<HTMLElement>("#runtime-fault-sentinel");
    existing?.remove();
    document.body.appendChild(createFaultSurface(record));
  };

  window.addEventListener("error", (event) => {
    report(normalizeRuntimeFault({
      source: "window-error",
      value: event.error ?? event.message,
      filename: event.filename || null,
      line: event.lineno || null,
      column: event.colno || null
    }));
  });

  window.addEventListener("unhandledrejection", (event) => {
    report(normalizeRuntimeFault({
      source: "unhandled-rejection",
      value: event.reason
    }));
  });

  return report;
}
