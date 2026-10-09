import { notFound, redirect } from "next/navigation";
import { audit, requireAdmin } from "@/lib/auth";
import { sessionDetail } from "@/lib/sessions";
import { PageHeader } from "@/components/page-header";
import { LiveRoom } from "@/components/live-room";
import { displayName } from "@/lib/format";
import { endSession } from "../actions";
import { setupView } from "@/lib/setup/store";
import { SetupSummary } from "@/components/setup/setup-summary";
import { PrepSummary } from "@/components/prep-summary";

function inDays(date: Date) {
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const detail = await sessionDetail(id);
  if (!detail) notFound();
  const { session } = detail;
  const setup = await setupView(id);
  if (session.status === "submitted" || session.status === "expired") redirect(`/sessions/${id}/report`);
  if (session.status === "invited" || session.status === "cancelled") {
    return (
      <>
        <PageHeader crumb="Sessions" crumbHref="/sessions" title={displayName(session.candidateEmail, session.candidateName)} extra={<span className="pill">{session.status === "invited" ? "Invite sent" : "Cancelled"}</span>} />
        <div style={{ padding: 24, maxWidth: 1080, display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="muted">{session.status === "invited" ? `${session.candidateEmail} hasn't started yet.${session.scheduledAt ? ` The interview is set for ${session.scheduledAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : ""} The invite expires ${inDays(session.inviteExpiresAt)}.` : "This invite was cancelled."}</p>
          {session.status === "invited" && <PrepSummary sessionId={session.id} />}
          <SetupSummary view={setup} />
          <div className="notice" style={{ background: "var(--surface-2)", color: "var(--text-2)", maxWidth: 640 }}>The invite link is shown only once, when it is created. To send it again, create a new invite.</div>
          {session.status === "invited" && <form action={endSession.bind(null, id)}><button className="btn btn-danger">Cancel invite</button></form>}
        </div>
      </>
    );
  }
  await audit(admin.email, "opened live view", id);
  return <LiveRoom sessionId={id} setup={setup} />;
}
