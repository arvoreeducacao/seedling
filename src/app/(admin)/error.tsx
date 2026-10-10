"use client";

import Link from "next/link";
import { Sprout } from "@/components/brand";
import { useI18n } from "@/components/i18n";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="shell shell-body" style={{ alignItems: "center", textAlign: "center", paddingTop: 96 }}>
      <Sprout mood="worried" size={160} />
      <div>
        <h1 className="display" style={{ fontSize: 36 }}>{t("shell.errorTitle")}</h1>
        <p className="muted" style={{ marginTop: 12, maxWidth: "52ch", lineHeight: 1.6 }}>{t("shell.errorText")}{error.digest ? <> {t("shell.errorDigest", { digest: "" })}<span className="mono">{error.digest}</span></> : null}.</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary btn-lg" onClick={reset}>{t("common.retry")}</button>
        <Link href="/" className="btn btn-lg">{t("shell.backToOverview")}</Link>
      </div>
    </div>
  );
}
