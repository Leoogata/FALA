import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Volume2 } from 'lucide-react';
import { listarAgentes } from '../api/agentes';
import { TEXTOS_LIGACAO } from '../config';
import type { AgenteDetalhe, AgenteResumo } from '../api/types';

interface OutletCtx {
  agente: AgenteDetalhe;
}

function buildLista(nomes: string[]): string {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' ou ' + nomes[nomes.length - 1];
}

function speak(texto: string) {
  if (!window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(texto);
  utt.lang = 'pt-BR';
  window.speechSynthesis.speak(utt);
}

export function AbaLigacaoPage() {
  const { agente } = useOutletContext<OutletCtx>();
  const hasSpeech = 'speechSynthesis' in window;

  const { data: ativos = [] } = useQuery({
    queryKey: ['agentes', { ativa: true }],
    queryFn: () => listarAgentes({ ativa: true }),
  });

  // Lista de preview: ativos em ordem da API, + agente atual se inativo
  const previewNomes: string[] = (() => {
    const lista = ativos.map((a) => a.nome);
    if (!agente.ativa && !lista.includes(agente.nome)) {
      lista.push(agente.nome);
    }
    return lista;
  })();

  const listaTexto = buildLista(previewNomes);

  const isVazia = previewNomes.length === 0;

  const falaMenu = isVazia
    ? `${TEXTOS_LIGACAO.saudacao} ${TEXTOS_LIGACAO.semAgentes}`
    : `${TEXTOS_LIGACAO.saudacao} ${TEXTOS_LIGACAO.menu.replace('{lista}', listaTexto)}`;

  const falaEscolha = TEXTOS_LIGACAO.escolha.replace('{nome}', agente.nome);

  function ouvirTudo() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const textos = [falaMenu, agente.nome, falaEscolha];
    let i = 0;
    function next() {
      if (i >= textos.length) return;
      const utt = new SpeechSynthesisUtterance(textos[i++]);
      utt.lang = 'pt-BR';
      utt.onend = next;
      window.speechSynthesis.speak(utt);
    }
    next();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-[17px] font-bold text-[var(--navy)]">Como o aluno vai ouvir</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Simulação do começo de uma ligação. A leitura em voz usa o sintetizador do navegador.
          </p>
        </div>
        {hasSpeech && (
          <button
            onClick={ouvirTudo}
            className="flex items-center gap-1.5 text-sm text-[var(--proc)] hover:underline shrink-0"
          >
            <Volume2 size={15} /> Ouvir tudo
          </button>
        )}
      </div>

      {!agente.ativa && (
        <div className="bg-[var(--draft-bg)] border border-[var(--draft)] text-[var(--draft)] text-sm rounded-xl px-4 py-3 mb-4">
          Este agente está inativo: hoje ele não aparece no menu da ligação. A prévia mostra como ficaria depois de ativado.
        </div>
      )}

      {/* Roteiro */}
      <div className="flex flex-col gap-2">
        <FalaLinha
          quem="PONTE"
          texto={falaMenu}
          hasSpeech={hasSpeech}
        />

        {!isVazia && (
          <>
            <FalaLinha
              quem="ALUNO"
              texto={`"${agente.nome}"`}
              italic
            />
            <FalaLinha
              quem="PONTE"
              texto={falaEscolha}
              hasSpeech={hasSpeech}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FalaLinha({
  quem,
  texto,
  hasSpeech,
  italic = false,
}: {
  quem: 'PONTE' | 'ALUNO';
  texto: string;
  hasSpeech?: boolean;
  italic?: boolean;
}) {
  const isPonte = quem === 'PONTE';
  return (
    <div className={`flex gap-3 items-start rounded-xl px-4 py-3 border ${isPonte ? 'bg-[var(--ai-bg)] border-[var(--ai)]' : 'bg-[var(--soft)] border-[var(--line)]'}`}>
      <span className={`text-[10px] font-bold tracking-widest mt-0.5 shrink-0 w-10 ${isPonte ? 'text-[var(--ai)]' : 'text-[var(--muted)]'}`}>
        {quem}
      </span>
      <span className={`text-sm flex-1 ${italic ? 'italic text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
        {texto}
      </span>
      {isPonte && hasSpeech && (
        <button
          onClick={() => speak(texto)}
          aria-label={`Ouvir fala da Ponte`}
          className="shrink-0 text-[var(--ai)] hover:opacity-70"
        >
          <Volume2 size={15} />
        </button>
      )}
    </div>
  );
}
