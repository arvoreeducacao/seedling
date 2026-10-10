import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { dayOnly } from "@/lib/format";
import { defaultLocale, i18nFor, type Locale } from "@/lib/i18n";

function escape(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function mailConfigured() {
  return Boolean(env.smtpUrl);
}

export type InviteInput = { to: string; url: string; challenges: number; minutes: number; mode: "live" | "async"; expiresAt: Date; locale?: Locale };

export type Message = { subject: string; text: string; html: string };

const frame = (body: string) => `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:520px">\n${body}</div>`;

const button = (url: string, label: string) =>
  `<p><a href="${escape(url)}" style="display:inline-block;background:#2f7d3c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${label}</a></p>`;

export function inviteMessage(input: InviteInput): Message {
  const i18n = i18nFor(input.locale ?? defaultLocale);
  const { t } = i18n;
  const deadline = dayOnly(i18n, input.expiresAt);
  const challenges = t("common.challenges", { n: input.challenges });
  const minutes = t("mail.invite.minutes", { n: input.minutes });
  const how = t(input.mode === "live" ? "mail.invite.howLive" : "mail.invite.howAsync");
  const text = [
    t("mail.invite.greeting", { org: env.orgName }),
    "",
    t("mail.invite.scope", { n: input.challenges, challenges, minutes }),
    how,
    "",
    t("mail.invite.prep"),
    "",
    t("mail.invite.link", { deadline, url: input.url }),
  ].join("\n");
  const html = frame(
    [
      `<p>${t("mail.invite.greeting", { org: escape(env.orgName) })}</p>`,
      `<p>${t("mail.invite.scope", { n: input.challenges, challenges: `<b>${escape(challenges)}</b>`, minutes: `<b>${escape(minutes)}</b>` })}</p>`,
      `<p>${escape(how)}</p>`,
      `<p>${t("mail.invite.prep")}</p>`,
      button(input.url, t("mail.invite.cta")),
      `<p style="color:#666;font-size:12px">${t("mail.invite.validity", { deadline: escape(deadline) })}</p>`,
    ].join("\n"),
  );
  return { subject: t("mail.invite.subject", { org: env.orgName }), text, html };
}

export function verificationMessage(input: { url: string; locale?: Locale }): Message {
  const { t } = i18nFor(input.locale ?? defaultLocale);
  const text = [t("mail.verify.textLead", { org: env.orgName }), "", input.url, "", t("mail.verify.ignore")].join("\n");
  const html = frame(
    [
      `<p>${t("mail.verify.htmlLead", { org: escape(env.orgName) })}</p>`,
      button(input.url, t("mail.verify.cta")),
      `<p style="color:#666;font-size:12px">${t("mail.verify.ignore")}</p>`,
    ].join("\n"),
  );
  return { subject: t("mail.verify.subject", { org: env.orgName }), text, html };
}

async function send(to: string, message: Message) {
  const transport = nodemailer.createTransport(env.smtpUrl);
  await transport.sendMail({ from: env.mailFrom, to, ...message });
  return true;
}

export async function sendInvite(input: InviteInput) {
  if (!env.smtpUrl) return false;
  return send(input.to, inviteMessage(input));
}

export async function sendVerification(input: { to: string; url: string; locale?: Locale }) {
  if (!env.smtpUrl) return false;
  return send(input.to, verificationMessage(input));
}
