const colors = { lendo: "var(--surface-3)", escrevendo: "var(--cand)", claude: "var(--accent)", colou: "var(--warn)", entregou: "var(--text)" } as const;
const labels = { lendo: "reading", escrevendo: "writing", claude: "talking to Claude", colou: "pasted from Claude", entregou: "submitted" } as const;

export function MinuteStrip({ strip, height = 22 }: { strip: (keyof typeof colors)[]; height?: number }) {
  return (
    <div>
      <div role="img" aria-label="Minute by minute" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(strip.length, 1)}, minmax(0,1fr))`, gap: 2 }}>
        {strip.map((s, i) => <span key={i} title={`min ${i + 1}: ${labels[s]}`} style={{ height, borderRadius: 2, background: colors[s] }} />)}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11.5, flexWrap: "wrap" }} className="muted">
        {(Object.keys(colors) as (keyof typeof colors)[]).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: colors[k] }} />{labels[k]}</span>
        ))}
      </div>
    </div>
  );
}
