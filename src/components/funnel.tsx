type S = { status: string; decision: string | null };

export function funnelCounts(sessions: S[]) {
  const invited = sessions.length;
  const did = sessions.filter((s) => s.status === "submitted" || s.status === "expired" || s.status === "running").length;
  const evaluated = sessions.filter((s) => s.decision).length;
  const advanced = sessions.filter((s) => s.decision === "advance").length;
  return { invited, did, evaluated, advanced };
}

export function Funnel({ sessions }: { sessions: S[] }) {
  const c = funnelCounts(sessions);
  const pct = (n: number) => (c.invited ? (n / c.invited) * 100 : 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }} aria-label={`${c.invited} invited, ${c.did} took it, ${c.evaluated} reviewed, ${c.advanced} advanced`}>
      <div style={{ width: "100%", maxWidth: 240, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ height: 6, width: c.invited ? "100%" : "0%", background: "var(--surface-3)", borderRadius: 3 }} />
        <div style={{ height: 6, width: `${pct(c.did)}%`, background: "var(--text-3)", borderRadius: 3 }} />
        <div style={{ height: 6, width: `${pct(c.evaluated)}%`, background: "var(--text-2)", borderRadius: 3 }} />
        <div style={{ height: 6, width: `${pct(c.advanced)}%`, background: "var(--accent)", borderRadius: 3 }} />
      </div>
      <span className="mono muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{c.invited} / {c.did} / {c.evaluated} / {c.advanced}</span>
    </div>
  );
}
