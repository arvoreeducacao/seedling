import { loadKit, progressFor } from "@/lib/prep";
import { kitIsEmpty } from "@/lib/prep/kit";
import { practiceStats } from "@/lib/prep/stats";
import { when } from "@/lib/format";
import type { Key } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { IconCheck } from "@/components/icons";

const practiceStateKeys: Record<string, Key> = {
  running: "prep.summary.state.running",
  submitted: "prep.summary.state.submitted",
  expired: "prep.summary.state.expired",
  cancelled: "prep.summary.state.cancelled",
  invited: "prep.summary.state.invited",
  paused: "prep.summary.state.paused",
};

export async function PrepSummary({ sessionId }: { sessionId: string }) {
  const i18n = await getI18n();
  const { t } = i18n;
  const [kit, progress] = await Promise.all([loadKit(), progressFor(sessionId)]);
  if (kitIsEmpty(kit) && !progress) return null;
  const practice = await practiceStats(progress?.practiceSessionId);
  const done = new Set(progress?.sectionsDone ?? []);
  const doneCount = kit.sections.filter((s) => done.has(s.id)).length;
  const practiceStateKey = practice ? practiceStateKeys[practice.status] : undefined;
  return (
    <section className="card" data-el="prep-summary">
      <div className="card-head">
        {t("prep.summary.title")}
        <span className="aside">{progress?.openedAt ? t("prep.summary.opened", { opened: when(i18n, progress.openedAt), seen: when(i18n, progress.lastSeenAt) }) : t("prep.summary.notOpened")}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: "var(--border)", borderRadius: "0 0 var(--r-lg) var(--r-lg)", overflow: "hidden" }}>
        <div style={{ padding: 16, minWidth: 0, flex: "1 1 230px", background: "var(--surface)" }}>
          <div className="label">{t("prep.summary.kit")}</div>
          <div className="stat-value num" style={{ marginTop: 4 }}>{doneCount}<span className="faint" style={{ fontSize: 14 }}> / {kit.sections.length}</span></div>
          <ul style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
            {kit.sections.map((s) => (
              <li key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", color: done.has(s.id) ? "var(--text)" : "var(--text-3)" }}>
                <span style={{ width: 16, height: 16, flex: "none", borderRadius: 999, display: "grid", placeItems: "center", background: done.has(s.id) ? "var(--ok-soft)" : "var(--surface-3)", color: "var(--ok)" }}>{done.has(s.id) && <IconCheck size={10} />}</span>
                <span className="truncate">{s.title}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ padding: 16, minWidth: 0, flex: "1 1 230px", background: "var(--surface)" }}>
          <div className="label">{t("prep.summary.practice")}<span className="faint" style={{ textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>{t("prep.summary.notEvaluated")}</span></div>
          {practice && practice.startedAt ? (
            <div style={{ marginTop: 6 }} data-el="practiced">
              <div style={{ fontWeight: 500 }}>{t("prep.summary.practiced", { minutes: t("prep.summary.practicedMinutes", { n: practice.minutesUsed }), prompts: t("prep.summary.practicedPrompts", { n: practice.prompts }) })}</div>
              <div className="faint" style={{ marginTop: 4, fontSize: 12 }}>{practice.kind === "playground" ? t("prep.summary.inPlayground") : t("prep.summary.onChallenge")} · {practiceStateKey ? t(practiceStateKey) : practice.status}</div>
            </div>
          ) : (
            <div className="faint" style={{ marginTop: 6, fontSize: 12.5 }} data-el="practiced">{kit.practice.enabled || practice ? t("prep.summary.notPracticed") : t("prep.summary.notOffered")}</div>
          )}
        </div>
      </div>
    </section>
  );
}
