import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { currentSchool, saveSchool, clearSchool, type EscolaSession } from '../../schoolSession';

export function SchoolGate({ children }: { children: React.ReactNode }) {
  const [escola, setEscola] = useState(currentSchool);
  const [chave, setChave] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  useEffect(() => {
    const changed = () => { queryClient.clear(); setEscola(currentSchool()); };
    window.addEventListener('school-session', changed);
    return () => window.removeEventListener('school-session', changed);
  }, [queryClient]);
  if (import.meta.env.VITE_USE_MOCK === 'true') return <>{children}</>;
  if (escola) return <>{children}</>;
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErro('');
    try {
      const escola = await apiFetch<EscolaSession>('/painel/escola', { headers: { Authorization: `Bearer ${chave.trim()}` } });
      saveSchool(chave.trim(), escola); setChave('');
    } catch (e) {
      clearSchool(); setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally { setLoading(false); }
  }
  return <main className="min-h-screen bg-[var(--bg)] grid place-items-center p-6">
    <form onSubmit={entrar} className="bg-white rounded-xl border border-[var(--line)] p-8 w-full max-w-md">
      <h1 className="text-2xl font-bold text-[var(--navy)]">Painel da escola</h1>
      <p className="text-sm text-[var(--muted)] mt-2 mb-6">Entre com a chave de acesso fornecida pela plataforma.</p>
      <label htmlFor="chave-escola" className="block text-sm font-semibold mb-2">Chave de acesso</label>
      <input id="chave-escola" type="password" autoComplete="current-password" required value={chave}
        onChange={(e) => setChave(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
      {erro && <p role="alert" className="text-sm text-[var(--err)] mt-3">{erro}</p>}
      <button disabled={loading} className="mt-5 w-full rounded-lg bg-[var(--navy)] text-white py-2 disabled:opacity-50">
        {loading ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </main>;
}
