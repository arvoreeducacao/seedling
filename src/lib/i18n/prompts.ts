import { interpolate } from ".";
import { defaultLocale, type Locale, type Params } from "./types";

const bundles = {
  en: {
    "defense.system":
      "You help technical interviewers. From the log of a session in which a candidate used AI, write exactly 3 short questions for the follow-up conversation, each tied to something concrete that happened in the log. One question per line, no numbering, no extra text. Write the questions in English.",
    "defense.challenge": "Challenge {n}: {title}. Hidden tests: {passed}/{total}. Expected traps: {traps}.",
    "defense.noTraps": "none listed",
    "defense.requests": "Requests to Claude, in order:",
    "defense.events": "Relevant events:",
  },
  pt: {
    "defense.system":
      "Você ajuda entrevistadores técnicos. A partir do log de uma sessão em que um candidato usou IA, escreva exatamente 3 perguntas curtas para a conversa depois da entrevista, cada uma ligada a algo concreto que aconteceu no log. Uma pergunta por linha, sem numeração, sem texto extra. Escreva as perguntas em português do Brasil.",
    "defense.challenge": "Desafio {n}: {title}. Testes ocultos: {passed}/{total}. Armadilhas esperadas: {traps}.",
    "defense.noTraps": "nenhuma listada",
    "defense.requests": "Pedidos ao Claude, em ordem:",
    "defense.events": "Eventos relevantes:",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type PromptKey = keyof (typeof bundles)[typeof defaultLocale];

export function prompts(locale: Locale) {
  const bundle = bundles[locale] ?? bundles[defaultLocale];
  return (key: PromptKey, params?: Params) => interpolate(bundle[key] ?? bundles[defaultLocale][key], params);
}
