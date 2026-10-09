"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { spring } from "@/components/motion";
import { IconLogout } from "@/components/icons";
import { Logo } from "@/components/brand";

type Props = { email: string; name: string; org: string; initials: string; live: number; spent: string; budgetPct: number; counts: { sessions: number; challenges: number } };

const glyphs = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  sessions: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  challenges: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></>,
  invite: <><path d="M12 5v14M5 12h14" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
};

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>{glyphs[name]}</svg>;
}

type NavItem = { href: string; label: string; glyph: keyof typeof glyphs; on: boolean; count?: React.ReactNode; hot?: boolean };

function Nav({ items, label, group }: { items: NavItem[]; label: string; group: string }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }} aria-label={label} onMouseLeave={() => setHover(null)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.on ? "page" : undefined}
          onMouseEnter={() => setHover(item.href)}
          onFocus={() => setHover(item.href)}
          style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 12px", borderRadius: 10, color: item.on ? "var(--text)" : "var(--text-2)", fontWeight: item.on ? 600 : 500, whiteSpace: "nowrap", transition: "color .15s" }}
        >
          {hover === item.href && !item.on && <motion.span layoutId={`hover-${group}`} transition={spring} style={{ position: "absolute", inset: 0, borderRadius: 10, background: "var(--surface-hover)" }} />}
          {item.on && <motion.span layoutId="nav-active" transition={spring} style={{ position: "absolute", inset: 0, borderRadius: 10, background: "var(--accent-soft)" }} />}
          <span style={{ position: "relative", color: item.on ? "var(--accent-text)" : "var(--text-3)", display: "flex" }}><Glyph name={item.glyph} /></span>
          <span style={{ position: "relative" }}>{item.label}</span>
          {item.count !== undefined && (
            <span className="num" style={{ position: "relative", marginLeft: "auto", fontSize: 11, display: "flex", alignItems: "center", gap: 5, color: item.hot ? "var(--err)" : "var(--text-3)" }}>
              {item.hot && <span className="dot dot-live" style={{ width: 5, height: 5 }} />}
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar({ email, name, org, initials, live, spent, budgetPct, counts }: Props) {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <aside data-el="sidebar" style={{ width: 232, flex: "none", height: "100dvh", position: "sticky", top: 0, background: "var(--bg-raised)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "14px 12px 12px" }} className="max-md:!hidden">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 6px 18px" }}>
        <div style={{ minWidth: 0, lineHeight: 1.25 }}>
          <Logo size={28} />
          <div className="faint truncate" style={{ fontSize: 11.5, marginTop: 2, paddingLeft: 29 }}>{org === "Seedling" ? "Self-hosted" : org}</div>
        </div>
      </div>
      <Link href="/sessions/new" className="btn btn-block" style={{ justifyContent: "flex-start", marginBottom: 18, color: "var(--text-2)" }} data-el="sidebar-invite">
        <Glyph name="invite" />
        Invite candidate
        <span className="kbd" style={{ marginLeft: "auto" }}>C</span>
      </Link>
      <Nav
        label="Main"
        group="main"
        items={[
          { href: "/", label: "Overview", glyph: "overview", on: active("/", true) },
          { href: "/sessions", label: "Sessions", glyph: "sessions", on: active("/sessions") && path !== "/sessions/new", count: live > 0 ? `${live} live` : counts.sessions, hot: live > 0 },
          { href: "/challenges", label: "Challenges", glyph: "challenges", on: active("/challenges"), count: counts.challenges },
        ]}
      />
      <div className="eyebrow" style={{ padding: "22px 10px 8px", fontSize: 10.5 }}>Workspace</div>
      <Nav label="Workspace" group="workspace" items={[{ href: "/settings", label: "Settings", glyph: "settings", on: active("/settings") }]} />
      <div data-el="ai-spend" style={{ marginTop: "auto", borderRadius: "var(--r-lg)", padding: "12px 14px", background: "var(--surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5 }}>
          <span className="faint">AI spend this month</span>
        </div>
        <div className="num" style={{ marginTop: 4, fontSize: 12.5, color: budgetPct > 80 ? "var(--warn)" : "var(--text)" }}>{spent}</div>
        <div className="bar" style={{ marginTop: 8, height: 3 }}><i style={{ width: `${Math.max(2, Math.min(100, budgetPct))}%`, background: budgetPct > 80 ? "var(--warn)" : undefined }} /></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 6px 0", marginTop: 12, borderTop: "1px solid var(--border)" }}>
        <span className="avatar" style={{ background: "linear-gradient(135deg, #f472b6, #c084fc)", color: "#0a0a0b" }}>{initials}</span>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
          <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{name}</div>
          <div className="truncate faint" style={{ fontSize: 11 }} title={email}>{email}</div>
        </div>
        <form action="/auth/logout" method="post">
          <button className="btn btn-ghost btn-sm btn-icon" aria-label="Sign out" title="Sign out"><IconLogout size={14} /></button>
        </form>
      </div>
    </aside>
  );
}
