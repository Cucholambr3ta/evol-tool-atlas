#!/usr/bin/env bash
# Instala .git/hooks/post-commit para regenerar reports/atlas-status.json tras cada commit.
# El informe se genera en segundo plano (nohup) y nunca bloquea ni hace fallar el commit.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$(git -C "$ROOT" rev-parse --git-path hooks)"
[[ "$HOOKS_DIR" = /* ]] || HOOKS_DIR="$ROOT/$HOOKS_DIR"
HOOK="$HOOKS_DIR/post-commit"
MARKER="# atlas-report hook (scripts/install-atlas-hook.sh)"

mkdir -p "$HOOKS_DIR"
if [[ -e "$HOOK" ]] && ! grep -qF "$MARKER" "$HOOK"; then
  echo "Ya existe $HOOK y no fue creado por este script; no se sobrescribe." >&2
  echo "Añade a mano: (cd \"\$(git rev-parse --show-toplevel)\" && nohup npm run atlas:report >/dev/null 2>&1 &)" >&2
  exit 1
fi

cat > "$HOOK" <<'HOOK_EOF'
#!/bin/sh
# atlas-report hook (scripts/install-atlas-hook.sh)
# Regenera el informe de EVOL Atlas para el nuevo HEAD sin bloquear el commit.
top="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$top" || exit 0
mkdir -p reports
nohup npm run atlas:report >reports/atlas-report.log 2>&1 </dev/null &
exit 0
HOOK_EOF
chmod +x "$HOOK"
echo "Hook instalado: $HOOK"
