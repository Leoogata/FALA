import React, { useRef, useState } from 'react';
import { Sparkles, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { melhorarInstrucoes } from '../../api/instrucoes';
import { REGRAS_FIXAS, INSTRUCOES_MIN, INSTRUCOES_MAX } from '../../config';
import type { AgenteDetalhe } from '../../api/types';

interface InstrucoesEditorProps {
  agente: AgenteDetalhe;
  value: string;
  onChange: (v: string) => void;
  context: 'criacao' | 'aba';
}

export function InstrucoesEditor({ agente, value, onChange, context }: InstrucoesEditorProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sugestao, setSugestao] = useState<{ texto: string; mudancas: string[]; premissas: string[] } | null>(null);
  const [textoAnterior, setTextoAnterior] = useState<string | null>(null);
  const [regrasFechadas, setRegrasFechadas] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const charCount = trimmed.length;
  const canMelhorar = charCount >= INSTRUCOES_MIN && !loading;

  async function handleMelhorar() {
    setLoading(true);
    try {
      const res = await melhorarInstrucoes(agente.nome, value);
      setSugestao({ texto: res.texto_sugerido, mudancas: res.mudancas, premissas: res.premissas });
    } catch {
      showToast({ type: 'error', message: 'Não foi possível melhorar o texto agora. Tente de novo.' });
    } finally {
      setLoading(false);
    }
  }

  function usarSugestao(editar = false) {
    if (!sugestao) return;
    setTextoAnterior(value);
    onChange(sugestao.texto);
    setSugestao(null);
    if (!editar) {
      const msg = context === 'aba'
        ? 'Sugestão aplicada. Clique em "Salvar instruções" para valer nas ligações.'
        : 'Sugestão aplicada.';
      showToast({ type: 'success', message: msg });
    } else {
      // posiciona cursor no fim
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 50);
    }
  }

  function descartarSugestao() {
    setSugestao(null);
  }

  function voltarTextoAnterior() {
    if (textoAnterior !== null) {
      onChange(textoAnterior);
      setTextoAnterior(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Textarea */}
      <div>
        <label htmlFor="instrucoes-editor" className="block text-[13px] font-bold text-[var(--ink)] mb-1">
          Instruções do agente <span aria-hidden="true" className="text-[var(--err)]">*</span>
        </label>
        <textarea
          ref={textareaRef}
          id="instrucoes-editor"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, INSTRUCOES_MAX))}
          rows={8}
          placeholder="Ex.: quero que ele ajude os alunos do 9º ano a revisar equações e porcentagem para o simulado, explicando com calma e sem dar a resposta pronta."
          className="w-full px-3 py-2 rounded-lg border border-[var(--line)] text-sm resize-y focus:outline-2 focus:outline-[var(--proc)] focus:outline-offset-1 min-h-[120px]"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] text-[var(--muted)]">
            {charCount} caracteres{charCount < INSTRUCOES_MIN ? ` · mínimo ${INSTRUCOES_MIN}` : ''}
          </span>
          <div className="flex items-center gap-3">
            {textoAnterior !== null && (
              <button
                type="button"
                onClick={voltarTextoAnterior}
                className="text-xs text-[var(--proc)] hover:underline"
              >
                Voltar ao meu texto
              </button>
            )}
            <Button
              variant="ai"
              size="sm"
              disabled={!canMelhorar}
              loading={loading}
              onClick={handleMelhorar}
            >
              <Sparkles size={14} />
              Melhorar com IA
            </Button>
          </div>
        </div>
      </div>

      {/* Loading de IA */}
      {loading && (
        <div className="bg-[var(--ai-bg)] border border-[var(--ai)] rounded-xl p-4 flex items-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-[var(--ai)] border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-sm text-[var(--ai)]">Entendendo a sua intenção e reescrevendo as instruções…</span>
        </div>
      )}

      {/* Painel de sugestão */}
      {sugestao && (
        <div className="border border-[var(--ai)] rounded-xl overflow-hidden">
          <div className="bg-[var(--ai-bg)] px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-[var(--ai)] text-sm">Sugestão da IA</span>
            <span className="text-xs text-[var(--muted)]">Revise antes de usar. Você continua no controle.</span>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {/* Comparação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[13px] font-bold text-[var(--muted)] mb-1">Seu texto</div>
                <div className="text-sm whitespace-pre-wrap bg-[var(--soft)] rounded-lg p-3 border border-[var(--line)] min-h-[80px]">
                  {value}
                </div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--ai)] mb-1">Versão sugerida</div>
                <div className="text-sm whitespace-pre-wrap bg-[var(--ai-bg)] rounded-lg p-3 border border-[var(--ai)] min-h-[80px]">
                  {sugestao.texto}
                </div>
              </div>
            </div>

            {/* Listas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sugestao.mudancas.length > 0 && (
                <div>
                  <div className="text-[13px] font-bold text-[var(--ink)] mb-1">O que mudou</div>
                  <ul className="text-xs text-[var(--ink)] list-disc pl-4 flex flex-col gap-0.5">
                    {sugestao.mudancas.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {sugestao.premissas.length > 0 && (
                <div>
                  <div className="text-[13px] font-bold text-[var(--draft)] mb-1">A IA assumiu — confira</div>
                  <ul className="text-xs text-[var(--draft)] list-disc pl-4 flex flex-col gap-0.5">
                    {sugestao.premissas.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => usarSugestao(false)}>Usar sugestão</Button>
              <Button variant="secondary" onClick={() => usarSugestao(true)}>Usar e editar</Button>
              <Button variant="ghost" onClick={descartarSugestao}>Descartar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Regras fixas */}
      <div className="border border-dashed border-[var(--line)] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setRegrasFechadas((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--soft)] transition-colors"
          aria-expanded={!regrasFechadas}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
            <Lock size={14} />
            Regras fixas da Ponte — valem para todos os agentes
          </div>
          {regrasFechadas ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronUp size={16} className="text-[var(--muted)]" />}
        </button>
        {!regrasFechadas && (
          <ul className="px-4 pb-4 pt-1 flex flex-col gap-1.5 text-xs text-[var(--muted)] list-disc pl-8">
            {REGRAS_FIXAS.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
