import path from "node:path";
import { Duplex, PassThrough, Writable } from "node:stream";
import Docker from "dockerode";
import { env } from "@/lib/env";
import { parseListening } from "@/lib/preview/ports";
import { SETUP_MOUNT } from "@/lib/setup/mount";
import type { RunResult, SandboxDriver, Shell, ShellOptions, StartOptions } from "./types";

const LABEL = "seedling.session";

const RELAY = `const net=require("net");const port=Number(process.argv[1]);const hosts=["127.0.0.1","::1"];let i=0;let up=false;function open(){const s=net.connect(port,hosts[i]);s.once("connect",()=>{up=true;process.stdin.pipe(s);s.pipe(process.stdout)});s.on("close",()=>{if(up)process.exit(0)});s.on("error",()=>{if(up)return;i++;if(i<hosts.length)open();else process.exit(3)})}open();`;

function socketLike(stream: Duplex) {
  let idle: ReturnType<typeof setTimeout> | undefined;
  let idleMs = 0;
  const arm = () => {
    if (idle) clearTimeout(idle);
    idle = idleMs > 0 ? setTimeout(() => stream.emit("timeout"), idleMs) : undefined;
  };
  stream.on("data", arm);
  stream.on("close", () => idle && clearTimeout(idle));
  return Object.assign(stream, {
    setKeepAlive: () => stream,
    setNoDelay: () => stream,
    setTimeout: (ms: number, callback?: () => void) => {
      idleMs = ms;
      if (callback) stream.once("timeout", callback);
      arm();
      return stream;
    },
    ref: () => stream,
    unref: () => stream,
    remoteAddress: "127.0.0.1",
  });
}

function hardening(memoryMb: number) {
  return {
    Memory: memoryMb * 1024 * 1024,
    MemorySwap: memoryMb * 1024 * 1024,
    NanoCpus: Math.round(env.sandbox.cpus * 1e9),
    PidsLimit: env.sandbox.pids,
    CapDrop: ["ALL"],
    SecurityOpt: ["no-new-privileges"],
    ReadonlyRootfs: true,
    Tmpfs: { "/tmp": "rw,nosuid,size=256m", "/home/candidate": "rw,nosuid,size=512m,uid=1000,gid=1000" },
    Runtime: process.env.SEEDLING_SANDBOX_RUNTIME || undefined,
    Ulimits: [{ Name: "nofile", Soft: 4096, Hard: 4096 }],
  };
}

function toHostPath(workspace: string) {
  const relative = path.relative(env.dataDir, workspace);
  return path.join(env.sandbox.hostDataDir, relative);
}

function demux(docker: Docker, stream: NodeJS.ReadableStream) {
  const out = new PassThrough();
  docker.modem.demuxStream(stream, out, out);
  stream.on("end", () => out.end());
  return out;
}

async function collect(stream: NodeJS.ReadableStream, timeoutMs: number, onTimeout: () => void) {
  return new Promise<{ output: string; timedOut: boolean }>((resolve) => {
    let output = "";
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      onTimeout();
      resolve({ output: `${output}\n[seedling] timed out`, timedOut: true });
    }, timeoutMs);
    stream.on("data", (chunk: Buffer) => {
      if (output.length < 200_000) output += chunk.toString("utf8");
    });
    stream.on("end", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ output, timedOut: false });
    });
  });
}

