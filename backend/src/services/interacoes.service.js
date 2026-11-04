import { interacoesRepository } from '../repositories/interacoes.repository.js';
import { createError } from '../middlewares/errorHandler.js';
import { contemPII } from '../schemas/interacao.schema.js';

export const interacoesService = {
  /**
   * Registra uma interação de voz.
   *
   * Rejeita com 422 se pergunta ou resposta contiverem CPF ou telefone.
   * Isso implementa o requisito de histórico estritamente anônimo (competição IBM).
   */
  async registrar({
    campanha_id,
    pergunta,
    resposta,
    score_confianca_stt,
    score_confianca_agente,
    sem_resposta,
    call_sid,
  }) {
    if (contemPII(pergunta)) {
      throw createError(422, 'Payload contém dado pessoal identificável (pergunta)');
    }
    if (contemPII(resposta)) {
      throw createError(422, 'Payload contém dado pessoal identificável (resposta)');
    }

    return interacoesRepository.criar({
      campanhaId: campanha_id,
      pergunta,
      resposta: sem_resposta ? null : (resposta ?? null),
      scoreConfiancaStt: score_confianca_stt ?? null,
      scoreConfiancaAgente: score_confianca_agente ?? null,
      semResposta: sem_resposta ?? false,
      callSid: call_sid,
    });
  },
};
