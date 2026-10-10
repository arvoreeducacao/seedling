import type { I18n } from "@/lib/i18n";

const colors = { lendo: "var(--surface-3)", escrevendo: "var(--cand)", claude: "var(--accent)", colou: "var(--warn)", entregou: "var(--text)" } as const;
const labelKeys = { lendo: "report.minute.lendo", escrevendo: "report.minute.escrevendo", claude: "report.minute.claude", colou: "report.minute.colou", entregou: "report.minute.entregou" } as const;

export function MinuteStrip({ strip, height = 22, i18n }: { strip: (keyof typeof colors)[]; height?: number; i18n: I18n }) {
  const { t } = i18n;
  return (
    <div>
      <div role="img" aria-label={t("report.minuteByMinute")} style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(strip.length, 1)}, minmax(0,1fr))`, gap: 2 }}>
        {strip.map((s, i) => <span key={i} title={t("report.minuteTitle", { m: i + 1, what: t(labelKeys[s]) })} style={{ height, borderRadius: 2, background: colors[s] }} />)}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11.5, flexWrap: "wrap" }} className="muted">
        {(Object.keys(colors) as (keyof typeof colors)[]).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: colors[k] }} />{t(labelKeys[k])}</span>
        ))}
      </div>
    </div>
  );
}
