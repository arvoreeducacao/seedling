"use client";

import { useEffect } from "react";
import { Sprout } from "@/components/brand";
import { useI18n } from "@/components/i18n";
import ui from "@/components/workspace/ui.module.css";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className={`${ui.root} ${ui.loading}`}>
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
        <Sprout mood="worried" size={96} />
        <div className={ui.modalTitle} style={{ fontSize: 17 }}>{t("workspace.errorTitle")}</div>
        <p className={ui.muted} style={{ margin: 0, lineHeight: 1.6 }}>{t("workspace.errorText")}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => location.reload()}>{t("workspace.reload")}</button>
          <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={reset}>{t("common.retry")}</button>
        </div>
      </div>
    </div>
  );
}
