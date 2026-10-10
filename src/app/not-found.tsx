import Link from "next/link";
import { Sprout, Starfield } from "@/components/brand";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="stage" style={{ overflowX: "clip" }}>
      <Starfield stars={120} aurora />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 20 }}>
        <Sprout mood="worried" size={160} />
        <h1 className="display stage-title" style={{ fontSize: "clamp(40px, 5vw, 72px)" }}>{t("server.notFoundTitle")}</h1>
        <p style={{ fontSize: 16, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.6 }}>{t("server.notFoundText")}</p>
        <Link href="/" className="btn btn-primary btn-lg">{t("server.notFoundHome")}</Link>
      </div>
    </main>
  );
}
