/**
 * Worker de OCR — roda em thread separada via worker_threads.
 *
 * Recebe via workerData: { imagePath, lang }
 * Devolve via parentPort.postMessage: { text } ou { error }
 *
 * Rodar o Tesseract em worker thread evita bloquear o event loop principal
 * durante o reconhecimento (que pode levar 2–10s por página em PDFs escaneados).
 */

import { workerData, parentPort } from 'worker_threads';
import { createWorker } from 'tesseract.js';

const { imagePath, lang = 'por+eng' } = workerData;

const worker = await createWorker(lang, 1, {
  // Silencia logs do Tesseract em produção
  logger: () => {},
  errorHandler: () => {},
});

try {
  const { data } = await worker.recognize(imagePath);
  parentPort.postMessage({ text: data.text });
} catch (err) {
  parentPort.postMessage({ error: err.message });
} finally {
  await worker.terminate();
}
