// Compatibilidade com a ingestão antiga, usando o mesmo histórico de conversas.
import { createHmac, randomUUID } from 'node:crypto';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { upsertConversa, reservarTurno, concluirTurno } from '../services/conversas.service.js';

const MATERIAS = new Set(['historia', 'geografia', 'portugues', 'matematica', 'ciencias']);

export const interacoesRepository = {
  async criar({ campanhaId, pergunta, resposta, scoreConfiancaStt, scoreConfiancaAgente, semResposta, callSid }) {
    const agora = new Date();
    const campanha = await prisma.campanha.findFirst({
      // A ingestão legada só resolve conteúdo geral; slugs escolares podem se repetir.
      where: { escolaId: null, OR: [{ id: campanhaId }, { slug: campanhaId }] },
      select: { id: true, slug: true },
    });
    const materia = campanha?.slug ?? campanhaId;
    const chave = createHmac('sha256', env.INTERNAL_API_KEY).update(`legacy-call:${callSid}`).digest('hex');
    const conversa = await upsertConversa({ chaveChamada: `legacy:${chave}`, versaoChave: 'legacy-v1' });
    const turnoToken = randomUUID();
    const turno = await reservarTurno({
      conversaId: conversa.id, turnoToken, perguntaSanitizada: pergunta, textoSuprimido: false,
    });
    await concluirTurno({
      conversaId: conversa.id, turnoToken,
      campanhaId: campanha?.id ?? null,
      materia: MATERIAS.has(materia) ? materia : null,
      resposta: semResposta ? null : resposta,
      mensagemRetorno: semResposta ? '' : (resposta ?? '').slice(0, 1000),
      status: semResposta ? 'SEM_RESPOSTA' : 'RESPONDIDO',
      textoSuprimido: false, semResposta,
      scoreConfiancaStt, scoreConfiancaAgente,
    });
    return { id: turno.id, criadoEm: agora };
  },
};
