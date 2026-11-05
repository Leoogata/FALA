// src/jobs/expurgo.js — Rotina de exclusão de dados vencidos (retenção de 168 h)
// Executado a cada minuto via agendador e na inicialização.
// Usa lock in-process para evitar execuções concorrentes dentro da mesma instância.
//
// NOTA DE PRODUÇÃO: em implantações com múltiplos processos web, este agendador deve ser
// executado em um processo dedicado (ex: worker separado ou cron job externo) para evitar
// execuções paralelas entre instâncias. O lock `jobEmExecucao` é in-process e não distribui.
import { expurgarVencidos, encerrarConversasInativas } from '../repositories/conversas.repository.js';
import { env } from '../config/env.js';

let jobEmExecucao = false;
let ultimaExecucaoMs = 0;
let ultimoAtrasoMs = 0;

const ALERTA_ATRASO_MS = 5 * 60 * 1000; // 5 minutos
const INTERVALO_MS = 60 * 1000;          // 1 minuto

/**
 * Executa uma rodada de expurgo.
 * Emite contagem, duração e atraso — sem registrar conteúdo textual.
 */
export async function executarExpurgo() {
  if (jobEmExecucao) {
    console.warn('[expurgo] Execução anterior ainda em andamento — ignorando este ciclo');
    return;
  }

  jobEmExecucao = true;
  const inicioCiclo = Date.now();

  // Calcula atraso em relação ao ciclo esperado
  if (ultimaExecucaoMs > 0) {
    ultimoAtrasoMs = inicioCiclo - ultimaExecucaoMs - INTERVALO_MS;
    if (ultimoAtrasoMs > ALERTA_ATRASO_MS) {
      console.error(`[expurgo] ALERTA: atraso de ${Math.round(ultimoAtrasoMs / 1000)} s na execução do expurgo`);
    }
  }

  try {
    // 1. Encerrar conversas inativas antes de expurgar (aplica parâmetro configurável)
    const { encerradas } = await encerrarConversasInativas(env.CONVERSATION_INACTIVITY_MINUTES);
    if (encerradas > 0) {
      console.info(`[expurgo] conversas_encerradas_por_inatividade=${encerradas}`);
    }

    // 2. Remover registros vencidos pelo tempo de retenção
    const { interacoesRemovidas, conversasRemovidas, duracaoMs } = await expurgarVencidos();
    ultimaExecucaoMs = Date.now();
    console.info(
      `[expurgo] interacoes_removidas=${interacoesRemovidas} conversas_removidas=${conversasRemovidas} duracao_ms=${duracaoMs}`
    );
  } catch (err) {
    console.error('[expurgo] Falha na execução:', err.message);
  } finally {
    jobEmExecucao = false;
  }
}

/**
 * Inicia o agendador de expurgo.
 * Executa imediatamente na chamada e depois a cada minuto.
 * @returns {NodeJS.Timeout} — o timer, para permitir clearInterval em testes/shutdown.
 */
export function iniciarAgendadorExpurgo() {
  // Executa imediatamente ao iniciar
  executarExpurgo().catch((err) => console.error('[expurgo] Erro na execução inicial:', err.message));

  const timer = setInterval(() => {
    executarExpurgo().catch((err) => console.error('[expurgo] Erro no ciclo agendado:', err.message));
  }, INTERVALO_MS);

  // Não bloquear o processo Node em shutdown
  if (timer.unref) timer.unref();

  return timer;
}
