import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useLocation, Outlet, NavLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, AlertCircle } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Toggle';
import { Skeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { buscarAgente, atualizarAgente } from '../api/agentes';
import { calcularStatus } from '../api/types';
import type { AgenteDetalhe } from '../api/types';
import { tempoRelativo, formatarDataTooltip } from '../utils/date';
import { NOME_MIN, NOME_MAX } from '../config';
import { normalizarTexto } from '../utils/arquivo';

export function DetalheAgentePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const location = useLocation();

  const [toggleLoading, setToggleLoading] = useState(false);
  const [renomearOpen, setRenomearOpen] = useState(false);

  const { data: agente, isLoading, isError, error } = useQuery({
    queryKey: ['agente', id],
    queryFn: () => buscarAgente(id!),
    enabled: !!id,
  });

  const handleToggle = useCallback(async (value: boolean) => {
    if (!agente) return;
    if (!agente.ativa && agente.docs.pronto === 0) {
      showToast({ type: 'error', message: `"${agente.nome}" ainda não tem material pronto. Envie um material antes de ativar.` });
      return;
    }
    setToggleLoading(true);
    try {
      await atualizarAgente(agente.id, { ativa: value });
      await queryClient.invalidateQueries({ queryKey: ['agente', id] });
      await queryClient.invalidateQueries({ queryKey: ['agentes'] });
      if (value) {
        showToast({ message: `"${agente.nome}" está ativo e já aparece no menu da ligação.`, type: 'success' });
      } else {
        showToast({
          message: `"${agente.nome}" foi desativado. Os alunos não conseguem mais acessá-lo.`,
          type: 'success',
          duration: 7000,
          actionLabel: 'Desfazer',
          onAction: async () => {
            try {
              await atualizarAgente(agente.id, { ativa: true });
              await queryClient.invalidateQueries({ queryKey: ['agente', id] });
              await queryClient.invalidateQueries({ queryKey: ['agentes'] });
            } catch { showToast({ type: 'error', message: 'Não foi possível reativar.' }); }
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Algo deu errado.';
      const isNoInstrucoes = (err as { erro?: string })?.erro === 'sem_instrucoes';
      showToast({
        type: 'error',
        message: msg,
        actionLabel: isNoInstrucoes ? 'Escrever instruções' : undefined,
        onAction: isNoInstrucoes ? () => navigate(`/agentes/${id}/instrucoes`) : undefined,
        duration: isNoInstrucoes ? 7000 : undefined,
      });
    } finally {
      setToggleLoading(false);
    }
  }, [agente, id, queryClient, showToast, navigate]);

  // 404
  const isNotFound = isError && (error as { status?: number })?.status === 404;

  if (isNotFound) {
    return (
      <AppLayout title="Agente não encontrado">
        <div className="text-center py-16">
          <p className="text-[var(--muted)] mb-4">Agente não encontrado. Ele pode ter sido removido.</p>
          <Button variant="secondary" onClick={() => navigate('/agentes')}>Voltar para agentes</Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading || !agente) {
    return (
      <AppLayout title="Carregando…">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40 mb-6" />
        <Skeleton className="h-10 w-full" />
      </AppLayout>
    );
  }

  const status = calcularStatus(agente);
  const locked = !agente.ativa && agente.docs.pronto === 0;
  const titulo = agente.nome;

  const tabs = [
    { label: 'Materiais', to: `/agentes/${id}`, exact: true },
    { label: 'Instruções', to: `/agentes/${id}/instrucoes` },
    { label: 'Testar', to: `/agentes/${id}/testar` },
    { label: 'Na ligação', to: `/agentes/${id}/ligacao` },
  ];

  const hasErroMaterial = agente.docs.erro > 0;

  return (
    <AppLayout title={titulo}>
      {/* Cabeçalho */}
      <div className="mb-2">
        <Link to="/agentes" className="text-sm text-[var(--proc)] hover:underline">← Agentes</Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-bold text-[var(--navy)] break-words">{agente.nome}</h1>
            <button
              onClick={() => setRenomearOpen(true)}
              aria-label="Renomear agente"
              className="text-[var(--muted)] hover:text-[var(--ink)] p-1"
            >
              <Pencil size={15} />
            </button>
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5" title={formatarDataTooltip(agente.atualizada_em)}>
            Atualizado {tempoRelativo(agente.atualizada_em)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Toggle
            checked={agente.ativa}
            onChange={handleToggle}
            ariaLabel={agente.ativa ? `Desativar ${agente.nome}` : `Ativar ${agente.nome}`}
            locked={locked}
            lockedTitle="Envie pelo menos 1 material pronto para ativar"
            loading={toggleLoading}
          />
          <Badge variant={status} />
        </div>
      </div>

      {/* Faixas de aviso */}
      {status === 'rascunho' && (
        <div className="bg-[var(--draft-bg)] border border-[var(--draft)] text-[var(--draft)] text-sm rounded-xl px-4 py-3 mb-4">
          Este agente ainda é um rascunho. Envie pelo menos um material e escreva as instruções para poder ativá-lo.
        </div>
      )}
      {status !== 'rascunho' && !agente.instrucoes && (
        <div className="bg-[var(--draft-bg)] border border-[var(--draft)] text-[var(--draft)] text-sm rounded-xl px-4 py-3 mb-4">
          Este agente ainda não tem instruções.{' '}
          <Link to={`/agentes/${id}/instrucoes`} className="underline font-medium">Escrever instruções</Link>
        </div>
      )}

      {/* Abas */}
      <div role="tablist" aria-label="Abas do agente" className="flex gap-1 border-b border-[var(--line)] mb-6 flex-wrap">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to) && !location.pathname.endsWith(tabs[0].to);
          // fix: Materiais é exact; outros são prefix
          const active = tab.exact
            ? location.pathname === `/agentes/${id}`
            : location.pathname === tab.to;

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              role="tab"
              aria-selected={active}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${active ? 'border-[var(--navy)] text-[var(--navy)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              {tab.label}
              {tab.label === 'Materiais' && hasErroMaterial && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--err-bg)] text-[var(--err)] text-[10px] font-bold">!</span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Conteúdo da aba */}
      <Outlet context={{ agente, onAgenteChange: async () => {
        await queryClient.invalidateQueries({ queryKey: ['agente', id] });
        await queryClient.invalidateQueries({ queryKey: ['agentes'] });
      }}} />

      {/* Modal renomear */}
      <RenomearModal
        open={renomearOpen}
        onClose={() => setRenomearOpen(false)}
        agente={agente}
        onRenomeado={async (nomeNovo) => {
          await queryClient.invalidateQueries({ queryKey: ['agente', id] });
          await queryClient.invalidateQueries({ queryKey: ['agentes'] });
          showToast({ type: 'success', message: 'Nome atualizado.' });
          setRenomearOpen(false);
        }}
      />
    </AppLayout>
  );
}

function RenomearModal({
  open,
  onClose,
  agente,
  onRenomeado,
}: {
  open: boolean;
  onClose: () => void;
  agente: AgenteDetalhe;
  onRenomeado: (nome: string) => void;
}) {
  const [nome, setNome] = useState(agente.nome);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  async function handleSave() {
    const n = nome.trim();
    if (!n) { setError('Dê um nome para o agente.'); return; }
    if (n.length < NOME_MIN) { setError(`Use pelo menos ${NOME_MIN} caracteres.`); return; }
    if (n.length > NOME_MAX) { setError(`O nome pode ter no máximo ${NOME_MAX} caracteres.`); return; }

    setLoading(true);
    try {
      await atualizarAgente(agente.id, { nome: n });
      onRenomeado(n);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Renomear agente">
      <label className="text-[13px] font-bold text-[var(--ink)] block mb-1" htmlFor="rename-input">
        Nome do agente
      </label>
      <input
        id="rename-input"
        type="text"
        value={nome}
        onChange={(e) => { setNome(e.target.value); setError(''); }}
        maxLength={NOME_MAX}
        className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-2 focus:outline-[var(--proc)] ${error ? 'border-[var(--err)]' : 'border-[var(--line)]'}`}
      />
      {error && <p className="text-xs text-[var(--err)] mt-1">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button loading={loading} onClick={handleSave}>Salvar</Button>
      </div>
    </Modal>
  );
}
