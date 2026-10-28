#!/usr/bin/env bash
# Gera a chave que assina o canal de teste. Roda uma vez, no Mac de quem administra o repositório.
# A parte privada vai direto para o segredo do repositório: não aparece na tela e não fica no disco.
set -euo pipefail
command -v gpg >/dev/null || { echo "Falta o gpg. Instale com: brew install gnupg"; exit 1; }
command -v gh >/dev/null || { echo "Falta o gh (GitHub CLI)."; exit 1; }
REPO=Novasce/novasce-tenancy-instalavel
AQUI="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GNUPGHOME="$TMP"
gpg --batch --passphrase '' --quick-gen-key "Novasce canal de teste <contato@novasce.com>" rsa4096 sign 2y 2>/dev/null
FPR="$(gpg --list-secret-keys --with-colons | awk -F: '/^fpr:/ {print $10; exit}')"
gpg --export "$FPR" > "$AQUI/chave-publica.gpg"
gpg --batch --armor --export-secret-keys "$FPR" | gh secret set FLATPAK_GPG_PRIVADA -R "$REPO"
echo "Chave criada: $FPR"
echo "Parte pública em flatpak/chave-publica.gpg. A privada foi para o segredo FLATPAK_GPG_PRIVADA."
