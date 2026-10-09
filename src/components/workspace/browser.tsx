"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowClockwise, ArrowLeft, ArrowRight, ArrowSquareOut, Browser, CaretDown, Eye, FileHtml, Globe, Plug, Robot } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { agentAddress, displayUrl, formatAddress, parseAddress, type Address } from "./address";
import { Placeholder } from "./viewers";
import ui from "./ui.module.css";

type Info =
  | { enabled: false; reason: string }
  | { enabled: true; origin: string; ticket: string; ports: number[]; suggested: number | null; running: boolean; agent: AgentPage | null };

type AgentPage = { url: string; title: string; changedAt: number };

const AGENT_ACTIVE_MS = 30_000;

export type BrowserRequest = { address: Address; nonce: number };

function enterUrl(info: Extract<Info, { enabled: true }>, address: Address) {
  const params = new URLSearchParams({ ticket: info.ticket, port: String(address.port), path: address.path });
  return `${info.origin}/__seedling/enter?${params}`;
}

export function BrowserPane({
  endpoint,
  active,
  request,
  htmlFiles,
  onNavigate,
  extra,
  preferred,
  agentScreen,
}: {
  endpoint: string;
  agentScreen: string;
  active: boolean;
  request?: BrowserRequest | null;
  htmlFiles: string[];
  onNavigate?: (address: string) => void;
  extra?: (open: (address: Address) => void) => React.ReactNode;
  preferred?: Address | null;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [current, setCurrent] = useState<Address | null>(null);
  const [frame, setFrame] = useState<{ src: string; key: number } | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bridged, setBridged] = useState(false);
  const [title, setTitle] = useState("");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"page" | "agent">("page");
  const [follow, setFollow] = useState(true);
  const [shot, setShot] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastAgentUrl = useRef<string | null>(null);
  const [history, setHistory] = useState<{ entries: { text: string; load: number }[]; index: number }>({ entries: [], index: -1 });
  const iframe = useRef<HTMLIFrameElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const expectLoad = useRef(false);
  const traveling = useRef<number | null>(null);
  const touched = useRef(false);
  const currentRef = useRef<Address | null>(null);
  const handled = useRef(0);
  const loadCount = useRef(0);
  currentRef.current = current;

  const fetchInfo = useCallback(async () => {
    const res = await fetch(endpoint, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    let json: Info = await res.json();
    if (json.enabled && new URL(json.origin).origin === window.location.origin) json = { enabled: false, reason: "The preview origin must differ from the app origin. Check SEEDLING_PREVIEW_ORIGIN." };
    setInfo(json);
    return json;
  }, [endpoint]);

  const load = useCallback(
    async (address: Address, push: boolean) => {
      const fresh = await fetchInfo();
      if (!fresh?.enabled) return;
      touched.current = true;
      setError(null);
      setCurrent(address);
      setInput(formatAddress(address));
      setEditing(false);
      setBridged(false);
      setLoading(true);
      setTitle("");
      expectLoad.current = true;
      loadCount.current += 1;
      const load = loadCount.current;
      setFrame({ src: enterUrl(fresh, address), key: load });
      const text = formatAddress(address);
      if (push) {
        setHistory((h) => {
          const entries = [...h.entries.slice(0, h.index + 1), { text, load }];
          return { entries, index: entries.length - 1 };
        });
      } else {
        setHistory((h) => {
          if (h.index < 0) return h;
          const entries = [...h.entries];
          entries[h.index] = { text, load };
          return { entries, index: h.index };
        });
      }
      onNavigate?.(text);
    },
    [fetchInfo, onNavigate],
  );

  const open = useCallback(
    (address: Address) => {
      touched.current = true;
      setView("page");
      setFollow(false);
      void load(address, true);
    },
    [load],
  );

  const agent = info?.enabled ? info.agent : null;

  useEffect(() => {
    const url = agent?.url ?? null;
    if (!url || url === lastAgentUrl.current) return;
    lastAgentUrl.current = url;
    if (follow) setView("agent");
  }, [agent?.url, follow]);

  useEffect(() => {
    if (!active || view !== "agent" || !agent) return;
    let alive = true;
    let previous: string | null = null;
    const grab = async () => {
      const res = await fetch(agentScreen, { cache: "no-store" }).catch(() => null);
      if (!alive || !res || res.status !== 200) return;
      const blob = await res.blob();
      if (!alive || !blob.type.startsWith("image/")) return;
      const next = URL.createObjectURL(blob);
      setShot(next);
      if (previous) URL.revokeObjectURL(previous);
      previous = next;
    };
    void grab();
    const timer = setInterval(() => void grab(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, view, agent, agentScreen]);

  useEffect(() => {
    if (!agent) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [agent]);

  useEffect(() => {
    if (!active) return;
    void fetchInfo();
    const timer = setInterval(() => void fetchInfo(), 4000);
    return () => clearInterval(timer);
  }, [active, fetchInfo]);

  useEffect(() => {
    if (!request || request.nonce === handled.current) return;
    handled.current = request.nonce;
    open(request.address);
  }, [request, open]);

  useEffect(() => {
    if (touched.current || current || !info?.enabled) return;
    if (preferred) {
      touched.current = true;
      void load(preferred, true);
      return;
    }
    if (!info.ports.length) return;
    const port = info.suggested && info.ports.includes(info.suggested) ? info.suggested : info.ports[0];
    touched.current = true;
    void load({ port, path: "/" }, true);
  }, [info, current, load, preferred]);

  useEffect(() => {
    if (!info?.enabled) return;
    const origin = info.origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== iframe.current?.contentWindow) return;
      const data = event.data as { seedling?: string; href?: string; title?: string } | null;
      if (data?.seedling !== "preview" || typeof data.href !== "string") return;
      const base = currentRef.current;
      if (!base) return;
      const next = { port: base.port, path: data.href || "/" };
      const text = formatAddress(next);
      setBridged(true);
      setTitle(data.title ?? "");
      setCurrent(next);
      if (!editing) setInput(text);
      const load = loadCount.current;
      setHistory((h) => {
        if (traveling.current !== null) {
          const index = traveling.current;
          traveling.current = null;
          const entries = [...h.entries];
          entries[index] = { text, load };
          return { entries, index };
        }
        if (expectLoad.current) {
          expectLoad.current = false;
          const entries = [...h.entries];
          if (h.index >= 0) entries[h.index] = { text, load };
          return { entries, index: Math.max(0, h.index) };
        }
        if (h.entries[h.index]?.text === text) return h;
        const entries = [...h.entries.slice(0, h.index + 1), { text, load }];
        return { entries, index: entries.length - 1 };
      });
      if (text !== formatAddress(base)) onNavigate?.(text);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [info, editing, onNavigate]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
      setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  function command(name: "back" | "forward" | "reload") {
    iframe.current?.contentWindow?.postMessage({ seedling: "command", command: name }, info?.enabled ? info.origin : "*");
  }

  function travel(delta: -1 | 1) {
    const index = history.index + delta;
    const target = history.entries[index];
    if (target === undefined) return;
    if (bridged && target.load === loadCount.current) {
      traveling.current = index;
      setHistory((h) => ({ ...h, index }));
      setLoading(true);
      command(delta < 0 ? "back" : "forward");
      return;
    }
    const address = parseAddress(target.text, current?.port ?? null);
    if (!address) return;
    setHistory((h) => ({ ...h, index }));
    void load(address, false);
  }

  function reload() {
    if (!current) return;
    if (bridged) {
      setLoading(true);
      command("reload");
    } else void load(current, false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = parseAddress(input, current?.port ?? null);
    if (!address) {
      setError(/^https?:\/\//i.test(input.trim()) && !/localhost|127\.0\.0\.1/i.test(input) ? "Only pages served inside the sandbox open here." : "Type a port like 3000, an address like localhost:5173/books, or an .html file.");
      return;
    }
    open(address);
  }

  async function newTab() {
    if (!current) return;
    const fresh = await fetchInfo();
    if (fresh?.enabled) window.open(enterUrl(fresh, current), "_blank", "noopener,noreferrer");
  }

  if (info && !info.enabled) {
    return <Placeholder icon={<Browser size={18} />} title="The browser is off">{info.reason}</Placeholder>;
  }

  const watching = view === "agent" && Boolean(agent || shot);
  const ports = info?.enabled ? info.ports : [];
  const suggested = info?.enabled ? info.suggested : null;
  const choices = [
    ...ports.map((port) => ({ key: `p${port}`, label: `localhost:${port}`, hint: port === suggested ? "app" : "listening", address: { port, path: "/" }, file: false })),
    ...(suggested && !ports.includes(suggested) ? [{ key: `s${suggested}`, label: `localhost:${suggested}`, hint: "not running yet", address: { port: suggested, path: "/" }, file: false }] : []),
    ...htmlFiles.slice(0, 8).map((path) => ({ key: `f${path}`, label: path, hint: "file", address: { port: 0, path: `/${path}` }, file: true })),
  ];

  return (
    <div className={ui.panelBody} data-el="browser">
      <form className={ui.browserBar} onSubmit={submit}>
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => travel(-1)} disabled={history.index <= 0} aria-label="Back" title="Back"><ArrowLeft size={14} /></button>
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => travel(1)} disabled={history.index >= history.entries.length - 1} aria-label="Forward" title="Forward"><ArrowRight size={14} /></button>
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={reload} disabled={!current} aria-label="Reload" title="Reload"><ArrowClockwise size={14} className={loading ? ui.spinning : undefined} /></button>
        <div className={ui.addressWrap}>
          <span className={ui.addressIcon}>{current?.port === 0 ? <FileHtml size={13} /> : <Globe size={13} />}</span>
          <input
            className={ui.address}
            value={view === "agent" && agent && !editing ? displayUrl(agent.url) : input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onFocus={(e) => {
              setEditing(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setEditing(false);
              if (current) setInput(formatAddress(current));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            placeholder="Port, localhost:5173/path or page.html"
            aria-label="Address"
            spellCheck={false}
            autoComplete="off"
            data-el="address-bar"
          />
          {loading && <span className={ui.addressProgress} />}
        </div>
        <div className={ui.portMenu} ref={menuRef}>
          <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu" title="Ports and pages" data-el="ports">
            <Plug size={13} />
            <span className={ui.mono}>{ports.length}</span>
            <CaretDown size={10} />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div key="menu" role="menu" className={ui.portList} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
                {choices.length ? (
                  choices.map((c) => (
                    <button key={c.key} type="button" role="menuitem" className={ui.portItem} onClick={() => { setMenu(false); open(c.address); }}>
                      {c.file ? <FileHtml size={13} /> : <Globe size={13} />}
                      <span className={`${ui.ellipsis} ${ui.mono}`}>{c.label}</span>
                      <span className={ui.faint}>{c.hint}</span>
                    </button>
                  ))
                ) : (
                  <div className={ui.portEmpty}>Nothing is listening in the sandbox yet.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => void newTab()} disabled={!current} aria-label="Open in a new tab" title="Open in a new tab"><ArrowSquareOut size={14} /></button>
      </form>
      {agent && (
        <div className={ui.agentBrowsing} data-el="agent-browsing">
          <span className={ui.agentMark}><Robot size={13} weight="fill" /></span>
          <span className={ui.agentLabel}>
            {now - agent.changedAt < AGENT_ACTIVE_MS && <span className={ui.agentPulse} />}
            {now - agent.changedAt < AGENT_ACTIVE_MS ? "Agent is browsing" : "Agent's browser"}
          </span>
          <span className={`${ui.mono} ${ui.ellipsis}`} style={{ flex: 1, color: "var(--w-fg)" }} title={agent.title ? `${agent.title} · ${agent.url}` : agent.url}>{displayUrl(agent.url)}</span>
          {view === "agent" ? (
            <>
              {agentAddress(agent.url) && (
                <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={() => open(agentAddress(agent.url)!)} title="Load the same page here so you can click around">Open here</button>
              )}
              {frame && <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={() => { setView("page"); setFollow(false); }}>Your page</button>}
            </>
          ) : (
            <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={() => { setView("agent"); setFollow(true); }} data-el="watch-agent"><Eye size={13} /> Watch</button>
          )}
        </div>
      )}
      {extra && <div className={ui.browserExtra}>{extra(open)}</div>}
      {error && <div className={`${ui.banner} ${ui.bannerWarn}`} role="alert">{error}</div>}
      {watching ? (
        <div className={ui.agentStage} data-el="agent-view">
          {shot ? <img src={shot} alt={agent ? `What the agent's browser shows: ${agent.title || agent.url}` : "The agent's browser"} /> : <span className={ui.spinner} />}
        </div>
      ) : null}
      {frame ? (
        <iframe
          key={frame.key}
          ref={iframe}
          title={title || "Page preview"}
          src={frame.src}
          className={ui.iframe}
          style={watching ? { display: "none" } : undefined}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
          data-el="browser-frame"
        />
      ) : watching ? null : (
        <Placeholder icon={<Browser size={18} />} title={info?.enabled && !info.running ? "The sandbox is starting" : "Nothing open yet"}>
          <span>Start a dev server in the terminal, for example <code className={ui.mdCode}>npm run dev</code>, and it opens here. You can also type a port or an .html file above.</span>
          {choices.length > 0 && (
            <div className={ui.quickOpen}>
              {choices.slice(0, 6).map((c) => (
                <button key={c.key} type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={() => open(c.address)}>
                  {c.file ? <FileHtml size={13} /> : <Globe size={13} />}
                  <span className={ui.mono}>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </Placeholder>
      )}
    </div>
  );
}
