"use client";

import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import ui from "./ui.module.css";

export type TerminalStatus = "connecting" | "live" | "offline";

export type TerminalHandle = {
  send(data: string): void;
  focus(): void;
  syncSize(): void;
};

type Props = {
  sessionId: string;
  agent?: string;
  readOnly?: boolean;
  generation?: number;
  handle?: React.RefObject<TerminalHandle | null>;
  onStatus?: (status: TerminalStatus) => void;
  onOutput?: (text: string, msSinceOpen: number) => void;
  onControl?: (message: string) => void;
  fontSize?: number;
};

const theme = {
  background: "#0e0f2d",
  foreground: "#e4e5f7",
  cursor: "#d97757",
  cursorAccent: "#0e0f2d",
  selectionBackground: "#5865f255",
  black: "#1f2149",
  red: "#f2555a",
  green: "#3ecf8e",
  yellow: "#f5a524",
  blue: "#82aaff",
  magenta: "#c792ea",
  cyan: "#38bdf8",
  white: "#d6d8f0",
  brightBlack: "#7275a3",
  brightRed: "#ff7b7f",
  brightGreen: "#6ee7b7",
  brightYellow: "#fcd34d",
  brightBlue: "#a5c3ff",
  brightMagenta: "#ddb6f2",
  brightCyan: "#7dd3fc",
  brightWhite: "#ffffff",
};

export function TerminalView({ sessionId, agent = "main", readOnly = false, generation = 0, handle, onStatus, onOutput, onControl, fontSize = 13 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus);
  const outputRef = useRef(onOutput);
  const controlRef = useRef(onControl);
  controlRef.current = onControl;
  statusRef.current = onStatus;
  outputRef.current = onOutput;

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let cleanup = () => {};
    statusRef.current?.("connecting");
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !host.current) return;
      const styles = getComputedStyle(host.current);
      const mono = styles.getPropertyValue("--font-term").trim() || styles.getPropertyValue("--font-geist-mono").trim();
      const family = `${mono ? `${mono}, ` : ""}ui-monospace, Menlo, monospace`;
      await Promise.all([document.fonts?.load(`400 ${fontSize}px ${family}`), document.fonts?.load(`700 ${fontSize}px ${family}`)]).catch(() => null);
      if (disposed || !host.current) return;
      const term = new Terminal({
        fontFamily: family,
        fontSize,
        fontWeight: "400",
        fontWeightBold: "700",
        lineHeight: 1.35,
        letterSpacing: 0,
        drawBoldTextInBrightColors: false,
        rescaleOverlappingGlyphs: true,
        cursorBlink: !readOnly,
        cursorStyle: "bar",
        cursorInactiveStyle: "none",
        disableStdin: readOnly,
        scrollback: 8000,
        convertEol: false,
        allowTransparency: false,
        theme,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host.current);
      fit.fit();
      const proto = location.protocol === "https:" ? "wss" : "ws";
      let retry: ReturnType<typeof setTimeout> | null = null;
      let openedAt = 0;
      let mirror: { cols: number; rows: number } | null = null;
      const scaleMirror = () => {
        const el = term.element;
        if (!el || !host.current) return;
        el.style.transform = "";
        const scale = Math.min(1, host.current.clientWidth / Math.max(1, el.scrollWidth), host.current.clientHeight / Math.max(1, el.scrollHeight));
        el.style.transformOrigin = "top left";
        el.style.transform = scale < 1 ? `scale(${scale})` : "";
      };
      const followSize = (cols: number, rows: number) => {
        mirror = { cols, rows };
        term.resize(cols, rows);
        requestAnimationFrame(scaleMirror);
      };
      let resyncs: ReturnType<typeof setTimeout>[] = [];
      const syncSize = () => {
        if (disposed || mirror) return;
        fit.fit();
        if (socket?.readyState === WebSocket.OPEN && !readOnly) socket.send(`\u0000resize:${term.cols}x${term.rows}`);
      };
      const resyncSoon = () => {
        resyncs.forEach(clearTimeout);
        resyncs = [300, 1000, 2500].map((ms) => setTimeout(syncSize, ms));
      };
      void document.fonts?.ready.then(syncSize);
      const connect = () => {
        if (!readOnly) fit.fit();
        const size = readOnly ? "" : `&cols=${term.cols}&rows=${term.rows}`;
        socket = new WebSocket(`${proto}://${location.host}/ws/terminal?session=${encodeURIComponent(sessionId)}&agent=${encodeURIComponent(agent)}${size}`);
        socket.onopen = () => {
          openedAt = Date.now();
          statusRef.current?.("live");
          syncSize();
          resyncSoon();
        };
        socket.onmessage = (e) => {
          const text = typeof e.data === "string" ? e.data : "";
          if (text.startsWith("\u0000size:")) {
            const [cols, rows] = text.slice(6).split("x").map(Number);
            if (readOnly && cols > 0 && rows > 0) followSize(cols, rows);
            return;
          }
          if (text.startsWith("\u0000")) {
            controlRef.current?.(text.slice(1));
            return;
          }
          term.write(text);
          outputRef.current?.(text, Date.now() - openedAt);
        };
        socket.onclose = () => {
          if (disposed) return;
          statusRef.current?.("offline");
          retry = setTimeout(connect, 2000);
        };
      };
      connect();
      const input = term.onData((data) => {
        if (!readOnly && socket?.readyState === WebSocket.OPEN) socket.send(data);
      });
      if (handle) {
        handle.current = {
          send: (data) => {
            if (!readOnly && socket?.readyState === WebSocket.OPEN) socket.send(data);
          },
          focus: () => term.focus(),
          syncSize,
        };
      }
      if (!readOnly && host.current.offsetParent) term.focus();
      const observer = new ResizeObserver(() => {
        if (mirror) {
          scaleMirror();
          return;
        }
        fit.fit();
        syncSize();
      });
      observer.observe(host.current);
      cleanup = () => {
        if (retry) clearTimeout(retry);
        resyncs.forEach(clearTimeout);
        if (handle) handle.current = null;
        observer.disconnect();
        input.dispose();
        socket?.close();
        term.dispose();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [sessionId, agent, readOnly, generation, handle, fontSize]);

  return <div ref={host} className={ui.term} />;
}
