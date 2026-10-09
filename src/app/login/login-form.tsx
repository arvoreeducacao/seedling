"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

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

const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
  USER_ALREADY_EXISTS: "An account with this email already exists. Sign in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists. Sign in instead.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters for the password.",
  EMAIL_NOT_VERIFIED: "Confirm your email first. We sent you a new link.",
  SIGNUP_CLOSED: "This workspace is invite-only. Ask an admin for an invite link.",
};

export function LoginForm({ google, github, invite, verifyByEmail }: { google: boolean; github: boolean; invite: { token: string; email: string | null } | null; verifyByEmail: boolean }) {
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
      setError(messages[result.error.code ?? ""] ?? result.error.message ?? "Couldn't sign you in. Try again.");
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
              {busy === "google" ? "Redirecting…" : "Continue with Google"}
            </button>
          )}
          {github && (
            <button type="button" data-testid="login-github" className="btn btn-lg btn-block" disabled={busy !== null} onClick={() => social("github")}>
              <GithubMark />
              {busy === "github" ? "Redirecting…" : "Continue with GitHub"}
            </button>
          )}
        </div>
      )}
      {(google || github) && <div className="or-divider">or</div>}
      <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <label className="field">
            <span>Name</span>
            <input className="input input-lg" name="name" autoComplete="name" placeholder="Ada Lovelace" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input input-lg" name="email" type="email" required autoComplete="email" placeholder="you@company.com" defaultValue={invite?.email ?? undefined} readOnly={Boolean(invite?.email) && mode === "signup"} />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input input-lg" name="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "At least 8 characters" : undefined} />
        </label>
        {mode === "signup" && !invite && !verifyByEmail && <div className="notice" role="note">New interviewer accounts are created from an invite link an admin sends you.</div>}
        {sent && <div className="notice notice-accent" role="status">Check {sent} for a link to confirm your email, then sign in.</div>}
        {error && <div className="notice notice-err" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy !== null} style={{ marginTop: 4 }} data-testid="login-email">
          {busy === "email" ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="faint" style={{ textAlign: "center", fontSize: 12.5 }}>
        {mode === "signin" ? "No account yet? " : "Already have an account? "}
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }} style={{ background: "none", border: 0, padding: 0, color: "var(--text)", fontWeight: 500 }} className="hover:underline">
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
