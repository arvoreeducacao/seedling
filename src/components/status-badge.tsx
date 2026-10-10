import type { I18n } from "@/lib/i18n";

const map = {
  invited: "var(--text-3)",
  running: "var(--err)",
  paused: "var(--warn)",
  submitted: "var(--accent)",
  expired: "var(--warn)",
  cancelled: "var(--text-3)",
} as const;

const decisions = { advance: "var(--ok)", talk: "var(--warn)", reject: "var(--text-3)" } as const;
const decisionLabel = { advance: "decision.advanced", talk: "decision.talked", reject: "decision.rejected" } as const;

export function StatusBadge({ i18n, status, decision, detail }: { i18n: I18n; status: keyof typeof map; decision?: keyof typeof decisions | null; detail?: string }) {
  const color = decision ? decisions[decision] : map[status];
  const label = decision ? i18n.t(decisionLabel[decision]) : i18n.t(`sessionStatus.${status}`);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span className={`dot ${status === "running" && !decision ? "dot-live" : ""}`} style={{ background: color }} />
      <span style={{ whiteSpace: "nowrap", color: status === "paused" && !decision ? "var(--warn)" : status === "invited" || status === "cancelled" ? "var(--text-2)" : undefined }}>{label}</span>
      {detail && <span className="faint num truncate" style={{ fontSize: 11.5 }}>{detail}</span>}
    </span>
  );
}
