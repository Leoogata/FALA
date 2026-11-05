import { z } from 'zod';

// ─── Regex de PII ─────────────────────────────────────────────────────────────
// CPF: 000.000.000-00 ou 00000000000 (com ou sem formatação)
const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;

// Telefone: formatos brasileiros (fixo e celular, com ou sem DDD/DDI)
// Ex: (11) 91234-5678 | 11912345678 | +55 11 9 1234-5678
const FONE_RE = /(\+?55\s?)?(\(?\d{2}\)?\s?)(\d{4,5}[\s-]?\d{4})/;

/**
 * Lança erro 422 se o texto contiver CPF ou telefone.
 * Retorna true para permitir uso em .refine() do Zod — mas prefira chamar
 * no service para devolver createError(422) com mensagem clara.
 */
export function contemPII(texto) {
  if (!texto) return false;
  return CPF_RE.test(texto) || FONE_RE.test(texto);
}

// ─── Schema de entrada ────────────────────────────────────────────────────────

export const InteracaoSchema = z.object({
  campanha_id: z
    .string({ required_error: 'campanha_id é obrigatório' })
    .trim()
    .min(1, 'campanha_id não pode ser vazio'),

  pergunta: z
    .string({ required_error: 'pergunta é obrigatória' })
    .trim()
    .min(1, 'pergunta não pode ser vazia')
    .max(1000, 'pergunta excede 1000 caracteres'),

  resposta: z
    .string()
    .trim()
    .max(5000, 'resposta excede 5000 caracteres')
    .nullable()
    .optional(),

  score_confianca_stt: z.number().min(0).max(1).nullable().optional(),

  score_confianca_agente: z.number().min(0).max(1).nullable().optional(),

  sem_resposta: z.boolean().default(false),

  call_sid: z
    .string({ required_error: 'call_sid é obrigatório' })
    .trim()
    .min(1, 'call_sid não pode ser vazio'),
});
