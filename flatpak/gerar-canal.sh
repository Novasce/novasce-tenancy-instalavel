#!/usr/bin/env bash
# Gera os arquivos do canal de teste que vão para as Pages: o .flatpakrepo (adiciona o canal),
# o .flatpakref (instala a sonda com um clique) e a página de entrada.
# Uso: flatpak/gerar-canal.sh <pasta-do-site> <endereço-base>
set -euo pipefail
SITE="$1"
BASE="${2%/}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
CHAVE="$AQUI/chave-publica.gpg"
[ -s "$CHAVE" ] || { echo "Falta flatpak/chave-publica.gpg (a parte pública da chave do canal)."; exit 1; }
GPG=$(base64 -w0 "$CHAVE")
mkdir -p "$SITE"
cat > "$SITE/novasce-teste.flatpakrepo" <<FIM
[Flatpak Repo]
Title=Novasce (teste)
Url=$BASE/repo/
Homepage=https://github.com/Novasce/novasce-tenancy-instalavel
Comment=Canal de teste da sonda do Tenancy
GPGKey=$GPG
FIM
cat > "$SITE/com.novasce.TenancySonda.flatpakref" <<FIM
[Flatpak Ref]
Name=com.novasce.TenancySonda
Branch=teste
Title=Sonda do Tenancy (teste)
Url=$BASE/repo/
IsRuntime=false
SuggestRemoteName=novasce-teste
RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo
GPGKey=$GPG
FIM
cp "$AQUI/pagina.html" "$SITE/index.html"
echo "Canal gerado em $SITE para $BASE"
