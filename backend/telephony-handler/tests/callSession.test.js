// tests/callSession.test.js — Testes da sessão local de chamada
'use strict';

process.env.HMAC_SECRET = 'segredo-de-teste-que-tem-pelo-menos-32-chars';
process.env.HMAC_SECRET_VERSION = 'v1';
process.env.BACKEND_API_URL = 'http://localhost:9999';

const session = require('../src/services/callSession');

beforeEach(() => {
  // Limpar sessões entre testes
  session.clearSession('CA-test');
  session.clearSession('CA-test2');
});

describe('callSession — tentativas STT', () => {
  it('retorna 0 tentativas para sessão nova', () => {
    expect(session.getRetries('CA-test')).toBe(0);
  });

  it('incrementa tentativas', () => {
    expect(session.incrementRetries('CA-test')).toBe(1);
    expect(session.incrementRetries('CA-test')).toBe(2);
  });

  it('resetRetries zera tentativas mas preserva conversaId', () => {
    session.incrementRetries('CA-test');
    session.setConversaId('CA-test', 'uuid-conversa');
    session.resetRetries('CA-test');

    expect(session.getRetries('CA-test')).toBe(0);
    expect(session.getConversaId('CA-test')).toBe('uuid-conversa');
  });

  it('clearSession remove tudo', () => {
    session.incrementRetries('CA-test');
    session.setConversaId('CA-test', 'uuid-conversa');
    session.clearSession('CA-test');

    expect(session.getRetries('CA-test')).toBe(0);
    expect(session.getConversaId('CA-test')).toBeNull();
  });
});

describe('callSession — conversa e token', () => {
  it('getConversaId retorna null para sessão nova', () => {
    expect(session.getConversaId('CA-test')).toBeNull();
  });

  it('setConversaId e getConversaId', () => {
    session.setConversaId('CA-test', 'uuid-abc');
    expect(session.getConversaId('CA-test')).toBe('uuid-abc');
  });

  it('getTurnoToken retorna null para sessão nova', () => {
    expect(session.getTurnoToken('CA-test')).toBeNull();
  });

  it('setTurnoToken e getTurnoToken', () => {
    session.setTurnoToken('CA-test', 'uuid-token-1');
    expect(session.getTurnoToken('CA-test')).toBe('uuid-token-1');
  });

  it('duas sessões são independentes', () => {
    session.setConversaId('CA-test', 'uuid-1');
    session.setConversaId('CA-test2', 'uuid-2');

    expect(session.getConversaId('CA-test')).toBe('uuid-1');
    expect(session.getConversaId('CA-test2')).toBe('uuid-2');
  });
});

describe('callSession — HMAC', () => {
  it('calcularChaveChamada retorna chave e versão', () => {
    const { chave, versao } = session.calcularChaveChamada('CAabc123');
    expect(typeof chave).toBe('string');
    expect(chave).toHaveLength(64); // hex SHA-256
    expect(versao).toBe('v1');
  });

  it('mesma ligação sempre gera a mesma chave', () => {
    const a = session.calcularChaveChamada('CAabc123');
    const b = session.calcularChaveChamada('CAabc123');
    expect(a.chave).toBe(b.chave);
  });

  it('ligações diferentes geram chaves diferentes', () => {
    const a = session.calcularChaveChamada('CAabc123');
    const b = session.calcularChaveChamada('CAxyz999');
    expect(a.chave).not.toBe(b.chave);
  });
});
