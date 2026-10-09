const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { PROXY_PORT } = require("./egress.cjs");

const CDP_PORT = Number(process.env.SEEDLING_BROWSER_CDP_PORT || 9222);
const CHROMIUM = process.env.SEEDLING_CHROMIUM || "/usr/bin/chromium";
const STATE = "/tmp/seedling-browser";

function cdpReady() {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: CDP_PORT, path: "/json/version", timeout: 1000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function daemon(command, args) {
  const log = fs.openSync(path.join(STATE, `${path.basename(command)}.log`), "a");
  const child = spawn(command, args, { detached: true, stdio: ["ignore", log, log] });
  child.unref();
}

async function ensureBrowser() {
  if (await cdpReady()) return;
  fs.mkdirSync(path.join(STATE, "profile"), { recursive: true });
  daemon(process.execPath, [path.join(__dirname, "egress.cjs")]);
  daemon(CHROMIUM, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--disable-features=Translate,MediaRouter,OptimizationHints",
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    "--webrtc-ip-handling-policy=disable_non_proxied_udp",
    `--proxy-server=http://127.0.0.1:${PROXY_PORT}`,
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${path.join(STATE, "profile")}`,
    "--window-size=1280,800",
    "about:blank",
  ]);
  for (let i = 0; i < 100; i++) {
    if (await cdpReady()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("the sandbox browser did not start");
}

async function main() {
  fs.mkdirSync(STATE, { recursive: true });
  const mcp = spawn(
    "playwright-mcp",
    ["--cdp-endpoint", `http://127.0.0.1:${CDP_PORT}`, "--allow-unrestricted-file-access", "--output-dir", path.join(STATE, "output"), "--viewport-size", "1280x800", ...process.argv.slice(2)],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  let browser = null;
  let queue = Promise.resolve();
  let pending = "";
  const forward = (line) => {
    queue = queue.then(async () => {
      if (!browser && line.includes('"tools/call"')) browser = ensureBrowser().catch((error) => process.stderr.write(`[seedling-browser] ${error.message}\n`));
      if (browser) await browser;
      mcp.stdin.write(`${line}\n`);
    });
  };
  process.stdin.on("data", (chunk) => {
    pending += chunk.toString("utf8");
    let at = pending.indexOf("\n");
    while (at >= 0) {
      forward(pending.slice(0, at));
      pending = pending.slice(at + 1);
      at = pending.indexOf("\n");
    }
  });
  process.stdin.on("end", () => {
    if (pending) forward(pending);
    queue.then(() => mcp.stdin.end());
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => mcp.kill(signal));
  mcp.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  process.stderr.write(`[seedling-browser] ${error.message}\n`);
  process.exit(1);
});
