import { z } from 'zod';

export const DocumentoParamsSchema = z.object({
  id: z.string().min(1, 'campanhaId é obrigatório'),
  docId: z.string().min(1, 'docId é obrigatório'),
});

export const DocumentoUploadParamsSchema = z.object({
  id: z.string().min(1, 'campanhaId é obrigatório'),
});

export const ListarDocumentosQuerySchema = z.object({
  status: z
    .enum(['PROCESSANDO', 'PRONTO', 'ERRO'], {
      message: 'status deve ser PROCESSANDO, PRONTO ou ERRO',
    })
    .optional(),
});
