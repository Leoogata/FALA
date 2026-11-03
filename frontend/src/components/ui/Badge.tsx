import React from 'react';
import type { StatusAgente } from '../../api/types';

type BadgeVariant =
  | StatusAgente
  | 'pronto'
  | 'processando'
  | 'enviando'
  | 'erro'
  | 'pdf'
  | 'txt'
  | 'em_breve';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  ativo: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  inativo: 'bg-[var(--off-bg)] text-[var(--off)]',
  rascunho: 'bg-[var(--draft-bg)] text-[var(--draft)]',
  pronto: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  processando: 'bg-[var(--proc-bg)] text-[var(--proc)]',
  enviando: 'bg-[var(--proc-bg)] text-[var(--proc)]',
  erro: 'bg-[var(--err-bg)] text-[var(--err)]',
  pdf: 'bg-[var(--off-bg)] text-[var(--off)]',
  txt: 'bg-[var(--off-bg)] text-[var(--off)]',
  em_breve: 'bg-[var(--draft-bg)] text-[var(--draft)]',
};

const LABELS: Record<BadgeVariant, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  rascunho: 'Rascunho',
  pronto: 'Pronto',
  processando: 'Processando',
  enviando: 'Enviando',
  erro: 'Erro',
  pdf: 'PDF',
  txt: 'TXT',
  em_breve: 'em breve',
};

const SPINNING = new Set<BadgeVariant>(['processando', 'enviando']);

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

export function Badge({ variant, label, className = '' }: BadgeProps) {
  const text = label ?? LABELS[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {SPINNING.has(variant) && (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      )}
      {text}
    </span>
  );
}
