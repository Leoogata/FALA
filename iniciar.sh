#!/usr/bin/env bash
# Inicia os três serviços locais. O banco e o agente IBM usam os .env existentes.
set -Eeuo pipefail

if (( BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 4) )); then
  echo 'Este script precisa de Bash 4.4 ou superior.' >&2
  exit 1
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${FALA_BACKEND_PORT:-3001}"
VOICE_PORT="${FALA_TELEFONIA_PORT:-3000}"
WEB_PORT="${FALA_FRONTEND_PORT:-5173}"
PIDS=()

if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then
  cat <<'HELP'
Uso: ./iniciar.sh [--help]

Inicia backend (API), telephony-handler e painel em paralelo.
Ctrl+C encerra os três serviços ao mesmo tempo.

Pré-requisitos:
  1. Node.js 20+
  2. backend/.env            (copie backend/.env.example)
  3. backend/telephony-handler/.env  (copie backend/telephony-handler/.env.example)

O script faz automaticamente:
  - Instala dependências ausentes (npm install) em cada módulo
  - Gera o cliente Prisma (prisma generate)
  - Expõe os três serviços com logs prefixados pelo nome do serviço

Portas padrão (sobrescreva com variáveis de ambiente):
  FALA_BACKEND_PORT    → 3001  (API backend)
  FALA_TELEFONIA_PORT  → 3000  (telephony-handler)
  FALA_FRONTEND_PORT   → 5173  (painel web)

Exemplo com portas customizadas:
  FALA_BACKEND_PORT=4001 ./iniciar.sh

URLs após a inicialização:
  Painel:    http://localhost:$FALA_FRONTEND_PORT (padrão: 5173)
  API:       http://localhost:$FALA_BACKEND_PORT  (padrão: 3001)
  Telefonia: http://localhost:$FALA_TELEFONIA_PORT (padrão: 3000)
HELP
  exit 0
fi
if (( $# > 0 )); then
  echo 'Opção desconhecida. Use ./iniciar.sh --help.' >&2
  exit 1
fi

for command in node npm setsid sed; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Comando necessário não encontrado: $command" >&2
    exit 1
  fi
done
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo 'Instale Node.js 20 ou superior para iniciar o projeto.' >&2
  exit 1
fi
for directory in backend backend/telephony-handler; do
  if [[ ! -f "$ROOT/$directory/.env" ]]; then
    echo "Configure $directory/.env a partir de $directory/.env.example e execute novamente." >&2
    exit 1
  fi
done

# Não encerra processos que já estejam usando essas portas.
node - "$API_PORT" "$VOICE_PORT" "$WEB_PORT" <<'NODE'
const net = require('node:net');
const ports = process.argv.slice(2).map(Number);
if (ports.some(p => !Number.isInteger(p) || p < 1 || p > 65535) || new Set(ports).size !== 3) {
  console.error('Configure três portas diferentes, entre 1 e 65535.');
  process.exit(1);
}
(async () => {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(port, () => server.close(resolve));
    }).catch(error => {
      console.error(error.code === 'EADDRINUSE'
        ? `A porta ${port} já está em uso. Encerre o serviço anterior ou escolha outra porta.`
        : `Não foi possível abrir a porta ${port}: ${error.code ?? error.message}`);
      process.exitCode = 1;
      throw error;
    });
  }
})().catch(() => {});
NODE

for directory in backend backend/telephony-handler frontend; do
  if [[ ! -d "$ROOT/$directory/node_modules" ]]; then
    echo "[preparo] Instalando dependências de $directory..."
    (cd "$ROOT/$directory" && npm install --no-audit --no-fund)
  fi
done
echo '[preparo] Atualizando o cliente do banco...'
(cd "$ROOT/backend" && npm run prisma:generate)

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if (( ${#PIDS[@]} > 0 )); then
    echo
    echo '[FALA] Encerrando backend, telefonia e painel...'
    # Cada serviço tem seu próprio grupo, incluindo npm, Node e seus filhos.
    for pid in "${PIDS[@]}"; do kill -TERM -- "-$pid" 2>/dev/null || true; done
    sleep 1
    for pid in "${PIDS[@]}"; do kill -KILL -- "-$pid" 2>/dev/null || true; done
    for pid in "${PIDS[@]}"; do wait "$pid" 2>/dev/null || true; done
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_service() {
  local directory=$1 label=$2
  shift 2
  setsid bash -o pipefail -c '
    cd -- "$1"
    label=$2
    shift 2
    "$@" 2>&1 | sed -u "s/^/[$label] /"
  ' bash "$ROOT/$directory" "$label" "$@" &
  PIDS+=("$!")
}

echo "[FALA] Painel:    http://localhost:$WEB_PORT"
echo "[FALA] API:       http://localhost:$API_PORT"
echo "[FALA] Telefonia: http://localhost:$VOICE_PORT"
echo '[FALA] Aguarde as mensagens de inicialização. Use Ctrl+C para encerrar tudo.'

start_service backend backend env PORT="$API_PORT" CORS_ORIGIN="http://localhost:$WEB_PORT" npm start
start_service backend/telephony-handler telefonia env PORT="$VOICE_PORT" BACKEND_API_URL="http://localhost:$API_PORT" npm start
start_service frontend painel env VITE_API_URL="http://localhost:$API_PORT" VITE_USE_MOCK=false npm start -- --host localhost --port "$WEB_PORT" --strictPort

status=0
wait -n "${PIDS[@]}" || status=$?
echo '[FALA] Um dos serviços encerrou. Confira os logs acima.' >&2
exit "$status"
