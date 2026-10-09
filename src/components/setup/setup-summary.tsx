import type { SetupView } from "@/lib/setup/store";

function kb(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function SetupSummary({ view }: { view: SetupView }) {
  const empty = !view.skills.length && !view.claudeMd && !view.mcpServers.length;
  const off = (["skills", "claudeMd", "mcpServers"] as const).filter((k) => !view.policy[k]);
  return (
    <div className="card" data-el="candidate-setup">
      <div className="card-head">
        Setup they brought
        {view.lastInstall && <span className="aside">{view.lastInstall.error ? view.lastInstall.error : `installed ${new Date(view.lastInstall.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}</span>}
      </div>
      {empty ? (
        <div className="list-item faint">Nothing. They used a clean Claude Code.</div>
      ) : (
        <>
          {view.skills.map((s) => (
            <div key={`s-${s.name}`} className="list-item" style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span className="pill">skill</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{s.name}</span>
              <span className="faint" style={{ fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description ?? ""}</span>
              <span className="faint mono" style={{ marginLeft: "auto", fontSize: 11.5, flex: "none" }}>{s.files.length} file{s.files.length > 1 ? "s" : ""}</span>
            </div>
          ))}
          {view.claudeMd && (
            <details className="list-item">
              <summary style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "baseline" }}><span className="pill">CLAUDE.md</span><span className="faint mono" style={{ marginLeft: "auto", fontSize: 11.5 }}>{kb(view.claudeMd.size)}</span></summary>
              <pre className="mono scroll-thin" style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 320, overflowY: "auto", marginTop: 10 }}>{view.claudeMd.content}</pre>
            </details>
          )}
          {view.mcpServers.map((m) => (
            <div key={`m-${m.name}`} className="list-item" style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span className="pill">MCP {m.type}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{m.name}</span>
              <span className="faint mono" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{m.url}</span>
              {m.headers.length > 0 && <span className="faint mono" style={{ fontSize: 11.5 }}>{m.headers.map((h) => `${h}: ••••••`).join("  ")}</span>}
            </div>
          ))}
        </>
      )}
      {off.length > 0 && <div className="card-foot faint" style={{ fontSize: 11.5 }}>Turned off in this workspace: {off.map((k) => (k === "claudeMd" ? "CLAUDE.md" : k === "mcpServers" ? "MCP servers" : "skills")).join(", ")}.</div>}
    </div>
  );
}
