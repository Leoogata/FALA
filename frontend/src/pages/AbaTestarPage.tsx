import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Volume2, RotateCcw } from 'lucide-react';
import { testarAgente } from '../api/testar';
import { useToast } from '../components/ui/Toast';
import type { AgenteDetalhe } from '../api/types';

interface OutletCtx {
  agente: AgenteDetalhe;
}

interface Mensagem {
  id: string;
  tipo: 'pergunta' | 'aguardando' | 'resposta' | 'erro';
  texto?: string;
  confianca?: number;
  semResposta?: boolean;
}

const SUGESTOES = [
  'Me explica o assunto principal do material',
  'Quem ganhou a Copa de 2002?',
];

export function AbaTestarPage() {
  const { agente } = useOutletContext<OutletCtx>();
  const { showToast } = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState('');
  const [aguardando, setAguardando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function enviar(texto: string) {
    if (!texto.trim() || aguardando) return;
    const p = texto.trim();
    setPergunta('');
    setAguardando(true);

    setMensagens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), tipo: 'pergunta', texto: p },
      { id: crypto.randomUUID(), tipo: 'aguardando' },
    ]);

    try {
      const res = await testarAgente(agente.id, p);
      setMensagens((prev) => [
        ...prev.filter((m) => m.tipo !== 'aguardando'),
        {
          id: crypto.randomUUID(),
          tipo: 'resposta',
          texto: res.resposta,
          confianca: res.confianca,
          semResposta: res.sem_resposta,
        },
      ]);
    } catch {
      setMensagens((prev) => [
        ...prev.filter((m) => m.tipo !== 'aguardando'),
        { id: crypto.randomUUID(), tipo: 'erro' },
      ]);
    } finally {
      setAguardando(false);
    }
  }

  function speak(texto: string) {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(texto);
    utt.lang = 'pt-BR';
    window.speechSynthesis.speak(utt);
  }

  const semMaterial = agente.docs.pronto === 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[17px] font-bold text-[var(--navy)]">Teste o agente antes dos alunos</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">Aqui a conversa é por texto; na ligação, cada resposta é falada. O teste não é salvo.</p>
        </div>
        {mensagens.length > 0 && (
          <button
            onClick={() => setMensagens([])}
            aria-label="Limpar conversa"
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1"
          >
            <RotateCcw size={13} /> Limpar
          </button>
        )}
      </div>

      {semMaterial && (
        <div className="bg-[var(--draft-bg)] border border-[var(--draft)] text-[var(--draft)] text-sm rounded-xl px-4 py-3 mb-4">
          Sem material pronto, o agente sempre vai responder que não sabe.
        </div>
      )}

      {/* Área de conversa */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-4 min-h-[220px] max-h-[380px] overflow-y-auto flex flex-col gap-3 mb-3">
        {mensagens.length === 0 && (
          <p className="text-sm text-[var(--muted)] m-auto text-center">Faça uma pergunta como se fosse um aluno.</p>
        )}
        {mensagens.map((m) => (
          <MensagemBubble key={m.id} msg={m} onSpeak={speak} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Sugestões */}
      <div className="flex gap-2 flex-wrap mb-3">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => enviar(s)}
            disabled={aguardando}
            className="text-xs px-3 py-1.5 bg-[var(--soft)] border border-[var(--line)] rounded-full hover:bg-[var(--line)] transition-colors disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Campo de envio */}
      <div className="flex gap-2">
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') enviar(pergunta); }}
          placeholder="Digite uma pergunta…"
          disabled={aguardando}
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--line)] text-sm focus:outline-2 focus:outline-[var(--proc)] disabled:opacity-50"
        />
        <button
          onClick={() => enviar(pergunta)}
          disabled={aguardando || !pergunta.trim()}
          className="px-4 py-2 bg-[var(--navy)] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#252b50]"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function MensagemBubble({ msg, onSpeak }: { msg: Mensagem; onSpeak: (t: string) => void }) {
  const hasSpeech = 'speechSynthesis' in window;

  if (msg.tipo === 'pergunta') {
    return (
      <div className="flex justify-end">
        <div className="bg-[var(--navy)] text-white rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm">
          {msg.texto}
        </div>
      </div>
    );
  }

  if (msg.tipo === 'aguardando') {
    return (
      <div className="flex justify-start">
        <div className="bg-white border border-[var(--line)] rounded-xl rounded-tl-sm px-4 py-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (msg.tipo === 'resposta') {
    const pct = Math.round((msg.confianca ?? 0) * 100);
    return (
      <div className="flex justify-start">
        <div className={`bg-white rounded-xl rounded-tl-sm px-4 py-2.5 max-w-[75%] text-sm border ${msg.semResposta ? 'border-[var(--err-bg)]' : 'border-[var(--line)]'}`}>
          <p>{msg.texto}</p>
          <div className="flex items-center gap-2 mt-2">
            {!msg.semResposta ? (
              <span className="text-[11px] font-bold bg-[var(--ok-bg)] text-[var(--ok)] px-2 py-0.5 rounded-full">
                confiança {pct}%
              </span>
            ) : (
              <span className="text-[11px] font-bold bg-[var(--err-bg)] text-[var(--err)] px-2 py-0.5 rounded-full">
                Sem resposta nos materiais
              </span>
            )}
            {hasSpeech && msg.texto && (
              <button
                onClick={() => onSpeak(msg.texto!)}
                aria-label="Ouvir resposta"
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <Volume2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="text-sm text-[var(--muted)] bg-[var(--soft)] border border-[var(--line)] rounded-xl rounded-tl-sm px-4 py-2.5">
        Não foi possível obter a resposta. Tente de novo.
      </div>
    </div>
  );
}
