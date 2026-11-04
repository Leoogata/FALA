import { z } from 'zod';

const SLUGS_VALIDOS = ['historia', 'geografia', 'portugues', 'matematica', 'ciencias'];

export const CriarCampanhaSchema = z.object({
  nome: z
    .string({ required_error: 'nome é obrigatório' })
    .trim()
    .min(3, 'nome deve ter no mínimo 3 caracteres')
    .max(100, 'nome deve ter no máximo 100 caracteres'),
  slug: z
    .enum(SLUGS_VALIDOS, { message: `slug deve ser um de: ${SLUGS_VALIDOS.join(', ')}` })
    .optional(),
  descricao: z.string().trim().min(1).optional(),
});

export const EditarCampanhaSchema = z
  .object({
    nome: z.string().trim().min(3).max(100).optional(),
    slug: z
      .enum(SLUGS_VALIDOS, { message: `slug deve ser um de: ${SLUGS_VALIDOS.join(', ')}` })
      .nullable()
      .optional(),
    descricao: z.string().trim().min(1).nullable().optional(),
    // `instrucoes` é o alias enviado pelo frontend (mapeado para `descricao` no controller)
    instrucoes: z.string().trim().min(1).nullable().optional(),
    ativa: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar (nome, slug, descricao, instrucoes ou ativa)',
  });

export const SLUGS_CAMPANHAS = SLUGS_VALIDOS;

export const CampanhaIdSchema = z.object({
  id: z.string().min(1, 'id é obrigatório'),
});

export const ListarCampanhasQuerySchema = z.object({
  ativa: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const DeleteCampanhaQuerySchema = z.object({
  cascade: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
