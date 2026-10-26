import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { enviarMaterial } from '../../api/materiais';
import { useToast } from '../ui/Toast';
import type { AgenteDetalhe, Material } from '../../api/types';
import { UPLOAD_MAX_BYTES, UPLOAD_EXTENSOES } from '../../config';
import { formatarTamanho } from '../../utils/arquivo';

interface UploadError {
  nome: string;
  msg: string;
}

interface Props {
  agente: AgenteDetalhe;
  onUploaded: (m: Material) => void;
}

export function MaterialUploadArea({ agente, onUploaded }: Props) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);

  function validateFile(file: File, existingNames: string[]): string | null {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!UPLOAD_EXTENSOES.includes(ext)) {
      return `"${file.name}": formato não aceito. Envie PDF ou TXT.`;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      const tam = formatarTamanho(file.size);
      return `"${file.name}": o arquivo tem ${tam}; o limite é 10 MB.`;
    }
    if (existingNames.includes(file.name)) {
      return `"${file.name}" já foi enviado para este agente.`;
    }
    return null;
  }

  async function processFiles(files: File[]) {
    setUploadErrors([]);
    const errors: UploadError[] = [];
    const valid: File[] = [];
    const existingNames = agente.documentos.map((d) => d.nome_original);

    for (const file of files) {
      const err = validateFile(file, existingNames);
      if (err) {
        errors.push({ nome: file.name, msg: err });
      } else {
        valid.push(file);
      }
    }

    setUploadErrors(errors);

    // Envio paralelo, máx 3
    const chunks: File[][] = [];
    for (let i = 0; i < valid.length; i += 3) {
      chunks.push(valid.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (file) => {
          try {
            const mat = await enviarMaterial(agente.id, file, () => {});
            onUploaded(mat);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : `Erro ao enviar "${file.name}".`;
            setUploadErrors((prev) => [...prev, { nome: file.name, msg }]);
          }
        }),
      );
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  return (
    <div className="mb-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? 'border-[var(--proc)] bg-[var(--proc-bg)]' : 'border-[var(--line)] bg-[var(--soft)]'}`}
      >
        <UploadCloud size={28} className="mx-auto mb-2 text-[var(--muted)]" />
        <p className="text-sm text-[var(--ink)]">
          Arraste os arquivos aqui ou{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[var(--proc)] underline font-medium"
          >
            escolha no computador
          </button>
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">PDF ou TXT · até 10 MB por arquivo</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          multiple
          onChange={handleChange}
          className="hidden"
          aria-label="Selecionar arquivos"
        />
      </div>

      {/* Erros de upload */}
      {uploadErrors.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {uploadErrors.map((e, i) => (
            <p key={i} className="text-xs text-[var(--err)] bg-[var(--err-bg)] rounded-lg px-3 py-1.5">{e.msg}</p>
          ))}
        </div>
      )}

      {/* Aviso sobre dados pessoais */}
      <div className="mt-3 bg-[#FFF4DB] border border-[var(--draft)] rounded-lg px-3 py-2 text-xs text-[var(--draft)]">
        Não envie dados pessoais de alunos (listas de chamada, notas, telefones, laudos). O agente pode repetir o conteúdo dos materiais para quem ligar.
      </div>
    </div>
  );
}
