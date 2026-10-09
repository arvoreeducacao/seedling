import "@/server/load-env";
import { createServer } from "node:http";
import next from "next";
import { attachTerminal } from "@/server/terminal";
import { handlePreview, handlePreviewUpgrade, isPreviewHost } from "@/server/preview";
import { env, previewListenPort } from "@/lib/env";
import { sweep } from "@/lib/sessions";
import { ready } from "@/lib/db";
import { blockedPath, crossSiteWriteBlocked, upgradeAllowed } from "@/server/origin";
import { announceBootstrap } from "@/lib/admin-invites";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3100);
const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

await ready();
await app.prepare();
const upgrade = app.getUpgradeHandler();

const server = createServer((req, res) => {
  if (isPreviewHost(req)) {
    void handlePreview(req, res);
    return;
  }
  const path = (req.url ?? "/").split("?")[0];
  if (blockedPath(path)) {
    res.writeHead(404).end();
    return;
  }
  const fetchSite = req.headers["sec-fetch-site"];
  if (crossSiteWriteBlocked({ method: req.method, path, origin: req.headers.origin, fetchSite: typeof fetchSite === "string" ? fetchSite : undefined, host: req.headers.host, appUrl: env.url })) {
    res.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: "cross-origin request refused" }));
    return;
  }
  void handle(req, res);
});
attachTerminal(server, isPreviewHost);
server.on("upgrade", (req, socket, head) => {
  if (isPreviewHost(req)) {
    void handlePreviewUpgrade(req, socket as import("node:net").Socket, head);
    return;
  }
  if (req.url?.startsWith("/ws/terminal")) return;
  if (!upgradeAllowed(req.headers.origin, req.headers.host, env.url)) {
    socket.end("HTTP/1.1 403 Forbidden\r\nconnection: close\r\n\r\n");
    return;
  }
  upgrade(req, socket, head);
});

const previewPort = previewListenPort(env.previewOrigin, port, process.env.SEEDLING_PREVIEW_PORT);
if (previewPort) {
  const previewServer = createServer((req, res) => void handlePreview(req, res));
  previewServer.on("upgrade", (req, socket, head) => void handlePreviewUpgrade(req, socket as import("node:net").Socket, head));
  previewServer.listen(previewPort, () => console.log(`[seedling] previews at ${env.previewOrigin}`));
} else if (!env.previewOrigin) {
  console.warn("[seedling] SEEDLING_PREVIEW_ORIGIN is not set: the in-workspace browser is off");
}

setInterval(() => {
  sweep().catch((error) => console.error("[seedling] sweep", error));
}, 15_000);

await announceBootstrap();

server.listen(port, () => {
  console.log(`[seedling] ready at http://localhost:${port}`);
});