export function dockerDriver(): SandboxDriver {
  const docker = new Docker();

  return {
    name: "docker",

    async available() {
      try {
        const info = await docker.version();
        return { ok: true, detail: `Docker ${info.Version}` };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : "docker unavailable" };
      }
    },

    async ensureImage() {
      const images = await docker.listImages({ filters: { reference: [env.sandbox.image] } });
      if (images.length) return;
      const tar = await import("node:child_process");
      await new Promise<void>((resolve, reject) => {
        const child = tar.spawn("docker", ["build", "-t", env.sandbox.image, path.resolve("sandbox")], { stdio: "inherit" });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`docker build exited with ${code}`))));
      });
    },

    async running() {
      const list = await docker.listContainers({ filters: { label: [LABEL] } });
      return list.length;
    },

    async find(sessionId) {
      const list = await docker.listContainers({ filters: { label: [`${LABEL}=${sessionId}`] } });
      return list[0]?.Id ?? null;
    },

    async start(opts: StartOptions) {
      const existing = await this.find(opts.sessionId);
      if (existing) return existing;
      const container = await docker.createContainer({
        Image: env.sandbox.image,
        name: `seedling-${opts.sessionId.slice(0, 10).replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString(36)}`,
        Labels: { [LABEL]: opts.sessionId },
        Env: Object.entries({ HOME: "/home/candidate", TERM: "xterm-256color", ...opts.env }).map(([k, v]) => `${k}=${v}`),
        WorkingDir: "/workspace",
        HostConfig: {
          ...hardening(env.sandbox.memoryMb),
          Binds: [`${toHostPath(opts.workspace)}:/workspace:rw`, `${toHostPath(opts.agents)}:/agents:rw`, ...(opts.setup ? [`${toHostPath(opts.setup)}:${SETUP_MOUNT}:ro`] : [])],
          NetworkMode: env.sandbox.network || undefined,
          ExtraHosts: ["host.docker.internal:host-gateway"],
          AutoRemove: true,
        },
      });
      await container.start();
      return container.id;
    },

    async shell(containerId, options: ShellOptions = {}) {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: ["bash", "-l"],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: Object.entries({ TERM: "xterm-256color", ...options.env }).map(([k, v]) => `${k}=${v}`),
        WorkingDir: options.cwd ?? "/workspace",
      });
      const stream = (await exec.start({ hijack: true, stdin: true, Tty: true })) as unknown as Shell["stream"];
      return {
        stream,
        async resize(cols, rows) {
          await exec.resize({ w: cols, h: rows }).catch(() => {});
        },
        close() {
          stream.end();
          stream.destroy();
        },
      };
    },

    async exec(containerId, command, timeoutMs) {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({ Cmd: ["bash", "-lc", command], AttachStdout: true, AttachStderr: true, WorkingDir: "/workspace" });
      const raw = await exec.start({ hijack: true, stdin: false });
      const { output, timedOut } = await collect(demux(docker, raw), timeoutMs, () => raw.destroy());
      const info = await exec.inspect().catch(() => ({ ExitCode: 1 }));
      return { exitCode: timedOut ? 124 : (info.ExitCode ?? 1), output, timedOut };
    },

    async listening(containerId) {
      const result = await this.exec(containerId, "cat /proc/net/tcp /proc/net/tcp6 2>/dev/null", 5000);
      return parseListening(result.output);
    },

    async connect(containerId, port) {
      const exec = await docker.getContainer(containerId).exec({ Cmd: ["node", "-e", RELAY, String(port)], AttachStdin: true, AttachStdout: true, AttachStderr: false, Tty: false });
      const raw = (await exec.start({ hijack: true, stdin: true })) as unknown as Duplex;
      const out = new PassThrough();
      const sink = new Writable({ write: (_chunk, _enc, done) => done() });
      docker.modem.demuxStream(raw, out, sink);
      const stream: Duplex = new Duplex({
        read() {
          out.resume();
        },
        write(chunk, _enc, done) {
          raw.write(chunk, done);
        },
        final(done) {
          raw.end();
          done();
        },
        destroy(error, done) {
          raw.destroy();
          out.destroy();
          done(error);
        },
      });
      out.on("data", (chunk: Buffer) => {
        if (!stream.push(chunk)) out.pause();
      });
      out.on("end", () => stream.push(null));
      raw.on("end", () => out.end());
      raw.on("close", () => {
        if (!out.writableEnded) out.end();
      });
      raw.on("error", (error) => stream.destroy(error));
      return socketLike(stream);
    },

    async stop(containerId) {
      await docker
        .getContainer(containerId)
        .stop({ t: 2 })
        .catch(() => {});
    },

    async runIsolated(workspace, command, timeoutMs): Promise<RunResult> {
      const container = await docker.createContainer({
        Image: env.sandbox.image,
        Labels: { "seedling.grading": "1" },
        Cmd: ["bash", "-lc", command],
        WorkingDir: "/workspace",
        Env: ["HOME=/home/candidate", "CI=1"],
        HostConfig: { ...hardening(Math.max(env.sandbox.memoryMb, 1024)), Binds: [`${toHostPath(workspace)}:/workspace:rw`], NetworkMode: "none" },
      });
      const raw = await container.attach({ stream: true, stdout: true, stderr: true });
      await container.start();
      const { output, timedOut } = await collect(demux(docker, raw), timeoutMs, () => {
        container.kill().catch(() => {});
      });
      const result = await container.wait().catch(() => ({ StatusCode: 1 }));
      await container.remove({ force: true }).catch(() => {});
      return { exitCode: timedOut ? 124 : result.StatusCode, output, timedOut };
    },
  };
}
