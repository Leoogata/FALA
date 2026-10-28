import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Volume2 } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import { InstrucoesEditor } from '../components/agent/InstrucoesEditor';
import { MaterialUploadArea } from '../components/agent/MaterialUploadArea';
import { MaterialList } from '../components/agent/MaterialList';
import { criarAgente, atualizarAgente, listarAgentes } from '../api/agentes';
import type { AgenteDetalhe, Material } from '../api/types';
import { NOME_MIN, NOME_MAX } from '../config';
import { normalizarTexto } from '../utils/arquivo';

type Etapa = 1 | 2 | 3 | 4;

export function NovoAgentePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [agente, setAgente] = useState<AgenteDetalhe | null>(null);
  const [nome, setNome] = useState('');
  const [nomeError, setNomeError] = useState('');
  const [instrucoes, setInstrucoes] = useState('');
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [ativarAgora, setAtivarAgora] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: agentesLista } = useQuery({ queryKey: ['agentes'], queryFn: () => listarAgentes() });

  // Calcula docs para etapa 4
  const docsResumo = React.useMemo(() => {
    return materiais.reduce(
      (acc, m) => {
        if (m.status_indexacao === 'pronto') acc.pronto++;
        else if (m.status_indexacao === 'processando') acc.processando++;
        else acc.erro++;
        return acc;
      },
      { pronto: 0, processando: 0, erro: 0 },
    );
  }, [materiais]);

  // Habilita "Ativar agora" quando material fica pronto
  useEffect(() => {
    if (docsResumo.pronto > 0) setAtivarAgora(true);
  }, [docsResumo.pronto]);

  // Speach synthesis
  const speak = () => {
    if (!window.speechSynthesis) return;
    if (!nome.trim()) { showToast({ type: 'error', message: 'Escreva o nome primeiro.' }); return; }
    const utt = new SpeechSynthesisUtterance(`Agora você está estudando ${nome}.`);
    utt.lang = 'pt-BR';
    window.speechSynthesis.speak(utt);
  };

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  function validateNome(): string {
    const n = nome.trim();
    if (!n) return 'Dê um nome para o agente.';
    if (n.length < NOME_MIN) return `Use pelo menos ${NOME_MIN} caracteres.`;
    if (n.length > NOME_MAX) return `O nome pode ter no máximo ${NOME_MAX} caracteres.`;
    const norm = normalizarTexto(n);
    if (agentesLista?.some((a) => a.id !== agente?.id && normalizarTexto(a.nome) === norm)) {
      return 'Já existe um agente com esse nome. Na ligação, o aluno não conseguiria diferenciar os dois.';
    }
    return '';
  }

  async function handleEtapa1() {
    const err = validateNome();
    if (err) { setNomeError(err); return; }
    setNomeError('');
    setLoading(true);
    try {
      if (!agente) {
        const novo = await criarAgente(nome.trim());
        setAgente(novo);
        await queryClient.invalidateQueries({ queryKey: ['agentes'] });
      } else {
        const updated = await atualizarAgente(agente.id, { nome: nome.trim() });
        setAgente(updated);
        await queryClient.invalidateQueries({ queryKey: ['agentes'] });
      }
      setEtapa(2);
    } catch (err: unknown) {
      setNomeError(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEtapa2() {
    const instr = instrucoes.trim();
    if (instr.length < 20) {
      showToast({ type: 'error', message: 'Descreva com pelo menos 20 caracteres o que o agente deve fazer.' });
      return;
    }
    if (!agente) return;
    setLoading(true);
    try {
      const updated = await atualizarAgente(agente.id, { instrucoes: instr });
      setAgente(updated);
      setEtapa(3);
    } catch (err: unknown) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Algo deu errado.' });
    } finally {
      setLoading(false);
    }
  }

  function handleEtapa3() {
    setEtapa(4);
  }

  async function handleConcluir() {
    if (!agente) return;
    setLoading(true);
    let ativado = false;
    if (ativarAgora && docsResumo.pronto > 0) {
      try {
        await atualizarAgente(agente.id, { ativa: true });
        ativado = true;
      } catch (err: unknown) {
        showToast({ type: 'error', message: err instanceof Error ? err.message : 'Não foi possível ativar o agente.' });
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['agentes'] });
    setLoading(false);

    const toastMsg = ativado
      ? `"${agente.nome}" criado e ativo no 0800.`
      : `"${agente.nome}" criado (inativo).`;

    navigate('/agentes', { state: { newAgentId: agente.id } });
    showToast({
      type: 'success',
      message: toastMsg,
      actionLabel: 'Testar agora',
      onAction: () => navigate(`/agentes/${agente.id}/testar`),
      duration: 7000,
    });
  }

  function handleCancelarSair() {
    if (etapa === 1 && !agente) {
      if (nome.trim()) { setShowCancelModal(true); return; }
      navigate('/agentes');
    } else {
      const nomeAgente = agente?.nome ?? nome;
      navigate('/agentes');
      showToast({ type: 'success', message: `Rascunho "${nomeAgente}" salvo.` });
    }
  }

  const subtitulo = agente ? 'Rascunho salvo.' : 'Leva uns 5 minutos. Tudo pode ser editado depois.';

  return (
    <AppLayout title="Novo agente">
      {/* Topo */}
      <div className="mb-6">
        <button
          onClick={handleCancelarSair}
          className="text-sm text-[var(--proc)] hover:underline mb-2 inline-block"
        >
          ← Agentes
        </button>
        <h1 className="text-[22px] font-bold text-[var(--navy)]">Novo agente</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{subtitulo}</p>
      </div>

      {/* Indicador de etapas */}
      <StepIndicator etapa={etapa} concluidas={agente ? (etapa > 1 ? etapa - 1 : 0) : 0} onGoTo={(e) => { if (agente && e < etapa) setEtapa(e); }} />

      {/* Conteúdo da etapa */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-6 mt-6 mb-24">
        {etapa === 1 && (
          <Etapa1
            nome={nome}
            setNome={(v) => { setNome(v); if (nomeError) setNomeError(''); }}
            nomeError={nomeError}
            onSpeak={speak}
            hasSpeech={hasSpeech}
          />
        )}
        {etapa === 2 && agente && (
          <Etapa2
            agente={agente}
            instrucoes={instrucoes}
            setInstrucoes={setInstrucoes}
          />
        )}
        {etapa === 3 && agente && (
          <Etapa3
            agente={agente}
            materiais={materiais}
            setMateriais={setMateriais}
          />
        )}
        {etapa === 4 && agente && (
          <Etapa4
            agente={agente}
            instrucoes={instrucoes}
            docsResumo={docsResumo}
            ativarAgora={ativarAgora}
            setAtivarAgora={setAtivarAgora}
            onEditEtapa={setEtapa}
            onSpeak={speak}
            hasSpeech={hasSpeech}
          />
        )}
      </div>

      {/* Rodapé fixo */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[248px] bg-white border-t border-[var(--line)] px-6 py-4 flex items-center justify-between z-20">
        <Button variant="ghost" onClick={handleCancelarSair}>
          {agente ? 'Sair e continuar depois' : 'Cancelar'}
        </Button>
        <div className="flex gap-2">
          {etapa > 1 && (
            <Button variant="secondary" onClick={() => setEtapa((e) => (e - 1) as Etapa)}>
              Voltar
            </Button>
          )}
          {etapa < 4 ? (
            <Button
              loading={loading}
              onClick={etapa === 1 ? handleEtapa1 : etapa === 2 ? handleEtapa2 : handleEtapa3}
            >
              {etapa === 3 && materiais.length === 0 ? 'Pular por enquanto' : 'Continuar'}
            </Button>
          ) : (
            <Button loading={loading} onClick={handleConcluir}>
              Concluir
            </Button>
          )}
        </div>
      </div>

      {/* Modal cancelar */}
      <ConfirmModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={() => navigate('/agentes')}
        title="Cancelar criação?"
        confirmLabel="Cancelar criação"
        confirmVariant="destructive"
      >
        O agente não será salvo.
      </ConfirmModal>
    </AppLayout>
  );
}

function StepIndicator({
  etapa,
  concluidas,
  onGoTo,
}: {
  etapa: Etapa;
  concluidas: number;
  onGoTo: (e: Etapa) => void;
}) {
  const steps = [
    { n: 1, label: 'Identificação' },
    { n: 2, label: 'Instruções' },
    { n: 3, label: 'Materiais' },
    { n: 4, label: 'Revisão' },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {steps.map(({ n, label }) => {
        const done = n <= concluidas;
        const current = n === etapa;
        const clickable = done && n < etapa;
        return (
          <button
            key={n}
            disabled={!clickable}
            onClick={() => clickable && onGoTo(n as Etapa)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              current
                ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                : done
                ? 'bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--ok)] cursor-pointer hover:opacity-90'
                : 'bg-[var(--soft)] text-[var(--muted)] border-[var(--line)] cursor-default opacity-60'
            }`}
          >
            {done ? <Check size={13} /> : <span className="text-xs">{n}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Etapa1({
  nome,
  setNome,
  nomeError,
  onSpeak,
  hasSpeech,
}: {
  nome: string;
  setNome: (v: string) => void;
  nomeError: string;
  onSpeak: () => void;
  hasSpeech: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div>
      <h2 className="text-[17px] font-bold text-[var(--navy)] mb-4">Como o agente vai se chamar?</h2>
      <label className="block text-[13px] font-bold text-[var(--ink)] mb-1" htmlFor="nome-agente">
        Nome do agente <span aria-hidden="true" className="text-[var(--err)]">*</span>
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="nome-agente"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Matemática 9º ano"
          maxLength={NOME_MAX}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-2 focus:outline-[var(--proc)] focus:outline-offset-1 ${nomeError ? 'border-[var(--err)]' : 'border-[var(--line)]'}`}
          aria-describedby={nomeError ? 'nome-error' : 'nome-help'}
        />
        {hasSpeech && (
          <button
            type="button"
            onClick={onSpeak}
            aria-label="Ouvir o nome do agente"
            className="px-3 py-2 rounded-lg border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--soft)]"
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>
      {nomeError ? (
        <p id="nome-error" className="text-[var(--err)] text-xs mt-1">{nomeError}</p>
      ) : (
        <p id="nome-help" className="text-[12px] text-[var(--muted)] mt-1">
          É este nome que a ligação fala para o aluno escolher. Use palavras simples, sem siglas ou abreviações.
        </p>
      )}
    </div>
  );
}

function Etapa2({
  agente,
  instrucoes,
  setInstrucoes,
}: {
  agente: AgenteDetalhe;
  instrucoes: string;
  setInstrucoes: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-[17px] font-bold text-[var(--navy)] mb-1">O que o agente deve fazer?</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Escreva com suas palavras. Se quiser, a IA reescreve como uma instrução mais clara para o agente.
      </p>
      <InstrucoesEditor
        agente={agente}
        value={instrucoes}
        onChange={setInstrucoes}
        context="criacao"
      />
    </div>
  );
}

function Etapa3({
  agente,
  materiais,
  setMateriais,
}: {
  agente: AgenteDetalhe;
  materiais: Material[];
  setMateriais: React.Dispatch<React.SetStateAction<Material[]>>;
}) {
  return (
    <div>
      <h2 className="text-[17px] font-bold text-[var(--navy)] mb-1">Materiais do agente</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        O agente só responde com base nestes arquivos. Você pode pular e enviar depois.
      </p>
      <MaterialUploadArea agente={agente} onUploaded={(m) => setMateriais((prev) => [m, ...prev])} />
      <MaterialList
        agente={agente}
        materiais={materiais}
        setMateriais={setMateriais}
      />
    </div>
  );
}

function Etapa4({
  agente,
  instrucoes,
  docsResumo,
  ativarAgora,
  setAtivarAgora,
  onEditEtapa,
  onSpeak,
  hasSpeech,
}: {
  agente: AgenteDetalhe;
  instrucoes: string;
  docsResumo: { pronto: number; processando: number; erro: number };
  ativarAgora: boolean;
  setAtivarAgora: (v: boolean) => void;
  onEditEtapa: (e: Etapa) => void;
  onSpeak: () => void;
  hasSpeech: boolean;
}) {
  const materiaisTexto = (() => {
    const parts = [];
    if (docsResumo.pronto > 0) parts.push(`${docsResumo.pronto} pronto${docsResumo.pronto > 1 ? 's' : ''}`);
    if (docsResumo.processando > 0) parts.push(`${docsResumo.processando} processando`);
    if (docsResumo.erro > 0) parts.push(`${docsResumo.erro} com erro`);
    return parts.length > 0 ? parts.join(' · ') : 'Nenhum material enviado';
  })();

  return (
    <div>
      <h2 className="text-[17px] font-bold text-[var(--navy)] mb-1">Revisão</h2>
      <p className="text-sm text-[var(--muted)] mb-5">Confira antes de concluir. Tudo pode ser editado depois.</p>

      <div className="flex flex-col gap-4 mb-6">
        <ReviewRow label="Nome" action={<EditLink onClick={() => onEditEtapa(1)} />}>
          <div className="flex items-center gap-2">
            <span>{agente.nome}</span>
            {hasSpeech && (
              <button onClick={onSpeak} aria-label="Ouvir nome" className="text-[var(--muted)] hover:text-[var(--ink)]">
                <Volume2 size={14} />
              </button>
            )}
          </div>
        </ReviewRow>

        <ReviewRow label="Instruções" action={<EditLink onClick={() => onEditEtapa(2)} />}>
          {instrucoes ? (
            <div className="max-h-[150px] overflow-y-auto text-sm whitespace-pre-wrap bg-[var(--soft)] rounded-lg p-3 border border-[var(--line)]">
              {instrucoes}
            </div>
          ) : (
            <span className="text-[var(--muted)] text-sm">Nenhuma instrução escrita.</span>
          )}
        </ReviewRow>

        <ReviewRow label="Materiais" action={<EditLink onClick={() => onEditEtapa(3)} />}>
          <span className="text-sm">{materiaisTexto}</span>
        </ReviewRow>
      </div>

      {/* Checkbox Ativar agora */}
      <div className="border border-[var(--line)] rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ativarAgora}
            onChange={(e) => setAtivarAgora(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[var(--navy)]"
          />
          <div>
            <span className="font-semibold text-sm">Ativar agora</span>
            <p className="text-xs text-[var(--muted)] mt-0.5">O agente passa a aparecer no menu da ligação para os alunos.</p>
          </div>
        </label>
        {docsResumo.processando > 0 && (
          <div className="mt-3 bg-[var(--draft-bg)] text-[var(--draft)] text-xs rounded-lg p-3">
            Os materiais ainda estão sendo processados. Você pode concluir agora e ativar o agente quando eles ficarem prontos.
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--muted)] mt-3">
        Depois de concluir, use a aba Testar para fazer perguntas como se fosse um aluno.
      </p>
    </div>
  );
}

function ReviewRow({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wide">{label}</div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[var(--proc)] text-xs hover:underline shrink-0 mt-1">
      editar
    </button>
  );
}
