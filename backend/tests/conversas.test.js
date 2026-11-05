// tests/conversas.test.js — Testes do repository de conversas (retenção, contexto, idempotência, concorrência)
// O Prisma é mockado — não requer banco real.

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.INTERNAL_API_KEY = 'test-internal-key-min-32-characters-ok';
process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';

// Mock do Prisma antes de importar o repositório
const mockPrisma = {
  conversa: {
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  interacao: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: mockPrisma }));

const {
  upsertConversa,
  reservarTurno,
  concluirTurno,
  buscarContexto,
  expurgarVencidos,
  encerrarConversasInativas,
} = await import('../src/repositories/conversas.repository.js');

const agora = new Date('2026-11-04T12:00:00Z');
const em168h = new Date('2026-11-11T12:00:00Z');

// Conversa ATIVA padrão retornada pelo findUnique dentro da transação
const conversaAtivaMock = { estado: 'ATIVA', expira_em: em168h };

beforeEach(() => {
  jest.clearAllMocks();
  // Por padrão, conversa está ativa em todas as transações
  mockPrisma.conversa.findUnique.mockResolvedValue(conversaAtivaMock);
  // Restaurar $transaction ao comportamento padrão (pode ser sobrescrito por testes específicos)
  mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
});

// ── upsertConversa ────────────────────────────────────────────────────────────

describe('upsertConversa', () => {
  it('cria conversa nova com estado ATIVA', async () => {
    mockPrisma.conversa.upsert.mockResolvedValue({
      id: 'uuid-conv-1', estado: 'ATIVA', expira_em: em168h,
    });

    const resultado = await upsertConversa({ chaveChamada: 'hmac-abc', versaoChave: 'v1' });

    expect(mockPrisma.conversa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chave_chamada: 'hmac-abc' },
        create: expect.objectContaining({ chave_chamada: 'hmac-abc', versao_chave: 'v1', estado: 'ATIVA' }),
      })
    );
    expect(resultado.estado).toBe('ATIVA');
    expect(resultado.id).toBe('uuid-conv-1');
  });
});

// ── reservarTurno ─────────────────────────────────────────────────────────────

describe('reservarTurno', () => {
  it('cria novo turno com ordem atômica e grava execucao_id e lease_expira_em', async () => {
    mockPrisma.interacao.findUnique.mockResolvedValue(null); // token novo
    mockPrisma.interacao.findFirst.mockResolvedValue({ ordem: 2 }); // última ordem
    mockPrisma.interacao.create.mockResolvedValue({ id: 'uuid-int-1', ordem: 3, status: 'RECEBIDO' });

    const resultado = await reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-1',
      perguntaSanitizada: 'O que é fotossíntese?',
      textoSuprimido: false,
    });

    expect(resultado.ordem).toBe(3);
    expect(resultado.jaExistia).toBe(false);
    expect(mockPrisma.interacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ordem: 3,
          turno_token: 'uuid-token-1',
          status: 'RECEBIDO',
          execucao_id: expect.any(String),
          lease_expira_em: expect.any(Date),
        }),
      })
    );
  });

  it('retorna turno já concluído para token duplicado (idempotência)', async () => {
    const concluida = new Date();
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-existente',
      conversa_id: 'uuid-conv-1',
      ordem: 1,
      status: 'RESPONDIDO',
      mensagem_retorno: 'Resposta salva',
      concluida_em: concluida,
      pergunta: 'O que é fotossíntese?',
      execucao_id: 'exec-1',
      lease_expira_em: new Date(Date.now() + 60000),
    });

    const resultado = await reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-1',
      perguntaSanitizada: 'O que é fotossíntese?',
      textoSuprimido: false,
    });

    expect(resultado.jaExistia).toBe(true);
    expect(resultado.id).toBe('uuid-int-existente');
    expect(mockPrisma.interacao.create).not.toHaveBeenCalled();
    expect(mockPrisma.interacao.update).not.toHaveBeenCalled();
  });

  it('lease ainda válido → retorna jaExistia=true sem reprocessar (concorrência)', async () => {
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-em-proc',
      conversa_id: 'uuid-conv-1',
      ordem: 1,
      status: 'RECEBIDO',
      mensagem_retorno: null,
      concluida_em: null,
      pergunta: 'Pergunta?',
      execucao_id: 'exec-outro',
      lease_expira_em: new Date(Date.now() + 120000), // lease válido por mais 2 min
    });

    const resultado = await reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-1',
      perguntaSanitizada: 'Pergunta?',
      textoSuprimido: false,
    });

    expect(resultado.jaExistia).toBe(true);
    expect(mockPrisma.interacao.update).not.toHaveBeenCalled();
    expect(mockPrisma.interacao.create).not.toHaveBeenCalled();
  });

  it('lease expirado → recupera turno abandonado (jaExistia=false para reprocessamento)', async () => {
    const leaseVencido = new Date(Date.now() - 5000); // expirado há 5s
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-abandonado',
      conversa_id: 'uuid-conv-1',
      ordem: 1,
      status: 'RECEBIDO',
      mensagem_retorno: null,
      concluida_em: null,
      pergunta: 'Pergunta?',
      execucao_id: 'exec-anterior',
      lease_expira_em: leaseVencido,
    });
    mockPrisma.interacao.update.mockResolvedValue({});

    const resultado = await reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-1',
      perguntaSanitizada: 'Pergunta?',
      textoSuprimido: false,
    });

    // Deve assumir processamento atualizando execucao_id e lease_expira_em
    expect(mockPrisma.interacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uuid-int-abandonado' },
        data: expect.objectContaining({
          execucao_id: expect.any(String),
          lease_expira_em: expect.any(Date),
        }),
      })
    );
    expect(resultado.jaExistia).toBe(false);
    expect(resultado.id).toBe('uuid-int-abandonado');
  });

  it('lança 409 se token pertence a outra conversa', async () => {
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-1',
      conversa_id: 'OUTRA-CONVERSA',
      ordem: 1,
      status: 'RESPONDIDO',
      mensagem_retorno: null,
      concluida_em: new Date(),
      pergunta: 'x',
      execucao_id: null,
      lease_expira_em: null,
    });

    await expect(reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-1',
      perguntaSanitizada: 'x',
      textoSuprimido: false,
    })).rejects.toMatchObject({ status: 409 });
  });

  it('lança 410 se conversa está encerrada', async () => {
    mockPrisma.conversa.findUnique.mockResolvedValue({ estado: 'ENCERRADA', expira_em: em168h });
    mockPrisma.interacao.findUnique.mockResolvedValue(null);

    await expect(reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-novo',
      perguntaSanitizada: 'x',
      textoSuprimido: false,
    })).rejects.toMatchObject({ status: 410 });
  });

  it('propaga erro de serialização P2034 após MAX_SERIALIZATION_RETRIES tentativas', async () => {
    // Simular $transaction sempre lançando P2034
    const errSer = Object.assign(new Error('Serialization failure'), { code: 'P2034' });
    mockPrisma.$transaction.mockRejectedValue(errSer);

    await expect(reservarTurno({
      conversaId: 'uuid-conv-1',
      turnoToken: 'uuid-token-1',
      perguntaSanitizada: 'x',
      textoSuprimido: false,
    })).rejects.toMatchObject({ code: 'P2034' });

    // Restaurar o comportamento padrão de $transaction para os testes seguintes
    mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
  });
});

