import { env } from './config/env.js';
import app from './app.js';
import { recuperarOrfaos } from './rag/recovery.js';
import { iniciarAgendadorExpurgo } from './jobs/expurgo.js';

// Recupera trabalhos de indexação persistidos antes de aceitar tráfego
recuperarOrfaos()
  .catch((err) => console.error('[startup] Falha na recuperação de órfãos:', err))
  .finally(() => {
    app.listen(env.PORT, () => {
      console.log(`🚀  Ponte backend rodando em http://localhost:${env.PORT}`);
      console.log(`📄  Documentação em http://localhost:${env.PORT}/api-docs`);
    });

    // Inicia expurgo de retenção (executa na inicialização e a cada minuto)
    iniciarAgendadorExpurgo();
  });
