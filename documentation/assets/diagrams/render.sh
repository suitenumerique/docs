#!/usr/bin/env bash
#
# Extract every mermaid diagram of documentation/architecture.md into a
# standalone .mmd file, and render it to PNG and SVG next to it.
#
# The document is the source: a diagram is picked up when its fenced block is
# preceded by a `<!-- diagram: <name> -->` comment, which gives it its file name.
#
# Usage: ./documentation/assets/diagrams/render.sh [name ...]
#        (no argument renders them all)

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
doc="${here}/../../architecture.md"
width="${MERMAID_WIDTH:-2000}"

[ -f "$doc" ] || { echo "not found: $doc" >&2; exit 1; }

# 1. extract
names=$(awk -v dir="$here" '
  /^<!-- diagram: / { name = $3; next }
  /^```mermaid$/    { if (name != "") { out = dir "/" name ".mmd"; printf "" > out; infence = 1 }; next }
  /^```$/           { if (infence) { close(out); print name; infence = 0; name = "" }; next }
  infence           { print >> out }
' "$doc")

[ -n "$names" ] || { echo "no diagram found in $doc" >&2; exit 1; }

# 2. render (only the ones asked for, all of them by default)
for name in $names; do
  if [ "$#" -gt 0 ]; then
    wanted=false
    for arg in "$@"; do [ "$arg" = "$name" ] && wanted=true; done
    $wanted || continue
  fi
  echo "rendering ${name}"
  npx -y @mermaid-js/mermaid-cli@11 -i "${here}/${name}.mmd" -o "${here}/${name}.png" -w "$width" -b white
  npx -y @mermaid-js/mermaid-cli@11 -i "${here}/${name}.mmd" -o "${here}/${name}.svg" -b transparent
done
