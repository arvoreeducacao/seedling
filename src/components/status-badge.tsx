const map = {
  invited: ["var(--text-3)", "Invited"],
  running: ["var(--err)", "Live"],
  paused: ["var(--warn)", "Disconnected"],
  submitted: ["var(--accent)", "To review"],
  expired: ["var(--warn)", "Time ran out"],
  cancelled: ["var(--text-3)", "Cancelled"],
} as const;

const decisions = { advance: ["var(--ok)", "Advanced"], talk: ["var(--warn)", "Follow up"], reject: ["var(--text-3)", "Not advancing"] } as const;

export function StatusBadge({ status, decision, detail }: { status: keyof typeof map; decision?: keyof typeof decisions | null; detail?: string }) {
  const [color, label] = decision ? decisions[decision] : map[status];
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span className={`dot ${status === "running" && !decision ? "dot-live" : ""}`} style={{ background: color }} />
      <span style={{ whiteSpace: "nowrap", color: status === "paused" && !decision ? "var(--warn)" : status === "invited" || status === "cancelled" ? "var(--text-2)" : undefined }}>{label}</span>
      {detail && <span className="faint num truncate" style={{ fontSize: 11.5 }}>{detail}</span>}
    </span>
  );
}
