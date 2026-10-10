import { getI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <>
      <header className="page-header has-inner">
        <div className="page-header-inner"><div className="skeleton" style={{ width: 160, height: 18 }} /></div>
      </header>
      <div className="shell shell-body" aria-busy="true" aria-label={t("shell.loading")}>
        <div className="skeleton" style={{ height: 180, borderRadius: "var(--r-xl)" }} />
        <div className="metrics">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 104, borderRadius: "var(--r-lg)" }} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 56, opacity: 1 - i * 0.15 }} />)}
        </div>
      </div>
    </>
  );
}
