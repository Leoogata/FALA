// src/services/conversas.service.js — Lógica de negócio para conversas e turnos
import {
  upsertConversa,
  reservarTurno as _reservarTurno,
  concluirTurno as _concluirTurno,
  buscarContexto,
  encerrarConversa,
} from '../repositories/conversas.repository.js';
import { sanitizar } from '../utils/sanitizacao.js';

export { upsertConversa, buscarContexto, encerrarConversa };

/**
 * Reserva um turno re-sanitizando a pergunta antes de persistir.
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

  return _reservarTurno({
    conversaId,
    turnoToken,
    perguntaSanitizada: perguntaFinal,
    textoSuprimido: suprimidoFinal,
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
