// src/services/conversas.service.js — Lógica de negócio para conversas e turnos
import {
  upsertConversa,
  reservarTurno as _reservarTurno,
  concluirTurno,
  buscarContexto,
  encerrarConversa,
} from '../repositories/conversas.repository.js';
import { sanitizar } from '../utils/sanitizacao.js';

export { upsertConversa, concluirTurno, buscarContexto, encerrarConversa };

/**
 * Reserva um turno re-sanitizando a pergunta antes de persistir.
 * Defesa em profundidade: garante que dados pessoais não cheguem ao banco mesmo
 * se o telephony-handler não tiver sanitizado corretamente.
 */
export async function reservarTurno({ conversaId, turnoToken, perguntaSanitizada, textoSuprimido }) {
  // Re-sanitizar no backend como camada de defesa adicional
  let perguntaFinal = perguntaSanitizada ?? null;
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
