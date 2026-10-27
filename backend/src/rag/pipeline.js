import fs from 'fs/promises';
import { createRequire } from 'module';
import { extrairTextoComOCR } from './ocr.js';

// pdf-parse 1.x é CommonJS — usa createRequire para importar em ES Modules
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { queue } from './queue.js';
import { split } from './chunker.js';
import { watsonxClient } from './watsonxClient.js';
import { documentosRepository } from '../repositories/documentos.repository.js';

// Mínimo de caracteres para considerar que pdf-parse extraiu texto útil.
// PDFs escaneados retornam string vazia ou com apenas espaços/newlines.
const MIN_TEXTO_PDF = 50;

/**
 * Lê o conteúdo de um arquivo PDF ou TXT como texto plano.
 *
 * PDF — estratégia em duas etapas:
 *   1. pdf-parse: rápido, sem dependências de sistema, funciona para PDFs texto-based
 *   2. OCR (Tesseract via worker_thread): fallback para PDFs escaneados,
 *      requer poppler-utils instalado (disponível no Docker automaticamente)
 *
 * TXT — leitura direta como UTF-8.
 */
async function lerArquivo(caminho, mimeType) {
  if (mimeType === 'text/plain') {
    const buffer = await fs.readFile(caminho);
    return buffer.toString('utf-8');
  }

  // Etapa 1: tenta extração direta
  const buffer = await fs.readFile(caminho);
  const { text: textoPdf } = await pdfParse(buffer);

  if (textoPdf.trim().length >= MIN_TEXTO_PDF) {
    return textoPdf;
  }

  // Etapa 2: fallback OCR — PDF provavelmente escaneado
  console.log(`[pipeline] pdf-parse retornou texto insuficiente (${textoPdf.trim().length} chars) — usando OCR`);
  return extrairTextoComOCR(caminho);
}

/**
 * Processa um job de indexação:
 *   1. Lê o arquivo do disco
 *   2. Divide em chunks
 *   3. Indexa no watsonx com metadados de isolamento
 *   4. Atualiza o status do documento no banco
 *
 * Segurança contra registro ausente (documento deletado durante PROCESSANDO):
 *   - Se o UPDATE retornar "record not found", chama deleteDocumentChunks por precaução
 *   - Não lança erro — descarta silenciosamente
 */
async function processar({ documentoId, campanhaId, caminhoArquivo }) {
  // Busca o documento para obter o mimeType
  const documento = await documentosRepository.buscarPorId(documentoId);

  // Documento foi deletado antes do pipeline rodar
  if (!documento) {
    await watsonxClient.deleteDocumentChunks(campanhaId, documentoId);
    return;
  }

  try {
    // Verifica se o arquivo existe no disco
    await fs.access(caminhoArquivo);

    const texto = await lerArquivo(caminhoArquivo, documento.mimeType);
    const chunksBase = split(texto);

    if (chunksBase.length === 0) {
      await documentosRepository.atualizarStatus(documentoId, 'ERRO', 'Arquivo vazio ou sem texto extraível');
      return;
    }

    // Adiciona metadados de isolamento a cada chunk
    const chunks = chunksBase.map((c) => ({ ...c, documentoId }));

    await watsonxClient.indexChunks(campanhaId, chunks);

    // Verifica se o documento ainda existe antes de atualizar
    const ainda = await documentosRepository.buscarPorId(documentoId);
    if (!ainda) {
      // Deletado durante a indexação — remove os chunks recém-indexados
      await watsonxClient.deleteDocumentChunks(campanhaId, documentoId);
      return;
    }

    await documentosRepository.atualizarStatus(documentoId, 'PRONTO');
  } catch (err) {
    // Tenta remover chunks parciais antes de marcar ERRO
    await watsonxClient.deleteDocumentChunks(campanhaId, documentoId).catch(() => {});

    // Só atualiza se o registro ainda existe
    const ainda = await documentosRepository.buscarPorId(documentoId);
    if (ainda) {
      await documentosRepository.atualizarStatus(documentoId, 'ERRO', err.message);
    }
  }
}

// Registra o processador na fila ao importar o módulo
queue.setHandler(processar);

export { processar };
