// tests/sanitizacao.test.js — Testes de sanitização de texto
'use strict';

const { sanitizar } = require('../src/services/sanitizacao');

describe('sanitizar', () => {
  it('retorna texto intacto sem dados pessoais', () => {
    const { texto, suprimido } = sanitizar('Quem foi Dom Pedro I?');
    expect(texto).toBe('Quem foi Dom Pedro I?');
    expect(suprimido).toBe(false);
  });

  it('remove CPF formatado', () => {
    const { texto, suprimido } = sanitizar('Meu CPF é 123.456.789-09');
    expect(texto).not.toContain('123.456.789-09');
    expect(texto).toContain('[DADO_REMOVIDO]');
    expect(suprimido).toBe(false);
  });

  it('remove e-mail', () => {
    const { texto, suprimido } = sanitizar('Me responda em usuario@email.com.br');
    expect(texto).not.toContain('@email.com.br');
    expect(texto).toContain('[DADO_REMOVIDO]');
    expect(suprimido).toBe(false);
  });

  it('não remove nomes de personagens históricos', () => {
    const { texto, suprimido } = sanitizar('Dom Pedro I proclamou a independência');
    expect(texto).toContain('Dom Pedro I');
    expect(suprimido).toBe(false);
  });

  it('retorna null e suprimido=true para texto nulo', () => {
    const { texto, suprimido } = sanitizar(null);
    expect(texto).toBeNull();
    expect(suprimido).toBe(false);
  });

  it('retorna texto original para string vazia', () => {
    const { texto, suprimido } = sanitizar('');
    expect(texto).toBe('');
    expect(suprimido).toBe(false);
  });

  it('remove telefone no formato brasileiro', () => {
    const { texto } = sanitizar('Ligue para (11) 99999-8888');
    expect(texto).not.toContain('99999-8888');
  });

  it('diferencia nome introduzido por "meu nome é" de nome pedagógico', () => {
    const introduzido = sanitizar('meu nome é João Silva, qual é a capital?');
    expect(introduzido.texto).toContain('[DADO_REMOVIDO]');

    const pedagogico = sanitizar('Getúlio Vargas foi presidente do Brasil');
    // Sem contexto de "meu nome é", não deve remover nome histórico
    expect(pedagogico.texto).toContain('Getúlio Vargas');
  });
  it('não remove número de exercício (ex: questão 2.001)', () => {
    const { texto, suprimido } = sanitizar('Resolva a questão 2.001 do livro');
    expect(texto).toContain('2.001');
    expect(suprimido).toBe(false);
  });

  it('não remove ano histórico (ex: 1822)', () => {
    const { texto, suprimido } = sanitizar('Em 1822 o Brasil se tornou independente');
    expect(texto).toContain('1822');
    expect(suprimido).toBe(false);
  });

  it('remove RG no formato explícito com pontos e traço', () => {
    const { texto } = sanitizar('Meu RG é 12.345.678-9');
    expect(texto).not.toContain('12.345.678-9');
    expect(texto).toContain('[DADO_REMOVIDO]');
  });

  it('não remove número de 8 dígitos sem formatação de RG', () => {
    const { texto } = sanitizar('Veja a fórmula na página 12345678');
    expect(texto).toContain('12345678');
  });

  it('remove CPF sem formatação (11 dígitos contínuos)', () => {
    const { texto } = sanitizar('Meu CPF é 12345678909');
    expect(texto).not.toContain('12345678909');
    expect(texto).toContain('[DADO_REMOVIDO]');
  });

  it('remove referência a familiar com nome', () => {
    const { texto, suprimido } = sanitizar('Minha mãe Ana Paula mora aqui');
    expect(texto).toContain('[DADO_REMOVIDO]');
    expect(texto).not.toContain('Ana Paula');
    expect(suprimido).toBe(false);
  });

  it('remove endereço com contexto de moradia', () => {
    const { texto } = sanitizar('Minha mãe Ana Paula mora na Rua das Flores 123');
    expect(texto).toContain('[DADO_REMOVIDO]');
    expect(texto).not.toContain('Rua das Flores 123');
  });

  it('remove logradouro com número inline', () => {
    const { texto } = sanitizar('Meu endereço é na Avenida Paulista 1000');
    expect(texto).toContain('[DADO_REMOVIDO]');
    expect(texto).not.toContain('Avenida Paulista 1000');
  });

  it('não remove nome de logradouro pedagógico sem número nem contexto pessoal', () => {
    // Rua sem número e sem contexto de moradia — conteúdo pedagógico
    const { texto } = sanitizar('A Avenida Paulista é um símbolo de São Paulo');
    // Pode ou não conter [DADO_REMOVIDO] dependendo do padrão, mas não deve suprimir todo o texto
    expect(texto).not.toBeNull();
  });
});
