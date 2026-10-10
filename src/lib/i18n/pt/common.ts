import type { Translation } from "../types";
import type { common as En } from "../en/common";

export const common: Translation<typeof En> = {
  "app.title": "Seedling",
  "app.description": "Entrevistas de código para engenheiros que trabalham com agentes de IA",
  "app.tagline": "Entrevista de código ao vivo, com o Claude Code na sala.",

  "common.save": "Salvar",
  "common.saved": "Salvo",
  "common.saving": "Salvando…",
  "common.delete": "Apagar",
  "common.remove": "Remover",
  "common.send": "Enviar",
  "common.back": "Voltar",
  "common.open": "Abrir",
  "common.copied": "Copiado",
  "common.retry": "Tentar de novo",
  "common.signOut": "Sair",
  "common.minutes": "min",
  "common.none": "-",
  "common.challenges": "{n} desafio|{n} desafios",

  "level.junior": "Júnior",
  "level.pleno": "Pleno",
  "level.senior": "Sênior",
  "kind.code.title": "Código",

  "date.today": "hoje",
  "date.tomorrow": "amanhã",
  "date.inDays": "em {n} dia|em {n} dias",
  "date.todayAt": "hoje, {time}",
  "date.expiresIn": "vence {when}",

  "sessionStatus.invited": "Convidado",
  "sessionStatus.running": "Ao vivo",
  "sessionStatus.paused": "Desconectado",
  "sessionStatus.submitted": "Para avaliar",
  "sessionStatus.expired": "Tempo acabou",
  "sessionStatus.cancelled": "Cancelado",

  "decision.advance": "Avançar",
  "decision.talk": "Conversar",
  "decision.reject": "Não avança",
  "decision.advanced": "Avançou",
  "decision.talked": "Conversar",
  "decision.rejected": "Não avança",

  "error.unauthorized": "não autorizado",
  "error.notFound": "não encontrado",
  "error.badBody": "corpo inválido",
  "error.badPath": "caminho inválido",
  "error.unexpected": "Algo deu errado.",
};