// ── concluirTurno ─────────────────────────────────────────────────────────────

describe('concluirTurno', () => {
  it('finaliza turno RECEBIDO → RESPONDIDO', async () => {
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-1', conversa_id: 'uuid-conv-1', status: 'RECEBIDO', concluida_em: null,
    });
    mockPrisma.interacao.update.mockResolvedValue({ id: 'uuid-int-1', status: 'RESPONDIDO' });
    mockPrisma.conversa.update.mockResolvedValue({});

    const resultado = await concluirTurno({
      turnoToken: 'uuid-token-1',
      conversaId: 'uuid-conv-1',
      campanhaId: 'cm-hist',
      materia: 'historia',
      resposta: 'Dom Pedro foi o primeiro imperador.',
      mensagemRetorno: 'Dom Pedro foi o primeiro imperador.',
      status: 'RESPONDIDO',
      textoSuprimido: false,
      semResposta: false,
      scoreConfiancaStt: 0.9,
      scoreConfiancaOrquestrador: 0.85,
      scoreConfiancaAgente: 0.88,
      duracaoMs: 1200,
      versaoPrompt: 'v2.0',
    });

    expect(resultado.status).toBe('RESPONDIDO');
    expect(mockPrisma.interacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESPONDIDO', materia: 'historia' }),
      })
    );
  });

  it('retorna resultado salvo sem regravar para turno já finalizado (idempotência)', async () => {
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-1', conversa_id: 'uuid-conv-1', status: 'RESPONDIDO', concluida_em: new Date(),
    });

    const resultado = await concluirTurno({
      turnoToken: 'uuid-token-1',
      conversaId: 'uuid-conv-1',
      campanhaId: 'cm-hist',
      materia: 'historia',
      resposta: 'Já respondido',
      mensagemRetorno: 'Já respondido',
      status: 'RESPONDIDO',
      textoSuprimido: false,
      semResposta: false,
    });

    expect(resultado.status).toBe('RESPONDIDO');
    expect(mockPrisma.interacao.update).not.toHaveBeenCalled();
  });

  it('lança 409 se turno pertence a outra conversa', async () => {
    mockPrisma.interacao.findUnique.mockResolvedValue({
      id: 'uuid-int-1', conversa_id: 'OUTRA-CONVERSA', status: 'RECEBIDO', concluida_em: null,
    });

    await expect(concluirTurno({
      turnoToken: 'uuid-token-1',
      conversaId: 'uuid-conv-1',
      mensagemRetorno: 'x',
      status: 'RESPONDIDO',
      textoSuprimido: false, semResposta: false,
    })).rejects.toMatchObject({ status: 409 });
  });
});

