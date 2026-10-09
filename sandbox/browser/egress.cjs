const http = require("node:http");
const net = require("node:net");
const dns = require("node:dns/promises");

const PROXY_PORT = Number(process.env.SEEDLING_BROWSER_PROXY_PORT || 9223);

function blockedV4(ip) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function expandV6(ip) {
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const last = right.length ? right[right.length - 1] : left[left.length - 1];
  const extra = [];
  if (last && last.includes(".")) {
    const parts = last.split(".").map(Number);
    extra.push(((parts[0] << 8) | parts[1]).toString(16), ((parts[2] << 8) | parts[3]).toString(16));
    if (right.length) right.pop();
    else left.pop();
  }
  const filled = ip.includes("::") ? 8 - left.length - right.length - extra.length : 0;
  return [...left, ...Array(Math.max(0, filled)).fill("0"), ...right, ...extra].map((g) => parseInt(g || "0", 16));
}

function isBlockedAddress(ip) {
  if (net.isIPv4(ip)) return blockedV4(ip);
  if (!net.isIPv6(ip)) return true;
  const g = expandV6(ip);
  if (g.length !== 8) return true;
  const embedded = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return g[5] === 0 && g[6] === 0 ? true : blockedV4(embedded);
  if (g[0] === 0x64 && g[1] === 0xff9b) return blockedV4(embedded);
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  if ((g[0] & 0xff00) === 0xff00) return true;
  if (g[0] === 0x2002) return blockedV4(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`);
  return false;
}

async function resolvePublic(host) {
  const name = host.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(name) ? [{ address: name }] : await dns.lookup(name, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) return null;
  return addresses[0].address;
}

function refuse(res, host) {
  res.writeHead(403, { "content-type": "text/plain; charset=utf-8", connection: "close" });
  res.end(`Seedling: ${host} is not reachable from the agent's browser. It can open localhost and the public internet.`);
}

function startEgressProxy(port = PROXY_PORT) {
  const server = http.createServer(async (req, res) => {
    let target;
    try {
      target = new URL(req.url);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (target.protocol !== "http:") {
      res.writeHead(400).end();
      return;
    }
    const address = await resolvePublic(target.hostname).catch(() => null);
    if (!address) return refuse(res, target.hostname);
    const headers = { ...req.headers };
    delete headers["proxy-connection"];
    delete headers["proxy-authorization"];
    const upstream = http.request({ host: address, port: Number(target.port || 80), method: req.method, path: `${target.pathname}${target.search}`, headers, setHost: false }, (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  server.on("connect", async (req, socket, head) => {
    socket.on("error", () => socket.destroy());
    const match = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(req.url || "");
    if (!match) return socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    const address = await resolvePublic(match[1]).catch(() => null);
    if (!address) return socket.end(`HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\n\r\nSeedling: ${match[1]} is not reachable from the agent's browser.`);
    const upstream = net.connect(Number(match[2]), address, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("close", () => upstream.destroy());
  });
  server.listen(port, "127.0.0.1");
  return server;
}

module.exports = { isBlockedAddress, startEgressProxy, PROXY_PORT };

if (require.main === module) {
  const server = startEgressProxy();
  server.on("error", (error) => process.exit(error.code === "EADDRINUSE" ? 0 : 1));
}
