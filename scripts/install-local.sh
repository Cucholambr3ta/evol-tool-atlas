#!/usr/bin/env bash
# Instala Evol Tool Atlas como PWA local en este equipo.
#
# - Instala dependencias exactas (npm ci) y compila la versión de producción.
# - Crea y activa un servicio de usuario systemd que sirve la app en
#   http://127.0.0.1:4173/evol-tool-atlas/ (siempre el mismo origen, necesario
#   para que la PWA instalada siga funcionando).
#
# Uso:  ./scripts/install-local.sh            # instalar o actualizar
#       ./scripts/install-local.sh --uninstall # quitar el servicio
set -euo pipefail

SERVICE_NAME="evol-tool-atlas"
HOST="127.0.0.1"
PORT="4173"
URL="http://${HOST}:${PORT}/evol-tool-atlas/"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="${UNIT_DIR}/${SERVICE_NAME}.service"

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl --user disable --now "${SERVICE_NAME}.service" 2>/dev/null || true
  rm -f "${UNIT_FILE}"
  systemctl --user daemon-reload
  echo "Servicio ${SERVICE_NAME} eliminado. (La PWA instalada en el navegador se desinstala desde el propio navegador.)"
  exit 0
fi

command -v node >/dev/null || { echo "Error: falta Node.js 22+ (sudo pacman -S nodejs npm)." >&2; exit 1; }
command -v npm  >/dev/null || { echo "Error: falta npm (sudo pacman -S npm)." >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 22 )); then
  echo "Error: se requiere Node.js 22+ (encontrado $(node -v))." >&2
  exit 1
fi
NODE_BIN="$(command -v node)"

cd "${REPO_DIR}"
echo "==> Instalando dependencias (npm ci)"
npm ci
echo "==> Compilando PWA de producción"
VITE_BASE_PATH=/evol-tool-atlas/ npm run build

echo "==> Configurando servicio de usuario systemd (${UNIT_FILE})"
mkdir -p "${UNIT_DIR}"
cat > "${UNIT_FILE}" <<EOF
[Unit]
Description=Evol Tool Atlas (PWA local en ${URL})

[Service]
WorkingDirectory=${REPO_DIR}
ExecStart=${NODE_BIN} ${REPO_DIR}/node_modules/vite/bin/vite.js preview --host ${HOST} --port ${PORT} --strictPort
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable "${SERVICE_NAME}.service" >/dev/null
systemctl --user restart "${SERVICE_NAME}.service"

echo "==> Esperando a que el servidor responda"
for _ in $(seq 1 30); do
  if curl -fs -o /dev/null "${URL}"; then
    echo
    echo "Listo. Evol Tool Atlas está disponible en: ${URL}"
    echo "Ábrela en Chrome/Chromium/Brave/Edge y pulsa el icono de instalar en la barra de direcciones."
    exit 0
  fi
  sleep 1
done

echo "Error: el servidor no respondió en ${URL}. Revisa: journalctl --user -u ${SERVICE_NAME} -n 50" >&2
exit 1
