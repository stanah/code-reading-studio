#!/usr/bin/env bash
# One command for the notes-persistence verification: drift check, TLC on every config, real-code replay.
# Exit 0 only when every result matches expected.json and the covered code still matches coverage.json.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "$here/../../.." && pwd)"
cd "$root"

TLA_VERSION=1.8.0
TLA_SHA256=d15655eeaff4b3f7b3d65c46b838bc0f35d131b2ef4b1e473689b62c98d4726f
jar="${XDG_CACHE_HOME:-$HOME/.cache}/verify-notes-persistence/tla2tools-$TLA_VERSION.jar"
status=0

echo "== drift: covered code vs coverage.json"
node "$here/scripts/drift.mjs" || status=1

echo "== tlc: model/*.cfg"
if [ ! -f "$jar" ]; then
  mkdir -p "$(dirname "$jar")"
  curl -fsSL -o "$jar.part" "https://github.com/tlaplus/tlaplus/releases/download/v$TLA_VERSION/tla2tools.jar" && mv "$jar.part" "$jar"
fi
if ! echo "$TLA_SHA256  $jar" | sha256sum -c --status 2>/dev/null && ! echo "$TLA_SHA256  $jar" | shasum -a 256 -c --status 2>/dev/null; then
  echo "!! tla2tools.jar checksum mismatch: $jar"; exit 2
fi
out="$root/outputs/verify-notes-persistence"
mkdir -p "$out"
for cfg in "$here"/model/*.cfg; do
  name="$(basename "$cfg" .cfg)"
  want="$(node -e "console.log(require('$here/expected.json').tlc['$name'] ?? 'UNLISTED')")"
  (cd "$here/model" && java -XX:+UseParallelGC -cp "$jar" tlc2.TLC -workers auto -deadlock -cleanup -noGenerateSpecTE \
    -metadir "$out/states-$name" -config "$name.cfg" NotesPersistence.tla) > "$out/$name.log" 2>&1
  if grep -q "Model checking completed. No error has been found." "$out/$name.log"; then got=PASS
  elif grep -q "is violated" "$out/$name.log"; then
    # A FAIL result names the invariant, so a violation of a different invariant is never mistaken for the known one.
    got="FAIL:$(grep -o 'Invariant [A-Za-z]* is violated' "$out/$name.log" | head -1 | cut -d' ' -f2)"
  else got=ERROR; fi
  states="$(grep -o '[0-9,]* distinct states found' "$out/$name.log" | head -1)"
  mark="  "; [ "$got" = "$want" ] || { mark="!!"; status=1; }
  echo "$mark $name: $got (expected $want) ${states:+$states }log: outputs/verify-notes-persistence/$name.log"
done

echo "== replay: real local-app/server.mjs with injected faults"
node "$here/scripts/replay.mjs" || status=1

exit $status
