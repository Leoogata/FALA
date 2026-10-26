import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { AgentesPage } from './pages/AgentesPage';
import { NovoAgentePage } from './pages/NovoAgentePage';
import { DetalheAgentePage } from './pages/DetalheAgentePage';
import { AbaMateriaisPage } from './pages/AbaMateriaisPage';
import { AbaInstrucoesPage } from './pages/AbaInstrucoesPage';
import { AbaTestarPage } from './pages/AbaTestarPage';
import { AbaLigacaoPage } from './pages/AbaLigacaoPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/agentes" replace /> },
  { path: '/agentes', element: <AgentesPage /> },
  { path: '/agentes/novo', element: <NovoAgentePage /> },
  {
    path: '/agentes/:id',
    element: <DetalheAgentePage />,
    children: [
      { index: true, element: <AbaMateriaisPage /> },
      { path: 'instrucoes', element: <AbaInstrucoesPage /> },
      { path: 'testar', element: <AbaTestarPage /> },
      { path: 'ligacao', element: <AbaLigacaoPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
