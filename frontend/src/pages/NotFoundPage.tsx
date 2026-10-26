import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <AppLayout title="Página não encontrada">
      <div className="text-center py-16">
        <h1 className="text-[22px] font-bold text-[var(--navy)] mb-2">Página não encontrada</h1>
        <p className="text-sm text-[var(--muted)] mb-6">A página que você procura não existe.</p>
        <Button variant="secondary" onClick={() => navigate('/agentes')}>Voltar para agentes</Button>
      </div>
    </AppLayout>
  );
}
