import type { SetupView } from "@/lib/setup/store";
import { hasKey, type Key } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { when } from "@/lib/format";

function kb(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

const categoryLabels: Record<"skills" | "claudeMd" | "mcpServers", Key> = {
  skills: "setup.summary.labelSkills",
  claudeMd: "setup.summary.labelClaudeMd",
  mcpServers: "setup.summary.labelMcp",
};

export async function SetupSummary({ view }: { view: SetupView }) {
  const i18n = await getI18n();
  const { t } = i18n;
  const empty = !view.skills.length && !view.claudeMd && !view.mcpServers.length;
  const off = (["skills", "claudeMd", "mcpServers"] as const).filter((k) => !view.policy[k]);
  return (
    <div className="card" data-el="candidate-setup">
      <div className="card-head">
        {t("setup.summary.title")}
        {view.lastInstall && <span className="aside">{view.lastInstall.error ? (hasKey(view.lastInstall.error) ? t(view.lastInstall.error) : view.lastInstall.error) : t("setup.summary.installedAt", { when: when(i18n, new Date(view.lastInstall.at)) })}</span>}
      </div>
      {empty ? (
        <div className="list-item faint">{t("setup.summary.empty")}</div>
      ) : (
        <>
          {view.skills.map((s) => (
            <div key={`s-${s.name}`} className="list-item" style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span className="pill">{t("setup.summary.skillPill")}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{s.name}</span>
              <span className="faint" style={{ fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description ?? ""}</span>
              <span className="faint mono" style={{ marginLeft: "auto", fontSize: 11.5, flex: "none" }}>{t("setup.fileCount", { n: s.files.length })}</span>
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
              <span className="pill">{t("setup.summary.mcpPill", { type: m.type })}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{m.name}</span>
              <span className="faint mono" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{m.url}</span>
              {m.headers.length > 0 && <span className="faint mono" style={{ fontSize: 11.5 }}>{m.headers.map((h) => `${h}: ••••••`).join("  ")}</span>}
            </div>
          ))}
        </>
      )}
      {off.length > 0 && <div className="card-foot faint" style={{ fontSize: 11.5 }}>{t("setup.summary.turnedOff", { list: off.map((k) => t(categoryLabels[k])).join(", ") })}</div>}
    </div>
  );
}
