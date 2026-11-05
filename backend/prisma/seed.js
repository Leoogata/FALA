/**
 * Seed — escolas e campanhas da plataforma Ponte
 *
 * Idempotente: usa upsert por código (escola) e por (escolaId, slug) (campanha).
 * Pode rodar várias vezes sem duplicar.
 *
 * Estrutura para a demo:
 *   - Escola A (código 1001) → Informática, Matemática, Português
 *   - Escola B (código 2002) → História, Geografia, Ciências
 *   - Campanhas gerais (sem escola) → as 5 matérias "clássicas", usadas
 *     quando o aluno liga e NÃO digita um código (conteúdo geral).
 *
 * Execução:
 *   npx prisma db seed   |   node prisma/seed.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// System prompts por matéria (reutilizados entre escolas e geral)
const PROMPTS = {
  historia:
    'Você é um tutor de história do ensino fundamental e médio. Explique eventos ' +
    'históricos de forma contextualizada, conectando causas e consequências. Use ' +
    'exemplos concretos e linguagem acessível para estudantes de regiões rurais.',
  geografia:
    'Você é um tutor de geografia do ensino fundamental e médio. Explique conceitos ' +
    'geográficos físicos e humanos de forma prática e visual. Relacione os conteúdos ' +
    'à realidade do estudante quando possível.',
  portugues:
    'Você é um tutor de língua portuguesa do ensino fundamental e médio. Auxilie em ' +
    'gramática, interpretação de texto, redação e literatura. Use exemplos claros e ' +
    'corrija erros com gentileza e didatismo.',
  matematica:
    'Você é um tutor de matemática do ensino fundamental e médio. Resolva problemas ' +
    'passo a passo, explicando cada etapa de forma simples. Use exemplos do cotidiano ' +
    'para tornar os conceitos abstratos mais concretos.',
  ciencias:
    'Você é um tutor de ciências do ensino fundamental. Explique fenômenos naturais, ' +
    'biologia, química e física básica de forma curiosa e acessível. Estimule o ' +
    'pensamento científico com perguntas e experimentos simples.',
  informatica:
    'Você é um tutor de informática do ensino fundamental e médio. Explique conceitos ' +
    'de computação — hardware, software, internet, segurança digital e lógica — de ' +
    'forma simples e acessível, com exemplos do dia a dia.',
};

const NOMES = {
  historia: 'História',
  geografia: 'Geografia',
  portugues: 'Língua Portuguesa',
  matematica: 'Matemática',
  ciencias: 'Ciências',
  informatica: 'Informática',
};

// Escolas da demo: código digitado no telefone → matérias disponíveis
const ESCOLAS = [
  {
    codigo: '1001',
    nome: 'E.E. Castelo Branco',
    materias: ['informatica', 'matematica', 'portugues'],
  },
  {
    codigo: '2002',
    nome: 'E.E. Maria Montessori',
    materias: ['historia', 'geografia', 'ciencias'],
  },
];

// Campanhas "gerais" (sem escola) — fluxo quando o aluno não digita código
const GERAIS = ['historia', 'geografia', 'portugues', 'matematica', 'ciencias'];

async function upsertCampanha({ escolaId, slug }) {
  const dadosCreate = {
    nome: NOMES[slug],
    slug,
    descricao: PROMPTS[slug],
    ativa: true,
    escolaId: escolaId ?? null,
  };

  // O Prisma não aceita null numa chave composta de upsert (escolaId_slug).
  // Para campanhas gerais (escolaId null), faz busca-ou-cria manual.
  if (escolaId == null) {
    const existente = await prisma.campanha.findFirst({
      where: { escolaId: null, slug },
    });
    if (existente) return existente;
    return prisma.campanha.create({ data: dadosCreate });
  }

  // Com escola, usa upsert por chave composta normalmente.
  return prisma.campanha.upsert({
    where: { escolaId_slug: { escolaId, slug } },
    update: {}, // não sobrescreve edições manuais
    create: dadosCreate,
  });
}

async function main() {
  console.log('🌱 Seed: escolas e campanhas...');

  // 1. Escolas + suas campanhas
  for (const esc of ESCOLAS) {
    const escola = await prisma.escola.upsert({
      where: { codigo: esc.codigo },
      update: { nome: esc.nome },
      create: { codigo: esc.codigo, nome: esc.nome },
    });
    console.log(`\n🏫 ${escola.nome} (código ${escola.codigo})`);
    for (const slug of esc.materias) {
      const c = await upsertCampanha({ escolaId: escola.id, slug });
      console.log(`   ✓ ${slug} (${c.id})`);
    }
  }

  // 2. Campanhas gerais (sem escola)
  console.log('\n🌐 Campanhas gerais (sem escola)');
  for (const slug of GERAIS) {
    const c = await upsertCampanha({ escolaId: null, slug });
    console.log(`   ✓ ${slug} (${c.id})`);
  }

  console.log('\n✅ Seed concluído.');
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