// ── buscarContexto ────────────────────────────────────────────────────────────

describe('buscarContexto', () => {
  it('retorna histórico ordenado e elegível', async () => {
    mockPrisma.interacao.findMany.mockResolvedValue([
      { pergunta: 'Q1', resposta: 'R1', mensagem_retorno: 'R1', materia: 'historia', status: 'RESPONDIDO' },
      { pergunta: 'Q2', resposta: 'R2', mensagem_retorno: 'R2', materia: 'historia', status: 'RESPONDIDO' },
    ]);

    const historico = await buscarContexto('uuid-conv-1');

    expect(historico).toHaveLength(2);
    expect(historico[0].pergunta).toBe('Q1');
    expect(historico[1].pergunta).toBe('Q2');
  });

  it('retorna apenas últimas 5 trocas', async () => {
    // Gera 7 trocas
    const turnos = Array.from({ length: 7 }, (_, i) => ({
      pergunta: `Q${i}`, resposta: `R${i}`, mensagem_retorno: `R${i}`, materia: 'historia', status: 'RESPONDIDO',
    }));
    mockPrisma.interacao.findMany.mockResolvedValue(turnos);

    const historico = await buscarContexto('uuid-conv-1');

    expect(historico.length).toBeLessThanOrEqual(5);
  });

  it('retorna array vazio quando não há trocas elegíveis', async () => {
    mockPrisma.interacao.findMany.mockResolvedValue([]);
    const historico = await buscarContexto('uuid-conv-1');
    expect(historico).toEqual([]);
  });

  it('filtra por status RESPONDIDO e ESCLARECIMENTO apenas', async () => {
    mockPrisma.interacao.findMany.mockResolvedValue([]);
    await buscarContexto('uuid-conv-1');

    expect(mockPrisma.interacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['RESPONDIDO', 'ESCLARECIMENTO'] },
        }),
      })
    );
  });

  it('exclui registros vencidos pelo expira_em', async () => {
    mockPrisma.interacao.findMany.mockResolvedValue([]);
    await buscarContexto('uuid-conv-1');

    expect(mockPrisma.interacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expira_em: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      })
    );
  });
});

// ── expurgarVencidos ──────────────────────────────────────────────────────────

describe('expurgarVencidos', () => {
  it('remove interações vencidas e conversas sem turnos válidos', async () => {
    mockPrisma.interacao.findMany
      .mockResolvedValueOnce([{ id: 'int-velha-1' }, { id: 'int-velha-2' }])
      .mockResolvedValue([]);
    mockPrisma.interacao.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.conversa.findMany
      .mockResolvedValueOnce([{ id: 'conv-velha-1' }])
      .mockResolvedValue([]);
    mockPrisma.conversa.deleteMany.mockResolvedValue({ count: 1 });

    const resultado = await expurgarVencidos();

    expect(resultado.interacoesRemovidas).toBe(2);
    expect(resultado.conversasRemovidas).toBe(1);
    expect(typeof resultado.duracaoMs).toBe('number');
  });

  it('não remove nada quando não há vencidos', async () => {
    mockPrisma.interacao.findMany.mockResolvedValue([]);
    mockPrisma.conversa.findMany.mockResolvedValue([]);

    const resultado = await expurgarVencidos();

    expect(resultado.interacoesRemovidas).toBe(0);
    expect(resultado.conversasRemovidas).toBe(0);
    expect(mockPrisma.interacao.deleteMany).not.toHaveBeenCalled();
  });
});

// ── encerrarConversasInativas ─────────────────────────────────────────────────

describe('encerrarConversasInativas', () => {
  it('encerra conversas ATIVAS inativas há mais de N minutos', async () => {
    mockPrisma.conversa.findMany.mockResolvedValue([
      { id: 'conv-inativa-1' },
      { id: 'conv-inativa-2' },
    ]);
    mockPrisma.conversa.updateMany.mockResolvedValue({ count: 2 });

    const resultado = await encerrarConversasInativas(30);

    expect(mockPrisma.conversa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'ATIVA',
          ultima_atividade_em: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    );
    expect(mockPrisma.conversa.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'ENCERRADA', encerrada_em: expect.any(Date) }),
      })
    );
    expect(resultado.encerradas).toBe(2);
  });

  it('retorna encerradas=0 quando não há conversas inativas', async () => {
    mockPrisma.conversa.findMany.mockResolvedValue([]);

    const resultado = await encerrarConversasInativas(30);

    expect(resultado.encerradas).toBe(0);
    expect(mockPrisma.conversa.updateMany).not.toHaveBeenCalled();
  });
});
