import nodemailer from "nodemailer";
import { env } from "@/lib/env";

function escape(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function mailConfigured() {
  return Boolean(env.smtpUrl);
}

export async function sendInvite(input: { to: string; url: string; challenges: number; minutes: number; mode: "live" | "async"; expiresAt: Date }) {
  if (!env.smtpUrl) return false;
  const transport = nodemailer.createTransport(env.smtpUrl);
  const deadline = input.expiresAt.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", timeZone: process.env.NEXT_PUBLIC_SEEDLING_TIMEZONE || undefined });
  const how = input.mode === "live" ? "Agree on a time with the person who invited you and open the link when the call starts." : "Open the link on a computer when you are ready. The clock only starts when you click Start.";
  const text = [
    `Hi! You have been invited to a coding interview with ${env.orgName}.`,
    "",
    `There ${input.challenges === 1 ? "is 1 challenge" : `are ${input.challenges} challenges`}, about ${input.minutes} minutes. You can use Claude, which we make available during the session.`,
    how,
    "",
    "Before the interview, the same link opens your prep space: how the team works, what to read, and a place to bring your own Claude Code setup.",
    "",
    `Link (valid until ${deadline}): ${input.url}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:520px">
<p>Hi! You have been invited to a coding interview with ${escape(env.orgName)}.</p>
<p>There ${input.challenges === 1 ? "is <b>1 challenge</b>" : `are <b>${input.challenges} challenges</b>`}, about <b>${input.minutes} minutes</b>. You can use Claude, which we make available during the session.</p>
<p>${escape(how)}</p>
<p>Before the interview, the same link opens your prep space: how the team works, what to read, and a place to bring your own Claude Code setup.</p>
<p><a href="${escape(input.url)}" style="display:inline-block;background:#2f7d3c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open the session</a></p>
<p style="color:#666;font-size:12px">The link is valid until ${escape(deadline)}. Once you press Start, it only works in that browser.</p></div>`;
  await transport.sendMail({ from: env.mailFrom, to: input.to, subject: `Your coding interview with ${env.orgName}`, text, html });
  return true;
}

export async function sendVerification(input: { to: string; url: string }) {
  if (!env.smtpUrl) return false;
  const transport = nodemailer.createTransport(env.smtpUrl);
  const text = [`Confirm your email to finish creating your ${env.orgName} interviewer account:`, "", input.url, "", "If you did not try to sign up, ignore this message."].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:520px">
<p>Confirm your email to finish creating your ${escape(env.orgName)} interviewer account.</p>
<p><a href="${escape(input.url)}" style="display:inline-block;background:#2f7d3c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Confirm email</a></p>
<p style="color:#666;font-size:12px">If you did not try to sign up, ignore this message.</p></div>`;
  await transport.sendMail({ from: env.mailFrom, to: input.to, subject: `Confirm your email for ${env.orgName}`, text, html });
  return true;
}
