import { notFound, redirect } from "next/navigation";
import { audit, requireAdmin } from "@/lib/auth";
import { sessionDetail } from "@/lib/sessions";
import { PageHeader } from "@/components/page-header";
import { LiveRoom } from "@/components/live-room";
import { displayName, relativeDays } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";
import { endSession } from "../actions";
import { setupView } from "@/lib/setup/store";
import { SetupSummary } from "@/components/setup/setup-summary";
import { PrepSummary } from "@/components/prep-summary";

const dateTag: Record<Locale, string> = { en: "en-US", pt: "pt-BR" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const i18n = await getI18n();
  const { t } = i18n;
  const { id } = await params;
  const detail = await sessionDetail(id);
  if (!detail) notFound();
  const { session } = detail;
  const setup = await setupView(id);
  if (session.status === "submitted" || session.status === "expired") redirect(`/sessions/${id}/report`);
  if (session.status === "invited" || session.status === "cancelled") {
    const waiting = [
      t("sessions.waiting.notStarted", { email: session.candidateEmail }),
      session.scheduledAt ? t("sessions.waiting.scheduledFor", { when: session.scheduledAt.toLocaleString(dateTag[i18n.locale], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }) : "",
      t("sessions.waiting.expires", { when: relativeDays(i18n, session.inviteExpiresAt) }),
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <>
        <PageHeader crumb={t("sessions.title")} crumbHref="/sessions" title={displayName(session.candidateEmail, session.candidateName)} extra={<span className="pill">{session.status === "invited" ? t("sessions.waiting.inviteSent") : t("sessionStatus.cancelled")}</span>} />
        <div style={{ padding: 24, maxWidth: 1080, display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="muted">{session.status === "invited" ? waiting : t("sessions.waiting.cancelled")}</p>
          {session.status === "invited" && <PrepSummary sessionId={session.id} />}
          <SetupSummary view={setup} />
          <div className="notice" style={{ background: "var(--surface-2)", color: "var(--text-2)", maxWidth: 640 }}>{t("sessions.waiting.linkOnce")}</div>
          {session.status === "invited" && <form action={endSession.bind(null, id)}><button className="btn btn-danger">{t("sessions.waiting.cancelInvite")}</button></form>}
        </div>
      </>
    );
  }
  await audit(admin.email, "sessions.audit.openedLive", id);
  return <LiveRoom sessionId={id} setup={setup} />;
}
