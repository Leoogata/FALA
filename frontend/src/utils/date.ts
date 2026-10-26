// Formata datas ISO como tempo relativo em pt-BR
export function tempoRelativo(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);

  if (sec < 60) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (h < 24) return `há ${h} h`;
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;

  return formatarDataCurta(iso);
}

export function formatarDataCurta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatarDataTooltip(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
