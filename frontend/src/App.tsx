import React from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
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
import { SchoolGate } from './components/layout/SchoolGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

const createRouter = import.meta.env.BASE_URL === '/FALA/' ? createHashRouter : createBrowserRouter;
const router = createRouter([
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
        <SchoolGate><RouterProvider router={router} /></SchoolGate>
      </ToastProvider>
    </QueryClientProvider>
  );
}
