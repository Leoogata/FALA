import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { listarMateriais, removerMaterial } from '../../api/materiais';
import type { AgenteDetalhe, Material } from '../../api/types';
import { formatarTamanho, pluralizar } from '../../utils/arquivo';
import { tempoRelativo } from '../../utils/date';
import { POLLING_DOCUMENTOS_MS } from '../../config';

interface Props {
  agente: AgenteDetalhe;
  materiais: Material[];
  setMateriais: React.Dispatch<React.SetStateAction<Material[]>>;
}

export function MaterialList({ agente, materiais, setMateriais }: Props) {
  const { showToast } = useToast();
  const [removendo, setRemovendo] = useState<Material | null>(null);
  const [removerLoading, setRemoverLoading] = useState(false);
  const prevMateriais = useRef<Material[]>([]);

  // Polling
  const hasProcessing = materiais.some((m) => m.status_indexacao === 'processando');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasProcessing) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    function poll() {
      if (document.visibilityState === 'hidden') return;
      listarMateriais(agente.id).then((lista) => {
        // Toast para materiais que mudaram para erro
        for (const m of lista) {
          const old = prevMateriais.current.find((p) => p.id === m.id);
          if (old?.status_indexacao === 'processando' && m.status_indexacao === 'erro') {
            showToast({ type: 'error', message: `Não foi possível processar "${m.nome_original}".` });
          }
        }
        prevMateriais.current = lista;
        setMateriais(lista);
      }).catch(() => {});
    }

    pollingRef.current = setInterval(poll, POLLING_DOCUMENTOS_MS);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [hasProcessing, agente.id, setMateriais, showToast]);

  useEffect(() => {
    prevMateriais.current = materiais;
  }, [materiais]);

  async function handleRemover() {
    if (!removendo) return;
    setRemoverLoading(true);
    try {
      const res = await removerMaterial(agente.id, removendo.id);
      setMateriais((prev) => prev.filter((m) => m.id !== removendo.id));
      const nomeDoc = removendo.nome_original;
      setRemovendo(null);
      if (!res.campanha_ativa && agente.ativa) {
        showToast({ type: 'error', message: `Material removido. "${agente.nome}" foi desativado por não ter mais material pronto.` });
      } else {
        showToast({ type: 'success', message: `"${nomeDoc}" removido.` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível remover o material.';
      showToast({ type: 'error', message: msg });
    } finally {
      setRemoverLoading(false);
    }
  }

  const isUltimoPronte = agente.ativa &&
    materiais.filter((m) => m.status_indexacao === 'pronto').length === 1 &&
    removendo?.status_indexacao === 'pronto';

  if (materiais.length === 0) {
    return <p className="text-sm text-[var(--muted)] mt-4">Nenhum material enviado ainda.</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-[13px] font-bold text-[var(--ink)]">
          Materiais enviados ({materiais.length})
        </h3>
        {hasProcessing && (
          <span className="text-xs text-[var(--muted)]">Atualiza sozinho, não precisa recarregar.</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {materiais.map((m) => (
          <MaterialItem
            key={m.id}
            material={m}
            onRemove={() => setRemovendo(m)}
          />
        ))}
      </div>

      {/* Modal de remoção */}
      {removendo && (
        <ConfirmModal
          open={true}
          onClose={() => setRemovendo(null)}
          onConfirm={handleRemover}
          title="Remover este material?"
          confirmLabel="Remover material"
          confirmVariant="destructive"
          loading={removerLoading}
        >
          <p>
            <strong>{removendo.nome_original}</strong> será removido do agente &ldquo;{agente.nome}&rdquo;.
            O agente deixa de responder com base neste conteúdo. Para usá-lo de novo, será preciso enviar o arquivo outra vez.
          </p>
          {isUltimoPronte && (
            <div className="mt-3 bg-[var(--draft-bg)] text-[var(--draft)] text-xs rounded-lg p-3">
              Este é o único material pronto. Como o agente está ativo, ele será <strong>desativado</strong> e sairá do menu da ligação.
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}

function MaterialItem({ material: m, onRemove }: { material: Material; onRemove: () => void }) {
  const tipo = m.mime_type === 'application/pdf' ? 'PDF' : 'TXT';
  const tamanho = formatarTamanho(m.tamanho_bytes);

  return (
    <div className={`flex gap-3 items-start p-3 rounded-xl border ${m.status_indexacao === 'erro' ? 'border-[var(--err-bg)] bg-[var(--err-bg)]' : 'border-[var(--line)] bg-white'}`}>
      {/* Etiqueta tipo */}
      <div className="w-[42px] h-[42px] shrink-0 bg-[var(--off-bg)] rounded-lg flex items-center justify-center text-[11px] font-bold text-[var(--off)]">
        {tipo}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[var(--ink)] break-words">{m.nome_original}</div>
        <div className="text-xs text-[var(--muted)] mt-0.5">
          {tamanho ? `${tamanho} · ` : ''}
          {pluralizar(1, 'enviado', 'enviados')} {tempoRelativo(m.criado_em)}
        </div>

        {m.status_indexacao === 'processando' && (
          <div className="mt-1.5">
            <div className="h-1 bg-[var(--proc-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--proc)] rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
            <p className="text-xs text-[var(--proc)] mt-1">Lendo o arquivo e preparando para o agente…</p>
          </div>
        )}

        {m.status_indexacao === 'erro' && (
          <p className="text-xs text-[var(--err)] mt-1">
            {m.erro_indexacao ?? 'Não foi possível processar este arquivo.'} Remova e envie o arquivo de novo.
          </p>
        )}
      </div>

      {/* Selo + Remover */}
      <div className="shrink-0 flex flex-col items-end gap-2">
        <Badge variant={m.status_indexacao} />
        {m.status_indexacao !== 'processando' && (
          <button
            onClick={onRemove}
            aria-label={`Remover ${m.nome_original}`}
            className="text-[var(--muted)] hover:text-[var(--err)] transition-colors"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
