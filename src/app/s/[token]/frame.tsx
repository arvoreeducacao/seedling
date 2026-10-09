import Link from "next/link";
import { env } from "@/lib/env";
import ui from "@/components/workspace/ui.module.css";
import { Logo, Starfield } from "@/components/brand";
import css from "./landing.module.css";
import prep from "./prep.module.css";

export type FrameNav = { token: string; active: "prepare" | "interview"; done?: number; total?: number };

export function Frame({ children, email, nav }: { children: React.ReactNode; email?: string; nav?: FrameNav }) {
  return (
    <div className={`${ui.root} ${css.page}`}>
      <div className={css.sky} aria-hidden="true"><Starfield stars={150} aurora shooting /></div>
      <header className={css.top}>
        <Logo size={32} />
        {env.orgName !== "Seedling" && <span className={`${ui.faint} ${prep.org}`} style={{ fontSize: 13 }}>for {env.orgName}</span>}
        {nav && (
          <nav className={prep.nav} aria-label="Interview sections" data-el="candidate-nav">
            <Link href={`/s/${nav.token}/prepare`} className={prep.navItem} aria-current={nav.active === "prepare" ? "page" : undefined}>
              Prepare
              {nav.total ? <span className={prep.navCount}>{Math.round(((nav.done ?? 0) / nav.total) * 100)}%</span> : null}
            </Link>
            <Link href={`/s/${nav.token}`} className={prep.navItem} aria-current={nav.active === "interview" ? "page" : undefined}>Interview</Link>
          </nav>
        )}
        {email && <span className={`${ui.faint} ${prep.email}`}>{email}</span>}
      </header>
      {children}
    </div>
  );
}
