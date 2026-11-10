// src/services/conversas.service.js — Lógica de negócio para conversas e turnos
import {
  upsertConversa,
  reservarTurno as _reservarTurno,
  concluirTurno as _concluirTurno,
  buscarContexto,
  encerrarConversa,
} from '../repositories/conversas.repository.js';
import { sanitizar } from '../utils/sanitizacao.js';
import { classificar } from '../nlu/classificador.js';
import { env } from '../config/env.js';

export { upsertConversa, buscarContexto, encerrarConversa };

/**
 * Reserva um turno re-sanitizando a pergunta antes de persistir.
 * Depois da sanitização, classifica a matéria com NLU local (se habilitado).
 * Defesa em profundidade: garante que dados pessoais não cheguem ao banco mesmo
 * se o telephony-handler não tiver sanitizado corretamente.
 */
export async function reservarTurno({ conversaId, turnoToken, perguntaSanitizada, textoSuprimido }) {
  // Re-sanitizar no backend como camada de defesa adicional
  let perguntaFinal = textoSuprimido ? null : (perguntaSanitizada ?? null);
  let suprimidoFinal = textoSuprimido ?? false;

  if (perguntaFinal !== null && !suprimidoFinal) {
    const { texto, suprimido } = sanitizar(perguntaFinal);
    if (suprimido) {
      perguntaFinal = null;
      suprimidoFinal = true;
    } else {
      perguntaFinal = texto;
    }
  }

  // Classificar após sanitização, antes da reserva no banco.
  // Turnos suprimidos, vazios ou com recurso desativado ficam com null.
  let classificacaoStatus = null;
  let materiaClassificada = null;
  let classificacaoVersao = null;

  if (env.NLU_CLASSIFICACAO_HABILITADA && perguntaFinal && !suprimidoFinal) {
    const resultado = classificar(perguntaFinal);
    classificacaoStatus = resultado.status;
    materiaClassificada = resultado.materia;
    classificacaoVersao = resultado.versao;
  }

  return _reservarTurno({
    conversaId,
    turnoToken,
    perguntaSanitizada: perguntaFinal,
    textoSuprimido: suprimidoFinal,
    classificacaoStatus,
    materiaClassificada,
    classificacaoVersao,
  });
}

// Aplica a mesma proteção às saídas, inclusive em clientes legados.
export async function concluirTurno(params) {
  const resposta = sanitizar(params.resposta);
  const mensagem = sanitizar(params.mensagemRetorno);
  const suprimido = params.textoSuprimido || resposta.suprimido || mensagem.suprimido;
  return _concluirTurno({
    ...params,
    resposta: suprimido ? null : resposta.texto,
    mensagemRetorno: mensagem.suprimido ? 'Pode reformular sua pergunta sem dados pessoais?' : (mensagem.texto ?? ''),
    textoSuprimido: !!suprimido,
    status: suprimido && params.status === 'RESPONDIDO' ? 'SEM_RESPOSTA' : params.status,
    semResposta: suprimido || params.semResposta,
  });
}
