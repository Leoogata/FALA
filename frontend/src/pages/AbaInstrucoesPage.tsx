import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext, useBeforeUnload, useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { InstrucoesEditor } from '../components/agent/InstrucoesEditor';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { atualizarAgente } from '../api/agentes';
import type { AgenteDetalhe } from '../api/types';

interface OutletCtx {
  agente: AgenteDetalhe;
  onAgenteChange: () => Promise<void>;
}

export function AbaInstrucoesPage() {
  const { agente, onAgenteChange } = useOutletContext<OutletCtx>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [instrucoes, setInstrucoes] = useState(agente.instrucoes ?? '');
  const savedInstrucoes = useRef(agente.instrucoes ?? '');
  const [saving, setLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const dirty = instrucoes.trim() !== savedInstrucoes.current.trim();

  // Block navigation when dirty
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });

  useBeforeUnload(
    React.useCallback(
      (e) => { if (dirty) { e.preventDefault(); } },
      [dirty],
    ),
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowLeaveModal(true);
    }
  }, [blocker]);

  async function handleSalvar() {
    const instr = instrucoes.trim();
    if (instr.length < 20) {
      showToast({ type: 'error', message: 'Descreva com pelo menos 20 caracteres o que o agente deve fazer.' });
      return;
    }
    setLoading(true);
    try {
      await atualizarAgente(agente.id, { instrucoes: instr });
      savedInstrucoes.current = instr;
      await onAgenteChange();
      showToast({ type: 'success', message: 'Instruções salvas. As próximas ligações já usam a nova versão.' });
    } catch (err: unknown) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Algo deu errado.' });
    } finally {
      setLoading(false);
    }
  }

  function handleDescartar() {
    setInstrucoes(savedInstrucoes.current);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[17px] font-bold text-[var(--navy)]">Instruções do agente</h2>
        <p className="text-sm text-[var(--muted)] mt-0.5">As alterações valem para as próximas ligações depois de salvar.</p>
      </div>

      <InstrucoesEditor
        agente={agente}
        value={instrucoes}
        onChange={setInstrucoes}
        context="aba"
      />

      <div className="flex justify-end gap-2 mt-4">
        <Button
          variant="secondary"
          onClick={handleDescartar}
          disabled={!dirty || saving}
        >
          Descartar alterações
        </Button>
        <Button
          onClick={handleSalvar}
          loading={saving}
          disabled={!dirty}
        >
          Salvar instruções
        </Button>
      </div>

      {/* Modal sair sem salvar */}
      <ConfirmModal
        open={blocker.state === 'blocked' || showLeaveModal}
        onClose={() => { setShowLeaveModal(false); blocker.reset?.(); }}
        onConfirm={() => { setShowLeaveModal(false); blocker.proceed?.(); }}
        title="Sair sem salvar?"
        confirmLabel="Sair sem salvar"
        confirmVariant="destructive"
      >
        As alterações nas instruções serão perdidas.
      </ConfirmModal>
    </div>
  );
}
