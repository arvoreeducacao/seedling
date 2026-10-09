import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/brand";
import { BringYourSetup } from "@/components/setup/bring-your-setup";
import { setupAccess } from "@/lib/setup/access";
import ui from "@/components/workspace/ui.module.css";
import css from "../landing.module.css";

export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await setupAccess(token);
  if (!access) notFound();
  if (!access.editable && access.session.status === "running") redirect(`/s/${token}/w`);
  return (
    <div className={`${ui.root} ${css.page}`}>
      <header className={css.top}>
        <Logo size={32} />
        <span className={ui.faint} style={{ marginLeft: "auto" }}>{access.session.candidateEmail}</span>
      </header>
      <main style={{ maxWidth: 1160, width: "100%", margin: "0 auto", padding: "8px 32px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
        <Link href={`/s/${token}`} className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} style={{ alignSelf: "flex-start", textDecoration: "none" }}><ArrowLeft size={12} /> Back to your invite</Link>
        <div>
          <h1 className={css.display} style={{ fontSize: 30, lineHeight: 1.1, margin: 0 }}>Bring your setup</h1>
          <p className={css.lead} style={{ maxWidth: 680 }}>Work the way you usually do. Add the skills, CLAUDE.md and remote MCP servers you use with Claude Code, and they are installed in your sandbox when you press Start. This is optional and you can change it until then.</p>
        </div>
        <BringYourSetup token={token} />
      </main>
    </div>
  );
}
