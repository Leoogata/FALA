import { Router } from 'express';

const router = Router();

/**
 * POST /instrucoes/melhorar
 *
 * Stub: retorna uma sugestão de melhoria de instruções.
 * Futuramente será integrado ao watsonx para geração real.
 *
 * Body: { nome: string, instrucoes: string }
 * Response: { texto_sugerido: string, mudancas: string[], premissas: string[] }
 */
router.post('/melhorar', (req, res) => {
  const { nome = 'agente', instrucoes = '' } = req.body ?? {};

  res.json({
    texto_sugerido:
      `Papel: você é um tutor de ${nome} que conversa por telefone com alunos.\n\n` +
      `Objetivo: ${instrucoes.slice(0, 80).trim()}.\n\n` +
      `Como ensinar:\n` +
      `- Use linguagem simples e exemplos do dia a dia.\n` +
      `- Confirme o entendimento do aluno antes de avançar.\n` +
      `- Se o aluno perguntar algo fora do conteúdo, oriente-o a procurar o professor.\n\n` +
      `Tom: acolhedor, paciente e encorajador. Fale em frases curtas.`,
    mudancas: [
      'Definiu o papel do agente e o público-alvo.',
      'Definiu o tom de voz (acolhedor, paciente).',
      'Adicionou instrução sobre como lidar com dúvidas fora do conteúdo.',
      'Adaptou o texto para ser ouvido por telefone.',
    ],
    premissas: [
      'Que o agente não deve dar respostas prontas de exercícios.',
      'Que o público-alvo são alunos do ensino fundamental ou médio.',
    ],
  });
});

export default router;
