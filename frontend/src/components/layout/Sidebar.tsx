import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ESCOLA, TELEFONE_0800 } from '../../config';

function LogoSvg() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M4 18 C4 12 12 6 20 6" stroke="#E8623A" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 18 C4 14 12 10 20 10" stroke="#3ABFB0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 18 C4 16 12 14 20 14" stroke="#F5C842" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar() {
  const location = useLocation();
  const agentesActive = location.pathname.startsWith('/agentes');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[248px] min-h-screen bg-[var(--navy)] text-white fixed left-0 top-0 bottom-0 z-30">
        <SidebarContent agentesActive={agentesActive} />
      </aside>

      {/* Mobile top bar */}
      <header className="flex md:hidden flex-col bg-[var(--navy)] text-white w-full">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-lg shrink-0">
            <LogoSvg />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm">Ponte</span>
            <span className="text-xs opacity-65 ml-2">Painel da escola</span>
          </div>
          <nav className="flex gap-1">
            <NavLink
              to="/agentes"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${agentesActive ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              Agentes
            </NavLink>
            <span
              className="px-3 py-1.5 rounded-lg text-sm opacity-45 cursor-not-allowed"
              title="Disponível em uma próxima versão"
            >
              Métricas
            </span>
          </nav>
        </div>
        <div className="px-4 pb-3 text-xs border-t border-white/10 pt-2 flex items-center gap-3 flex-wrap">
          <div className="opacity-80">
            <span className="font-semibold">{ESCOLA.nome}</span>
            {' · '}
            {ESCOLA.municipio} · {ESCOLA.uf}
          </div>
          <div className="bg-white/10 rounded px-2 py-1 shrink-0">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-60 mr-1.5">Código</span>
            <span className="font-bold tracking-wider">{ESCOLA.codigo}</span>
          </div>
          <div className="opacity-80">
            Alunos ligam para <strong>{TELEFONE_0800}</strong> e digitam este código.
          </div>
        </div>
      </header>
    </>
  );
}

function SidebarContent({ agentesActive }: { agentesActive: boolean }) {
  return (
    <div className="flex flex-col h-full">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-lg shrink-0">
          <LogoSvg />
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">Ponte</div>
          <div className="text-[11px] opacity-65 leading-tight">Painel da escola</div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex flex-col gap-1 px-3 mt-2" aria-label="Menu principal">
        <NavLink
          to="/agentes"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${agentesActive ? 'bg-white/20' : 'hover:bg-white/10 opacity-80'}`}
        >
          Agentes
        </NavLink>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm opacity-45 cursor-not-allowed select-none"
          title="Disponível em uma próxima versão"
          aria-disabled="true"
        >
          Métricas
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--draft-bg)] text-[var(--draft)]">
            em breve
          </span>
        </div>
      </nav>

      {/* Rodapé: cartão da escola */}
      <div className="mt-auto px-4 py-4 border-t border-white/10 text-xs">
        <div className="font-bold text-sm leading-snug">{ESCOLA.nome}</div>
        <div className="opacity-65 mt-0.5 mb-3">
          {ESCOLA.municipio} · {ESCOLA.uf}
        </div>
        <div className="bg-white/10 rounded-lg px-3 py-2 mb-3">
          <div className="text-[10px] font-bold tracking-widest uppercase opacity-60 mb-1">
            Código da escola
          </div>
          <div className="text-2xl font-bold tracking-wider leading-none">
            {ESCOLA.codigo}
          </div>
        </div>
        <div className="opacity-80">
          Alunos ligam para <strong>{TELEFONE_0800}</strong> e digitam este código.
        </div>
      </div>
    </div>
  );
}
