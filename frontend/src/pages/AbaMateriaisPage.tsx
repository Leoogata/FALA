import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialUploadArea } from '../components/agent/MaterialUploadArea';
import { MaterialList } from '../components/agent/MaterialList';
import type { AgenteDetalhe, Material } from '../api/types';

interface OutletCtx {
  agente: AgenteDetalhe;
  onAgenteChange: () => Promise<void>;
}

export function AbaMateriaisPage() {
  const { agente, onAgenteChange } = useOutletContext<OutletCtx>();
  const [materiais, setMateriais] = useState<Material[]>(agente.documentos);

  function handleUploaded(m: Material) {
    setMateriais((prev) => [m, ...prev]);
    onAgenteChange();
  }

  return (
    <div>
      <MaterialUploadArea agente={agente} onUploaded={handleUploaded} />
      <MaterialList agente={agente} materiais={materiais} setMateriais={setMateriais} />
    </div>
  );
}
