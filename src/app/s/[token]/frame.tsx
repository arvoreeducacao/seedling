import Link from "next/link";
import { env } from "@/lib/env";
import ui from "@/components/workspace/ui.module.css";
import { Logo, Starfield } from "@/components/brand";
import type { I18n } from "@/lib/i18n";
import css from "./landing.module.css";
import prep from "./prep.module.css";

export type FrameNav = { token: string; active: "prepare" | "interview"; done?: number; total?: number };

export function Frame({ i18n, children, email, nav }: { i18n: I18n; children: React.ReactNode; email?: string; nav?: FrameNav }) {
  const { t } = i18n;
  return (
    <div className={`${ui.root} ${css.page}`}>
      <div className={css.sky} aria-hidden="true"><Starfield stars={150} aurora shooting /></div>
      <header className={css.top}>
        <Logo size={32} />
        {env.orgName !== "Seedling" && <span className={`${ui.faint} ${prep.org}`} style={{ fontSize: 13 }}>{t("candidate.forOrg", { org: env.orgName })}</span>}
        {nav && (
          <nav className={prep.nav} aria-label={t("candidate.nav.label")} data-el="candidate-nav">
            <Link href={`/s/${nav.token}/prepare`} className={prep.navItem} aria-current={nav.active === "prepare" ? "page" : undefined}>
              {t("candidate.nav.prepare")}
              {nav.total ? <span className={prep.navCount}>{Math.round(((nav.done ?? 0) / nav.total) * 100)}%</span> : null}
            </Link>
            <Link href={`/s/${nav.token}`} className={prep.navItem} aria-current={nav.active === "interview" ? "page" : undefined}>{t("candidate.nav.interview")}</Link>
          </nav>
        )}
        {email && <span className={`${ui.faint} ${prep.email}`}>{email}</span>}
      </header>
      {children}
    </div>
  );
}
