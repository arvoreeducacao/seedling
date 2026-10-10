import { redirect } from "next/navigation";
import { Flask } from "@phosphor-icons/react/dist/ssr";
import { candidateSession } from "@/lib/candidate";
import { Workspace } from "@/components/workspace/workspace";
import { getI18n } from "@/lib/i18n/server";
import { isPlayground } from "@/lib/prep/playground";
import prep from "../prep.module.css";

export default async function WorkspacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session) redirect(`/s/${token}`);
  if (session.status !== "running") redirect(`/s/${token}/fim`);
  const { t } = await getI18n();
  return (
    <>
      <Workspace token={token} sessionId={session.id} />
      {session.practiceOf && <div className={prep.practiceRibbon} role="status" data-el="practice-ribbon"><Flask size={13} weight="fill" /> {t(isPlayground(session) ? "workspace.playgroundRibbon" : "workspace.practiceRibbon")}</div>}
    </>
  );
}
