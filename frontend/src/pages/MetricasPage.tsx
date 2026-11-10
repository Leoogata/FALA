import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { buscarMateriasPorEscola } from '../api/analytics';
import type { AnalyticsMaterias, MateriasItem } from '../api/types';

type Dias = 1 | 7;

const ROTULOS: Record<MateriasItem['materia'], string> = {
  ciencias: 'Ciências',
  historia: 'História',
  matematica: 'Matemática',
  portugues: 'Português',
  geografia: 'Geografia',
};

// Cores distintas por matéria para a barra de progresso
const CORES: Record<MateriasItem['materia'], string> = {
  matematica: '#3b82f6',
  ciencias:   '#10b981',
  portugues:  '#f59e0b',
  historia:   '#8b5cf6',
  geografia:  '#ef4444',
};

function BarraMateria({ item, total }: { item: MateriasItem; total: number }) {
  const largura = total > 0 ? Math.max(item.percentual, item.total > 0 ? 1 : 0) : 0;
  const cor = CORES[item.materia];
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--ink)]">{ROTULOS[item.materia]}</span>
        <span className="text-[var(--muted)]" aria-label={`${item.total} dúvidas, ${item.percentual}%`}>
          <strong>{item.total}</strong>
          {' '}
          <span className="text-xs">({item.percentual}%)</span>
        </span>
      </div>
      <div
        className="w-full rounded-full bg-[var(--line)] h-2.5"
        role="progressbar"
        aria-valuenow={item.total}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={ROTULOS[item.materia]}
      >
        <div
          className="h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${largura}%`, backgroundColor: cor }}
        />
      </div>
    </li>
  );
}

function CartaoMetrica({
  rotulo,
  valor,
  descricao,
  destaque,
}: {
  rotulo: string;
  valor: string | number;
  descricao: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border px-5 py-4 ${destaque ? 'border-[var(--err)]' : 'border-[var(--line)]'}`}
    >
      <div className={`text-2xl font-bold ${destaque ? 'text-[var(--err)]' : 'text-[var(--navy)]'}`}>{valor}</div>
      <div className="text-[13px] font-medium text-[var(--ink)] mt-0.5">{rotulo}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{descricao}</div>
    </div>
  );
}

function PainelMaterias({ dados, dias }: { dados: AnalyticsMaterias; dias: Dias }) {
  const { periodo, total, classificadas, indeterminadas, falhasClassificacao, coberturaPercentual, materias } = dados;

  const inicioPt = new Date(periodo.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const fimPt    = new Date(periodo.fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  return (
    <div>
      <p className="text-sm text-[var(--muted)] mb-5" aria-live="polite">
        Período: {inicioPt} a {fimPt} ({dias === 1 ? 'últimas 24 horas' : 'últimos 7 dias'})
      </p>

      {/* Cartões de totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <CartaoMetrica
          rotulo="Total de turnos"
          valor={total}
          descricao="com classificação tentada"
        />
        <CartaoMetrica
          rotulo="Cobertura"
          valor={`${coberturaPercentual}%`}
          descricao="dúvidas com matéria definida"
        />
        <CartaoMetrica
          rotulo="Sem classificação"
          valor={indeterminadas}
          descricao="dúvidas indeterminadas"
        />
        <CartaoMetrica
          rotulo="Falha na classificação"
          valor={falhasClassificacao}
          descricao="erro no modelo"
          destaque={falhasClassificacao > 0}
        />
      </div>

      {/* Barras por matéria */}
      <div className="bg-white rounded-xl border border-[var(--line)] px-6 py-5">
        <h2 className="text-base font-semibold text-[var(--navy)] mb-4">
          Dúvidas por matéria
          {' '}
          <span className="text-[13px] font-normal text-[var(--muted)]">
            ({classificadas} classificadas de {total})
          </span>
        </h2>

        {total === 0 ? (
          <p className="text-sm text-[var(--muted)] py-4 text-center">
            Nenhuma dúvida registrada neste período.
          </p>
        ) : (
          <ul className="flex flex-col gap-4" aria-label="Dúvidas por matéria">
            {materias.map((item) => (
              <BarraMateria key={item.materia} item={item} total={total} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function MetricasPage() {
  const [dias, setDias] = useState<Dias>(7);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analytics-materias', dias],
    queryFn: () => buscarMateriasPorEscola(dias),
    staleTime: 60_000,
  });

  return (
    <AppLayout title="Métricas">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-[22px] font-bold text-[var(--navy)]">Métricas</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-[620px]">
            Quantas dúvidas os alunos trouxeram por matéria. A contagem mede a demanda
            recebida pelo FALA — cada turno de voz aceito conta uma vez.
          </p>
        </div>

        {/* Seletor de período */}
        <div
          className="flex gap-1"
          role="group"
          aria-label="Selecionar período"
        >
          {([7, 1] as Dias[]).map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              aria-pressed={dias === d}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                dias === d
                  ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                  : 'bg-white border-[var(--line)] text-[var(--ink)] hover:bg-[var(--soft)]'
              }`}
            >
              {d === 7 ? 'Últimos 7 dias' : 'Últimas 24 h'}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="bg-white rounded-xl border border-[var(--line)] p-10 text-center text-[var(--muted)]">
          <p className="mb-3">Não foi possível carregar as métricas.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && !isLoading && (
        <PainelMaterias dados={data} dias={dias} />
      )}
    </AppLayout>
  );
}
