import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconLock } from "@/components/icons";
import { CodeCrystal, Logo, Sprout, Stage, Starfield } from "@/components/brand";
import { currentUser, isAdminEmail } from "@/lib/auth";
import { enabledProviders } from "@/lib/better-auth";
import { LoginForm } from "./login-form";
import { requestAccess } from "./actions";
import { findInvite } from "@/lib/admin-invites";
import { mailConfigured } from "@/lib/mail";
import { getI18n } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("server.loginTitle") };
}

function signInError(t: T, code: string | string[]) {
  const normalized = (Array.isArray(code) ? code.join(" ") : String(code)).toLowerCase();
  if (normalized.includes("signup") || normalized.includes("invite") || normalized.includes("forbidden")) return t("server.loginNotInvited");
  if (normalized.includes("email_not_found") || normalized.includes("unable_to_get_user_info")) return t("server.loginNoEmail");
  if (normalized.includes("not_linked")) return t("server.loginNotLinked");
  return t("server.loginFailed");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ requested?: string; error?: string | string[]; invite?: string }> }) {
  const { t } = await getI18n();
  const user = await currentUser();
  if (user && (await isAdminEmail(user.email))) redirect("/");
  const params = await searchParams;
  const providers = enabledProviders();
  const invite = typeof params.invite === "string" ? await findInvite(params.invite) : null;
  const [beforeEmail, afterEmail] = t("server.loginNotOnList").split("{email}");
  return (
    <main className="stage" style={{ overflowX: "clip" }}>
      <Starfield stars={150} aurora shooting />
      <div className="fade-in" style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={40} />
        </div>
        {user ? (
          <>
            <h1 className="display stage-title" style={{ marginTop: 40 }}>{t("server.loginAlmostIn")}</h1>
            <p style={{ marginTop: 20, textAlign: "center", fontSize: 16, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 440 }}>
              {beforeEmail}<b>{user.email}</b>{afterEmail}
            </p>
            <Stage style={{ marginTop: 96, width: "100%", maxWidth: 400 }}>
              <Stage.Actor at="top-right" out={0.78} inset={32}><Sprout mood="worried" size={112} /></Stage.Actor>
              <div className="stage-panel" data-testid="no-access">
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 12, background: "var(--warn-soft)", color: "var(--warn)", display: "grid", placeItems: "center", flex: "none" }}><IconLock size={16} /></span>
                  <p className="muted" style={{ lineHeight: 1.6 }}>
                    {params.requested ? t("server.loginRequestSent") : t("server.loginAskAdmin")}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
                  {!params.requested && (
                    <form action={requestAccess}>
                      <button className="btn btn-primary btn-lg btn-block">{t("server.loginRequestAccess")}</button>
                    </form>
                  )}
                  <form action="/auth/logout" method="post">
                    <button className="btn btn-lg btn-block">{t("server.loginUseAnother")}</button>
                  </form>
                </div>
              </div>
            </Stage>
          </>
        ) : (
          <>
            <h1 className="display stage-title" style={{ marginTop: 28 }}>{t("server.loginHeadline")}</h1>
            <p style={{ marginTop: 20, textAlign: "center", fontSize: 16, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 560 }}>{t("server.loginSub")}</p>
            <Stage style={{ marginTop: 96, width: "100%", maxWidth: 400 }}>
              <Stage.Actor at="top-right" out={0.78} inset={32}><Sprout mood="waving" size={120} /></Stage.Actor>
              <Stage.Actor at="left" out={0.55} inset={60} behind delay={0.3}><CodeCrystal glyph="braces" hue="violet" tilt={-10} size={84} /></Stage.Actor>
              <div className="stage-panel">
                {params.error && <div className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>{signInError(t, params.error)}</div>}
                {params.invite && !invite && <div className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>{t("server.loginInviteInvalid")}</div>}
                <LoginForm google={providers.google} github={providers.github} invite={invite ? { token: params.invite!, email: invite.email } : null} verifyByEmail={mailConfigured()} />
              </div>
            </Stage>
          </>
        )}
        <p style={{ marginTop: 28, fontSize: 13, textAlign: "center", lineHeight: 1.6, color: "var(--text-3)", maxWidth: 340 }}>
          {t("server.loginCandidateHint")}
        </p>
      </div>
    </main>
  );
}
