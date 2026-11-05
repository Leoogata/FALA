import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  useEffect(() => {
    document.title = `${title} · Ponte`;
  }, [title]);

  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      <Sidebar />

      {/* Content area */}
      <main className="flex-1 md:ml-[248px] min-w-0">
        {offline && (
          <div className="bg-[var(--draft-bg)] border-b border-[var(--draft)] text-[var(--draft)] text-sm px-4 py-2 text-center font-medium">
            Você está sem internet. As alterações não serão salvas até a conexão voltar.
          </div>
        )}
        <div className="max-w-[1140px] mx-auto px-4 md:px-8 py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
