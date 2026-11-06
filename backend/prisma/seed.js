// Seed idempotente: escolas e um rascunho de agente geral por escola.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  for (const { codigo, nome } of [
    { codigo: '1001', nome: 'E.E. Castelo Branco' },
    { codigo: '2002', nome: 'E.E. Maria Montessori' },
  ]) {
    const escola = await prisma.escola.upsert({ where: { codigo }, update: {}, create: { codigo, nome } });
    await prisma.campanha.upsert({
      where: { escolaId_slug: { escolaId: escola.id, slug: 'tutor-escolar' } }, update: {},
      create: { escolaId: escola.id, slug: 'tutor-escolar', nome: 'Tutor da escola',
        descricao: 'Ajude os alunos do ensino fundamental com base nos materiais da escola.', usaRag: true, ativa: false },
    });
    console.log(`Escola ${codigo}: rascunho disponível no painel.`);
  }
} finally { await prisma.$disconnect(); }
