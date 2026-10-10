"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/components/i18n";
import type { Key } from "@/lib/i18n";

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5Z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5Z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
      <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1Z" />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.8 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const messages: Record<string, Key> = {
  INVALID_EMAIL_OR_PASSWORD: "server.authBadCredentials",
  USER_ALREADY_EXISTS: "server.authExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "server.authExists",
  PASSWORD_TOO_SHORT: "server.authShortPassword",
  EMAIL_NOT_VERIFIED: "server.authNotVerified",
  SIGNUP_CLOSED: "server.authSignupClosed",
};

export function LoginForm({ google, github, invite, verifyByEmail }: { google: boolean; github: boolean; invite: { token: string; email: string | null } | null; verifyByEmail: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">(invite ? "signup" : "signin");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "email" | "google" | "github">(null);

  async function submit(form: FormData) {
    setBusy("email");
    setError(null);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim() || email.split("@")[0];
    const result =
      mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name, fetchOptions: invite ? { headers: { "x-seedling-invite": invite.token } } : undefined });
    if (result.error) {
      const known = messages[result.error.code ?? ""];
      setError(known ? t(known) : (result.error.message ?? t("server.authFailed")));
      setBusy(null);
      return;
    }
    if (mode === "signup" && !(result.data && "token" in result.data && result.data.token)) {
      setSent(email);
      setBusy(null);
      return;
    }
    window.location.href = "/";
  }

  async function social(provider: "google" | "github") {
    setBusy(provider);
    await authClient.signIn.social({ provider, callbackURL: "/", errorCallbackURL: "/login" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(google || github) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {google && (
            <button type="button" data-testid="login-google" className="btn btn-white btn-lg btn-block" disabled={busy !== null} onClick={() => social("google")}>
              <GoogleMark />
              {busy === "google" ? t("server.loginRedirecting") : t("server.loginGoogle")}
            </button>
          )}
          {github && (
            <button type="button" data-testid="login-github" className="btn btn-lg btn-block" disabled={busy !== null} onClick={() => social("github")}>
              <GithubMark />
              {busy === "github" ? t("server.loginRedirecting") : t("server.loginGithub")}
            </button>
          )}
        </div>
      )}
      {(google || github) && <div className="or-divider">{t("server.loginOr")}</div>}
      <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <label className="field">
            <span>{t("server.loginName")}</span>
            <input className="input input-lg" name="name" autoComplete="name" placeholder="Ada Lovelace" />
          </label>
        )}
        <label className="field">
          <span>{t("server.loginEmail")}</span>
          <input className="input input-lg" name="email" type="email" required autoComplete="email" placeholder={t("server.loginEmailPlaceholder")} defaultValue={invite?.email ?? undefined} readOnly={Boolean(invite?.email) && mode === "signup"} />
        </label>
        <label className="field">
          <span>{t("server.loginPassword")}</span>
          <input className="input input-lg" name="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder={mode === "signup" ? t("server.loginPasswordHint") : undefined} />
        </label>
        {mode === "signup" && !invite && !verifyByEmail && <div className="notice" role="note">{t("server.loginInviteOnly")}</div>}
        {sent && <div className="notice notice-accent" role="status">{t("server.loginCheckEmail", { email: sent })}</div>}
        {error && <div className="notice notice-err" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy !== null} style={{ marginTop: 4 }} data-testid="login-email">
          {busy === "email" ? (mode === "signin" ? t("server.loginSigningIn") : t("server.loginCreating")) : mode === "signin" ? t("server.loginSignIn") : t("server.loginCreateAccount")}
        </button>
      </form>
      <p className="faint" style={{ textAlign: "center", fontSize: 12.5 }}>
        {mode === "signin" ? t("server.loginNoAccount") : t("server.loginHaveAccount")}
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }} style={{ background: "none", border: 0, padding: 0, color: "var(--text)", fontWeight: 500 }} className="hover:underline">
          {mode === "signin" ? t("server.loginCreateOne") : t("server.loginSignIn")}
        </button>
      </p>
    </div>
  );
}
