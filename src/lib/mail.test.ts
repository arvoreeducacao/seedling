import { describe, expect, it } from "vitest";
import { inviteMessage } from "./mail";

const base = { to: "ada@example.com", url: "https://seedling.test/s/inv_abc", minutes: 60, mode: "live" as const, expiresAt: new Date("2026-03-12T12:00:00Z") };

describe("invite email", () => {
  it("writes the whole message in English", () => {
    const mail = inviteMessage({ ...base, challenges: 3 });
    expect(mail.subject).toBe("Your coding interview with Seedling");
    expect(mail.text).toContain("You have been invited to a coding interview");
    expect(mail.text).toContain("There are 3 challenges, about 60 minutes.");
    expect(mail.text).toContain("Agree on a time with the person who invited you");
    expect(mail.html).toContain("<b>3 challenges</b>");
    expect(mail.html).toContain("Open the session");
  });

  it("writes the whole message in Portuguese", () => {
    const mail = inviteMessage({ ...base, challenges: 3, locale: "pt" });
    expect(mail.subject).toBe("Sua entrevista de código com Seedling");
    expect(mail.text).toContain("Você foi convidado para uma entrevista de código");
    expect(mail.text).toContain("São 3 desafios, cerca de 60 minutos.");
    expect(mail.text).toContain("Combine o horário com quem te convidou");
    expect(mail.html).toContain("<b>3 desafios</b>");
    expect(mail.html).toContain("Abrir a sessão");
    expect(mail.text).not.toContain("challenge");
    expect(mail.html).not.toContain("challenge");
  });

  it("carries the link in the text and in the button of both languages", () => {
    for (const locale of ["en", "pt"] as const) {
      const mail = inviteMessage({ ...base, challenges: 1, locale });
      expect(mail.text).toContain(base.url);
      expect(mail.html).toContain(`href="${base.url}"`);
    }
  });

  it("says one challenge in the singular", () => {
    const english = inviteMessage({ ...base, challenges: 1 });
    expect(english.text).toContain("There is 1 challenge, about 60 minutes.");
    expect(english.html).toContain("<b>1 challenge</b>");
    const portuguese = inviteMessage({ ...base, challenges: 1, locale: "pt" });
    expect(portuguese.text).toContain("É 1 desafio, cerca de 60 minutos.");
    expect(portuguese.html).toContain("<b>1 desafio</b>");
  });

  it("follows the locale in the deadline and in the take-home wording", () => {
    const english = inviteMessage({ ...base, challenges: 2, mode: "async" });
    expect(english.text).toContain("Open the link on a computer when you are ready.");
    expect(english.text).toContain("Thu, Mar 12");
    const portuguese = inviteMessage({ ...base, challenges: 2, mode: "async", locale: "pt" });
    expect(portuguese.text).toContain("Abra o link num computador quando estiver pronto.");
    expect(portuguese.text).toContain("qui.");
  });
});
