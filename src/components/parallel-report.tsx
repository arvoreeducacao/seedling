import type { Parallelism } from "@/lib/parallel";

export type Produced = { files: number; added: number; removed: number; merged: boolean } | null;

function minutes(ms: number) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function ParallelReport({ data, produced }: { data: Parallelism; produced: Record<string, Produced> }) {
  const total = Math.max(1, data.end - data.start);
  const pct = (t: number) => `${(Math.max(0, Math.min(total, t - data.start)) / total) * 100}%`;
  const width = (a: number, b: number) => `${(Math.max(0, Math.min(b, data.end) - Math.max(a, data.start)) / total) * 100}%`;
  const max = Math.max(1, ...data.minutes);
  const merged = data.lanes.filter((l) => produced[l.key]?.merged).length;
  const extra = data.lanes.length - 1;
  return (
    <div className="card" data-el="parallelism">
      <div className="card-head">Parallel agents<span className="aside">{data.lanes.length} agents · one row each</span></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="stats" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
          {[
            ["Extra agents", String(extra), "besides Main"],
            ["Most at once", String(data.peak), data.peak > 1 ? "working together" : "never overlapped"],
            ["Overlap", minutes(data.overlapMs), "2+ working"],
            ["Merged", `${merged}/${extra}`, "extra agents"],
          ].map(([label, value, foot]) => (
            <div key={label}>
              <span className="label">{label}</span>
              <div className="stat-value num" style={{ fontSize: 22 }}>{value}</div>
              <div className="faint truncate" style={{ fontSize: 12, marginTop: 4 }}>{foot}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Agents working, minute by minute</div>
          <div role="img" aria-label="Agents working per minute" style={{ display: "grid", gridTemplateColumns: `repeat(${data.minutes.length}, minmax(0,1fr))`, gap: 2, alignItems: "end", height: 40 }}>
            {data.minutes.map((n, i) => (
              <span key={i} title={`min ${i + 1}: ${n} working`} style={{ height: n ? `${(n / max) * 100}%` : 2, borderRadius: 2, background: n > 1 ? "var(--accent)" : n === 1 ? "rgba(88,101,242,.45)" : "var(--surface-2)" }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-el="swimlanes">
          {data.lanes.map((lane) => {
            const until = Math.min(data.end, lane.closedAt ?? data.end);
            return (
              <div key={lane.key} style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 12, alignItems: "center" }}>
                <span className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }} title={lane.name}>{lane.name}</span>
                <div style={{ position: "relative", height: 18, borderRadius: 4, background: "var(--surface-2)" }}>
                  <span title="Open, waiting on the candidate" style={{ position: "absolute", top: 0, bottom: 0, left: pct(lane.openedAt), width: width(lane.openedAt, until), borderRadius: 4, background: "var(--ok-soft)" }} />
                  {lane.spans.map((sp, i) => (
                    <span key={i} title={`Working ${minutes(sp.end - sp.start)}`} style={{ position: "absolute", top: 3, bottom: 3, left: pct(sp.start), width: width(sp.start, sp.end), minWidth: 3, borderRadius: 3, background: "var(--accent)" }} />
                  ))}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 16, fontSize: 11.5, paddingLeft: 132 }} className="muted">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)" }} />working</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ok-soft)", outline: "1px solid var(--ok)" }} />open, waiting on the candidate</span>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }} data-el="agent-table">
          <thead>
            <tr className="faint" style={{ textAlign: "left", fontSize: 11.5 }}>
              {["Agent", "Prompts", "Working", "Waiting", "Cost", "Produced"].map((h) => <th key={h} style={{ fontWeight: 500, padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.lanes.map((lane) => {
              const made = produced[lane.key];
              return (
                <tr key={lane.key}>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--border)", fontWeight: 500 }}>{lane.name}</td>
                  <td className="num" style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>{lane.prompts}</td>
                  <td className="num" style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>{minutes(lane.workingMs)}</td>
                  <td className="num" style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>{minutes(lane.waitingMs)}</td>
                  <td className="num" style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>${lane.cost.toFixed(2)}</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
                    {lane.key === "main" ? <span className="faint">the workspace itself</span> : made ? (
                      <span>
                        <span className={`pill ${made.merged ? "pill-ok" : ""}`} style={{ marginRight: 8 }}>{made.merged ? "Merged" : "Not merged"}</span>
                        <span className="num">{made.files} {made.files === 1 ? "file" : "files"}</span> <span style={{ color: "var(--ok)" }}>+{made.added}</span> <span style={{ color: "var(--err)" }}>−{made.removed}</span>
                      </span>
                    ) : <span className="faint">still open when the session ended</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
