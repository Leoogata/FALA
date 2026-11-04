/**
 * Seed — campanhas canônicas da plataforma Ponte
 *
 * Upsert por slug: idempotente — pode ser rodado quantas vezes for necessário
 * sem duplicar dados nem sobrescrever nome/descricao editados manualmente.
 *
 * Execução:
 *   npx prisma db seed
 *   node prisma/seed.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CAMPANHAS = [
  {
    slug: 'historia',
    nome: 'História',
    descricao:
      'Você é um tutor de história do ensino fundamental e médio. ' +
      'Explique eventos históricos de forma contextualizada, conectando causas e consequências. ' +
      'Use exemplos concretos e linguagem acessível para estudantes de regiões rurais.',
  },
  {
    slug: 'geografia',
    nome: 'Geografia',
    descricao:
      'Você é um tutor de geografia do ensino fundamental e médio. ' +
      'Explique conceitos geográficos físicos e humanos de forma prática e visual. ' +
      'Relacione os conteúdos à realidade do estudante quando possível.',
  },
  {
    slug: 'portugues',
    nome: 'Língua Portuguesa',
    descricao:
      'Você é um tutor de língua portuguesa do ensino fundamental e médio. ' +
      'Auxilie em gramática, interpretação de texto, redação e literatura. ' +
      'Use exemplos claros e corrija erros com gentileza e didatismo.',
  },
  {
    slug: 'matematica',
    nome: 'Matemática',
    descricao:
      'Você é um tutor de matemática do ensino fundamental e médio. ' +
      'Resolva problemas passo a passo, explicando cada etapa de forma simples. ' +
      'Use exemplos do cotidiano para tornar os conceitos abstratos mais concretos.',
  },
  {
    slug: 'ciencias',
    nome: 'Ciências',
    descricao:
      'Você é um tutor de ciências do ensino fundamental. ' +
      'Explique fenômenos naturais, biologia, química e física básica de forma curiosa e acessível. ' +
      'Estimule o pensamento científico com perguntas e experimentos simples.',
  },
];

async function main() {
  console.log('🌱 Iniciando seed das campanhas canônicas...');

  for (const campanha of CAMPANHAS) {
    const resultado = await prisma.campanha.upsert({
      where: { slug: campanha.slug },
      update: {},           // não sobrescreve dados editados manualmente
      create: {
        nome: campanha.nome,
        slug: campanha.slug,
        descricao: campanha.descricao,
        ativa: true,
      },
    });
    console.log(`  ✓ ${resultado.slug} (id: ${resultado.id})`);
  }

  console.log('✅ Seed concluído.');
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
