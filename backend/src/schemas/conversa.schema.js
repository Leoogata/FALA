// src/schemas/conversa.schema.js — Validação Zod para os endpoints internos
import { z } from 'zod';

// ── POST /internal/conversas ──────────────────────────────────────────────────
export const criarConversaSchema = z.object({
  chave_chamada: z.string().min(1).max(256),
  versao_chave: z.string().min(1).max(64),
});

// ── POST /internal/conversas/:id/turnos ──────────────────────────────────────
export const reservarTurnoSchema = z.object({
  turno_token: z.string().uuid(),
  pergunta: z.string().max(500).nullable().optional(),
  texto_suprimido: z.boolean().default(false),
});

// ── POST /interacoes ──────────────────────────────────────────────────────────
export const concluirTurnoSchema = z.object({
  conversa_id: z.string().uuid(),
  turno_token: z.string().uuid(),
  campanha_id: z.string().nullable().optional(),
  materia: z
    .enum(['historia', 'geografia', 'portugues', 'matematica', 'ciencias'])
    .nullable()
    .optional(),
  resposta: z.string().max(1000).nullable().optional(),
  mensagem_retorno: z.string().max(1000),
  status: z.enum(['RESPONDIDO', 'ESCLARECIMENTO', 'SEM_ROTA', 'SEM_RESPOSTA', 'ERRO']),
  texto_suprimido: z.boolean().default(false),
  sem_resposta: z.boolean().default(false),
  score_confianca_stt: z.number().min(0).max(1).nullable().optional(),
  score_confianca_orquestrador: z.number().min(0).max(1).nullable().optional(),
  score_confianca_agente: z.number().min(0).max(1).nullable().optional(),
  duracao_ms: z.number().int().nonnegative().nullable().optional(),
  versao_prompt: z.string().max(128).nullable().optional(),
});

// ── PATCH /internal/conversas/:id ────────────────────────────────────────────
export const encerrarConversaSchema = z.object({
  estado: z.literal('ENCERRADA'),
});
