#!/bin/sh
# Stempler alle js- og css-lenker i HTML-filene med et versjonsnummer.
#
# Uten dette serverer nettleseren gamle filer fra bufferen etter en
# oppdatering, og man kan ende opp med ny HTML og gammel JavaScript.
# Kjøres før hver push:   sh verktoy/stempel.sh
V=$(date +%Y%m%d%H%M)
cd "$(dirname "$0")/.." || exit 1
for f in index.html player.html board.html; do
  perl -i -pe "s|(src=\"js/[a-z]+\.js)(\?v=[0-9]+)?\"|\${1}?v=$V\"|g; s|(href=\"css/[a-z]+\.css)(\?v=[0-9]+)?\"|\${1}?v=$V\"|g;" "$f"
done
echo "Stemplet med v=$V"
