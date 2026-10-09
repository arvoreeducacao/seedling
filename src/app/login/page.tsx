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

export const metadata: Metadata = { title: "Sign in" };

function signInError(code: string | string[]) {
  const normalized = (Array.isArray(code) ? code.join(" ") : String(code)).toLowerCase();
  if (normalized.includes("signup") || normalized.includes("invite") || normalized.includes("forbidden")) return "This email isn't invited yet. Ask an admin for an invite, then sign in with the same email.";
  if (normalized.includes("email_not_found") || normalized.includes("unable_to_get_user_info")) return "Your provider didn't share a verified email. Make your primary email public or verified and try again.";
  if (normalized.includes("not_linked")) return "An account with this email already exists. Sign in with your password once, then the provider will work.";
  return "Sign-in didn't complete. Try again.";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ requested?: string; error?: string | string[]; invite?: string }> }) {
  const user = await currentUser();
  if (user && (await isAdminEmail(user.email))) redirect("/");
  const params = await searchParams;
  const providers = enabledProviders();
  const invite = typeof params.invite === "string" ? await findInvite(params.invite) : null;
  return (
    <main className="stage" style={{ overflowX: "clip" }}>
      <Starfield stars={150} aurora shooting />
      <div className="fade-in" style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={40} />
        </div>
        {user ? (
          <>
            <h1 className="display stage-title" style={{ marginTop: 40 }}>Almost in</h1>
            <p style={{ marginTop: 20, textAlign: "center", fontSize: 16, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 440 }}>
              You&apos;re signed in as <b>{user.email}</b>, which isn&apos;t on the interviewer list yet.
            </p>
            <Stage style={{ marginTop: 96, width: "100%", maxWidth: 400 }}>
              <Stage.Actor at="top-right" out={0.78} inset={32}><Sprout mood="worried" size={112} /></Stage.Actor>
              <div className="stage-panel" data-testid="no-access">
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 12, background: "var(--warn-soft)", color: "var(--warn)", display: "grid", placeItems: "center", flex: "none" }}><IconLock size={16} /></span>
                  <p className="muted" style={{ lineHeight: 1.6 }}>
                    {params.requested ? "Request sent. An admin will see it under Settings and can add you." : "Ask an admin to add you, or send a request they'll see in Settings."}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
                  {!params.requested && (
                    <form action={requestAccess}>
                      <button className="btn btn-primary btn-lg btn-block">Request access</button>
                    </form>
                  )}
                  <form action="/auth/logout" method="post">
                    <button className="btn btn-lg btn-block">Use a different account</button>
                  </form>
                </div>
              </div>
            </Stage>
          </>
        ) : (
          <>
            <h1 className="display stage-title" style={{ marginTop: 28 }}>Hire people who build with AI</h1>
            <p style={{ marginTop: 20, textAlign: "center", fontSize: 16, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 560 }}>Live coding interviews with Claude in the room. Sign in to run them.</p>
            <Stage style={{ marginTop: 96, width: "100%", maxWidth: 400 }}>
              <Stage.Actor at="top-right" out={0.78} inset={32}><Sprout mood="waving" size={120} /></Stage.Actor>
              <Stage.Actor at="left" out={0.55} inset={60} behind delay={0.3}><CodeCrystal glyph="braces" hue="violet" tilt={-10} size={84} /></Stage.Actor>
              <div className="stage-panel">
                {params.error && <div className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>{signInError(params.error)}</div>}
                {params.invite && !invite && <div className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>This invite link is no longer valid. Ask an admin for a new one.</div>}
                <LoginForm google={providers.google} github={providers.github} invite={invite ? { token: params.invite!, email: invite.email } : null} verifyByEmail={mailConfigured()} />
              </div>
            </Stage>
          </>
        )}
        <p style={{ marginTop: 28, fontSize: 13, textAlign: "center", lineHeight: 1.6, color: "var(--text-3)", maxWidth: 340 }}>
          Taking an interview? Open the link from your invite email. No account needed.
        </p>
      </div>
    </main>
  );
}
