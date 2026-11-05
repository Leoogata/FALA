import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Toggle } from '../components/ui/Toggle';
import { useToast } from '../components/ui/Toast';
import { listarAgentes, atualizarAgente } from '../api/agentes';
import { calcularStatus } from '../api/types';
import type { AgenteResumo, StatusAgente } from '../api/types';
import { tempoRelativo, formatarDataTooltip } from '../utils/date';
import { pluralizar, normalizarTexto } from '../utils/arquivo';
import { POLLING_LISTA_MS } from '../config';

type Filtro = 'todos' | StatusAgente;

function calcStatus(ag: AgenteResumo): StatusAgente {
  return calcularStatus(ag);
}

export function AgentesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as Filtro) ?? 'todos';
  const [search, setSearch] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  // Ler o id do agente recém-criado que veio do estado de navegação
  useEffect(() => {
    const state = window.history.state?.usr as { newAgentId?: string } | undefined;
    if (state?.newAgentId) {
      setHighlightId(state.newAgentId);
      setTimeout(() => setHighlightId(null), 2000);
      // Limpa o state para não re-ativar ao navegar de volta
      window.history.replaceState({ ...window.history.state, usr: {} }, '');
    }
  }, []);

  const { data: agentes, isLoading, isError, refetch } = useQuery({
    queryKey: ['agentes'],
    queryFn: () => listarAgentes(),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasProcessing = data.some((a) => a.docs.processando > 0);
      return hasProcessing ? POLLING_LISTA_MS : false;
    },
    refetchIntervalInBackground: false,
  });

  // Toast quando material muda para erro durante polling
  const prevData = useRef<AgenteResumo[]>([]);
  useEffect(() => {
    if (!agentes) return;
    const prev = prevData.current;
    if (prev.length > 0) {
      for (const ag of agentes) {
        const old = prev.find((a) => a.id === ag.id);
        if (old && old.docs.erro < ag.docs.erro) {
          showToast({ type: 'error', message: `Não foi possível processar um material de "${ag.nome}".` });
        }
      }
    }
    prevData.current = agentes;
  }, [agentes, showToast]);

  const handleToggle = useCallback(async (ag: AgenteResumo, value: boolean) => {
    setToggleLoading(ag.id);
    try {
      await atualizarAgente(ag.id, { ativa: value });
      await queryClient.invalidateQueries({ queryKey: ['agentes'] });
      if (value) {
        showToast({ message: `"${ag.nome}" está ativo e já aparece no menu da ligação.`, type: 'success' });
      } else {
        showToast({
          message: `"${ag.nome}" foi desativado. Os alunos não conseguem mais acessá-lo.`,
          type: 'success',
          duration: 7000,
          actionLabel: 'Desfazer',
          onAction: async () => {
            try {
              await atualizarAgente(ag.id, { ativa: true });
              await queryClient.invalidateQueries({ queryKey: ['agentes'] });
            } catch {
              showToast({ type: 'error', message: 'Não foi possível reativar o agente.' });
            }
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.';
      const isNoInstrucoes = (err as { erro?: string })?.erro === 'sem_instrucoes';
      showToast({
        type: 'error',
        message: msg,
        actionLabel: isNoInstrucoes ? 'Escrever instruções' : undefined,
        onAction: isNoInstrucoes ? () => navigate(`/agentes/${ag.id}/instrucoes`) : undefined,
        duration: isNoInstrucoes ? 7000 : undefined,
      });
    } finally {
      setToggleLoading(null);
    }
  }, [queryClient, showToast, navigate]);

  // Contagens para seletor segmentado
  const counts = React.useMemo(() => {
    if (!agentes) return { todos: 0, ativo: 0, inativo: 0, rascunho: 0 };
    return agentes.reduce(
      (acc, a) => {
        acc.todos++;
        acc[calcStatus(a)]++;
        return acc;
      },
      { todos: 0, ativo: 0, inativo: 0, rascunho: 0 },
    );
  }, [agentes]);

  // Resumo
  const resumo = React.useMemo(() => {
    if (!agentes) return { ativos: 0, processando: 0, erro: 0 };
    return agentes.reduce(
      (acc, a) => {
        if (a.ativa) acc.ativos++;
        acc.processando += a.docs.processando;
        acc.erro += a.docs.erro;
        return acc;
      },
      { ativos: 0, processando: 0, erro: 0 },
    );
  }, [agentes]);

  // Filtragem
  const filtered = React.useMemo(() => {
    if (!agentes) return [];
    const norm = normalizarTexto(search);
    return agentes.filter((a) => {
      const matchStatus = statusFilter === 'todos' || calcStatus(a) === statusFilter;
      const matchSearch = norm === '' || normalizarTexto(a.nome).includes(norm);
      return matchStatus && matchSearch;
    });
  }, [agentes, statusFilter, search]);

  function setFilter(f: Filtro) {
    setSearchParams(f === 'todos' ? {} : { status: f });
  }

  if (isLoading) {
    return (
      <AppLayout title="Agentes">
        <PageHeader />
        <div className="flex flex-col gap-3 mt-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout title="Agentes">
        <PageHeader />
        <div className="mt-10 text-center text-[var(--muted)]">
          <p className="mb-3">Não foi possível carregar os agentes.</p>
          <Button variant="secondary" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Agentes">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--navy)]">Agentes da escola</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-[600px]">
            Cada agente atende os alunos por telefone, respondendo com base nos materiais que a escola enviar.
          </p>
        </div>
        <Button onClick={() => navigate('/agentes/novo')}>
          <Plus size={16} /> Novo agente
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <SummaryCard value={resumo.ativos} singular="agente ativo no 0800" plural="agentes ativos no 0800" />
        <SummaryCard value={resumo.processando} singular="material processando" plural="materiais processando" />
        <SummaryCard
          value={resumo.erro}
          singular="material com erro"
          plural="materiais com erro"
          highlight={resumo.erro > 0}
        />
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Filtrar por status">
          {(['todos', 'ativo', 'inativo', 'rascunho'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${statusFilter === f ? 'bg-[var(--navy)] text-white border-[var(--navy)]' : 'bg-white border-[var(--line)] text-[var(--ink)] hover:bg-[var(--soft)]'}`}
            >
              {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
              {' '}({f === 'todos' ? counts.todos : counts[f]})
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <input
            type="search"
            placeholder="Buscar agente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56 px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-white focus:outline-2 focus:outline-[var(--proc)] focus:outline-offset-1"
            aria-label="Buscar agente"
          />
        </div>
      </div>

      {/* Tabela / lista */}
      {filtered.length === 0 ? (
        <EmptyFiltered onClear={() => { setFilter('todos'); setSearch(''); }} />
      ) : agentes?.length === 0 ? (
        <EmptyState onNew={() => navigate('/agentes/novo')} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-[var(--line)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--soft)]">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--ink)] text-[13px]">Agente</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--ink)] text-[13px]">Materiais</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--ink)] text-[13px]">Atualizado</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--ink)] text-[13px]">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((ag) => (
                  <AgentRow
                    key={ag.id}
                    ag={ag}
                    highlight={ag.id === highlightId}
                    onOpen={() => navigate(`/agentes/${ag.id}`)}
                    toggleLoading={toggleLoading === ag.id}
                    onToggle={(v) => handleToggle(ag, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((ag) => (
              <AgentCard
                key={ag.id}
                ag={ag}
                highlight={ag.id === highlightId}
                onOpen={() => navigate(`/agentes/${ag.id}`)}
                toggleLoading={toggleLoading === ag.id}
                onToggle={(v) => handleToggle(ag, v)}
              />
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}

function PageHeader() {
  const navigate = useNavigate();
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--navy)]">Agentes da escola</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Cada agente atende os alunos por telefone, respondendo com base nos materiais que a escola enviar.
        </p>
      </div>
      <Button onClick={() => navigate('/agentes/novo')}>
        <Plus size={16} /> Novo agente
      </Button>
    </div>
  );
}

function SummaryCard({
  value,
  singular,
  plural,
  highlight = false,
}: {
  value: number;
  singular: string;
  plural: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border px-5 py-4 ${highlight ? 'border-[var(--err)] text-[var(--err)]' : 'border-[var(--line)]'}`}>
      <div className={`text-2xl font-bold ${highlight ? 'text-[var(--err)]' : 'text-[var(--navy)]'}`}>{value}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{pluralizar(value, singular, plural)}</div>
    </div>
  );
}

function MaterialsCell({ ag }: { ag: AgenteResumo }) {
  if (ag.docs.pronto === 0 && ag.docs.processando === 0 && ag.docs.erro === 0) {
    return <span className="text-[var(--muted)] text-xs">Nenhum material</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {ag.docs.pronto > 0 && (
        <span className="text-xs text-[var(--ink)]">{pluralizar(ag.docs.pronto, 'pronto', 'prontos')}</span>
      )}
      {ag.docs.processando > 0 && <Badge variant="processando" label={`${ag.docs.processando} processando`} />}
      {ag.docs.erro > 0 && <Badge variant="erro" label={`${ag.docs.erro} com erro`} />}
    </div>
  );
}

function AgentRow({
  ag,
  highlight,
  onOpen,
  toggleLoading,
  onToggle,
}: {
  ag: AgenteResumo;
  highlight: boolean;
  onOpen: () => void;
  toggleLoading: boolean;
  onToggle: (v: boolean) => void;
}) {
  const status = calcStatus(ag);
  const locked = false;

  function handleRowKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') onOpen();
  }

  return (
    <tr
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleRowKey}
      className={`border-b border-[var(--line)] last:border-0 cursor-pointer hover:bg-[var(--soft)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--proc)] focus-visible:outline-offset-[-2px] ${highlight ? 'animate-highlight' : ''}`}
      aria-label={`Abrir agente ${ag.nome}`}
    >
      <td className="px-5 py-3 font-semibold text-[var(--navy)]">
        {ag.nome}
      </td>
      <td className="px-5 py-3">
        <MaterialsCell ag={ag} />
      </td>
      <td className="px-5 py-3 text-xs text-[var(--muted)] whitespace-nowrap" title={formatarDataTooltip(ag.atualizada_em)}>
        {tempoRelativo(ag.atualizada_em)}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Toggle
            checked={ag.ativa}
            onChange={onToggle}
            ariaLabel={ag.ativa ? `Desativar ${ag.nome}` : `Ativar ${ag.nome}`}
            locked={locked}
            loading={toggleLoading}
          />
          <Badge variant={status} />
        </div>
      </td>
      <td className="px-3 py-3 text-[var(--muted)]" aria-hidden="true">
        <ChevronRight size={16} />
      </td>
    </tr>
  );
}

function AgentCard({
  ag,
  highlight,
  onOpen,
  toggleLoading,
  onToggle,
}: {
  ag: AgenteResumo;
  highlight: boolean;
  onOpen: () => void;
  toggleLoading: boolean;
  onToggle: (v: boolean) => void;
}) {
  const status = calcStatus(ag);
  const locked = false;

  return (
    <div
      className={`bg-white rounded-xl border border-[var(--line)] p-4 flex gap-3 cursor-pointer hover:bg-[var(--soft)] ${highlight ? 'animate-highlight' : ''}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      role="button"
      aria-label={`Abrir agente ${ag.nome}`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[var(--navy)] mb-1">{ag.nome}</div>
        <MaterialsCell ag={ag} />
        <div className="text-xs text-[var(--muted)] mt-1" title={formatarDataTooltip(ag.atualizada_em)}>
          Atualizado {tempoRelativo(ag.atualizada_em)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Badge variant={status} />
        <Toggle
          checked={ag.ativa}
          onChange={onToggle}
          ariaLabel={ag.ativa ? `Desativar ${ag.nome}` : `Ativar ${ag.nome}`}
          locked={locked}
          loading={toggleLoading}
        />
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-10 text-center text-[var(--muted)]">
      <p className="mb-4">A escola ainda não tem agentes.</p>
      <Button onClick={onNew}><Plus size={16} /> Criar o primeiro agente</Button>
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-10 text-center text-[var(--muted)]">
      <p className="mb-2">Nenhum agente encontrado.</p>
      <button onClick={onClear} className="text-[var(--proc)] underline text-sm">Limpar filtros</button>
    </div>
  );
}
