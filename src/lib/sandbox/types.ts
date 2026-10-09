import type { Duplex } from "node:stream";

export type RunResult = { exitCode: number; output: string; timedOut: boolean };

export type Shell = {
  stream: Duplex;
  resize(cols: number, rows: number): Promise<void>;
  close(): void;
};

export type StartOptions = {
  sessionId: string;
  workspace: string;
  agents: string;
  setup?: string;
  env: Record<string, string>;
};

export type ShellOptions = { cwd?: string; env?: Record<string, string> };

export interface SandboxDriver {
  name: string;
  available(): Promise<{ ok: boolean; detail: string }>;
  ensureImage(): Promise<void>;
  running(): Promise<number>;
  start(opts: StartOptions): Promise<string>;
  find(sessionId: string): Promise<string | null>;
  shell(containerId: string, options?: ShellOptions): Promise<Shell>;
  exec(containerId: string, command: string, timeoutMs: number): Promise<RunResult>;
  listening(containerId: string): Promise<number[]>;
  connect(containerId: string, port: number): Promise<Duplex>;
  stop(containerId: string): Promise<void>;
  runIsolated(workspace: string, command: string, timeoutMs: number): Promise<RunResult>;
}
