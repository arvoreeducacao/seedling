"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/components/i18n";

export function ResetForm({ token, email }: { token: string; email: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const result = await authClient.resetPassword({ newPassword: String(form.get("password") ?? ""), token });
    if (result.error) {
      setError(result.error.code === "PASSWORD_TOO_SHORT" ? t("server.authShortPassword") : result.error.code === "INVALID_TOKEN" ? t("server.loginResetInvalid") : (result.error.message ?? t("server.authFailed")));
      setBusy(false);
      return;
    }
    window.location.href = "/login?password=changed";
  }

  return (
    <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }} data-el="reset-password">
      <div style={{ fontWeight: 600, fontSize: 15 }}>{t("server.loginResetTitle")}</div>
      <label className="field">
        <span>{t("server.loginEmail")}</span>
        <input className="input input-lg" name="email" type="email" value={email} readOnly autoComplete="username" />
      </label>
      <label className="field">
        <span>{t("server.loginPassword")}</span>
        <input className="input input-lg" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder={t("server.loginPasswordHint")} autoFocus />
      </label>
      {error && <div className="notice notice-err" role="alert">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy} style={{ marginTop: 4 }} data-testid="reset-save">
        {busy ? t("server.loginResetSaving") : t("server.loginResetSave")}
      </button>
    </form>
  );
}
