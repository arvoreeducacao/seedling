import Link from "next/link";

type Props = { title: React.ReactNode; crumb?: React.ReactNode; crumbHref?: string; sub?: React.ReactNode; extra?: React.ReactNode; actions?: React.ReactNode; large?: boolean; wide?: boolean };

function Slash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" style={{ opacity: 0.5 }}><path d="M15 4 9 20" /></svg>;
}

export function PageHeader({ title, crumb, crumbHref, sub, extra, actions, wide }: Props) {
  return (
    <header className="page-header has-inner">
      <div className="page-header-inner" style={wide ? { maxWidth: "none", padding: "0 32px" } : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          {crumb && (
            <>
              {crumbHref ? <Link href={crumbHref} className="crumb">{crumb}</Link> : <span className="crumb">{crumb}</span>}
              <span className="faint" style={{ display: "flex", flex: "none" }}><Slash /></span>
            </>
          )}
          <h1 className="page-title truncate" style={{ flex: "0 1 auto" }}>{title}</h1>
          {sub && <span className="page-sub truncate" style={{ flex: "0 1 auto" }}>{sub}</span>}
          {extra}
        </div>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>{actions}</div>}
      </div>
    </header>
  );
}
