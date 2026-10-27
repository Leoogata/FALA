/**
 * Módulo de OCR para PDFs escaneados.
 *
 * Estratégia:
 *   1. Converte cada página do PDF em PNG via `pdftoppm` (poppler-utils)
 *   2. Processa cada imagem em worker_thread separada com Tesseract.js
 *   3. Concatena o texto de todas as páginas
 *
 * Dependência de sistema: `pdftoppm` (pacote poppler-utils)
 *   - Docker: instalado via apt-get no Dockerfile
 *   - macOS local: `brew install poppler`
 *   - Ubuntu local: `apt-get install poppler-utils`
 *
 * Se `pdftoppm` não estiver disponível, lança erro descritivo
 * para que o pipeline grave status ERRO com mensagem clara.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, 'ocr.worker.js');

const OCR_LANG = process.env.OCR_LANG ?? 'por+eng';

/**
 * Verifica se pdftoppm está disponível no sistema.
 * Lança erro descritivo se não estiver.
 */
async function verificarPdftoppm() {
  try {
    await execFileAsync('which', ['pdftoppm']);
  } catch {
    throw new Error(
      'pdftoppm não encontrado. Instale poppler-utils para usar OCR em PDFs escaneados. ' +
      'No Docker isso é instalado automaticamente.',
    );
  }
}

/**
 * Converte um PDF em imagens PNG (uma por página) usando pdftoppm.
 * Retorna os caminhos das imagens geradas em um diretório temporário.
 *
 * @param {string} pdfPath - Caminho absoluto do PDF
 * @returns {Promise<{ tmpDir: string, imagePaths: string[] }>}
 */
async function pdfParaImagens(pdfPath) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ponte-ocr-'));
  const outputPrefix = path.join(tmpDir, 'page');

  // pdftoppm converte cada página em <outputPrefix>-<n>.png
  await execFileAsync('pdftoppm', [
    '-png',
    '-r', '200',      // 200 DPI — boa qualidade para OCR sem ser excessivo
    pdfPath,
    outputPrefix,
  ]);

  const files = await fs.readdir(tmpDir);
  const imagePaths = files
    .filter((f) => f.endsWith('.png'))
    .sort()  // garante ordem das páginas
    .map((f) => path.join(tmpDir, f));

  return { tmpDir, imagePaths };
}

/**
 * Roda o Tesseract em uma worker_thread para não bloquear o event loop.
 *
 * @param {string} imagePath
 * @returns {Promise<string>}
 */
function ocrEmWorker(imagePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: { imagePath, lang: OCR_LANG },
    });
    worker.once('message', ({ text, error }) => {
      if (error) reject(new Error(error));
      else resolve(text);
    });
    worker.once('error', reject);
  });
}

/**
 * Extrai texto de um PDF escaneado via OCR.
 * Processa páginas em paralelo (cada uma em worker_thread própria).
 *
 * @param {string} pdfPath - Caminho do arquivo PDF
 * @returns {Promise<string>} - Texto extraído de todas as páginas
 */
export async function extrairTextoComOCR(pdfPath) {
  await verificarPdftoppm();

  const { tmpDir, imagePaths } = await pdfParaImagens(pdfPath);

  try {
    if (imagePaths.length === 0) {
      throw new Error('PDF sem páginas ou conversão falhou');
    }

    // Processa todas as páginas em paralelo — cada uma em worker_thread própria
    const textosPorPagina = await Promise.all(
      imagePaths.map((imgPath) => ocrEmWorker(imgPath)),
    );

    return textosPorPagina.join('\n\n');
  } finally {
    // Limpa imagens temporárias independente de sucesso/falha
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
