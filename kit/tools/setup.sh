#!/usr/bin/env bash
# Creates a new short project:  bash tools/setup.sh <project_dir> [example: rio|soldier|tiete|enem|gta6|fuso|trailer|hotel|bichos|online]
# Needs: node >= 22.6 (type stripping), python3 + numpy + Pillow, ffmpeg, git. Playwright is installed locally if no global copy exists.
# Works in Git Bash on Windows: paths handed to node are relative to the project, never /c/... style.
set -e
KIT="$(cd "$(dirname "$0")/.." && pwd)"; P="${1:?project dir}"; EX="${2:-rio}"
TMPD="${TMPDIR:-${TEMP:-/tmp}}"
mkdir -p "$P/web/lib" "$P/work" "$P/stills" "$P/out"
cp "$KIT"/engine/*.js "$KIT"/engine/index.html "$P/web/"
cp "$KIT/example/$EX/story.js" "$P/web/story.js"             # starting point: rewrite for the new story
cp "$KIT/example/$EX/audio.py" "$P/audio.py"                 # starting point: rewrite the cue table
[ -f "$KIT/example/$EX/main.js" ] && cp "$KIT/example/$EX/main.js" "$P/web/main.js"   # example world (rio ships its own main.js)
for w in world_block.js assemble.py mkaudio.py cues.py PLAN.md main_trailer.js audio_trailer.py; do [ -f "$KIT/example/$EX/$w" ] && cp "$KIT/example/$EX/$w" "$P/work/$w" || true; done   # splice helpers -> work/
cp "$KIT"/tools/*.mjs "$KIT"/tools/*.py "$KIT"/tools/finish.sh "$P/" 2>/dev/null || true
# three.js r160 (module build). npm first, then a sparse git clone (works where only GitHub is reachable).
if [ ! -f "$P/web/lib/three.module.js" ]; then
  ( cd "$TMPD" && rm -rf _three && mkdir _three && cd _three && npm pack three@0.160.0 >/dev/null 2>&1 && tar xzf three-0.160.0.tgz && cp package/build/three.module.js "$P/web/lib/" ) \
  || ( cd "$TMPD" && rm -rf _t3 && git clone -q --depth 1 --filter=blob:none --sparse --branch r160 https://github.com/mrdoob/three.js _t3 && cd _t3 && git sparse-checkout set build && cp build/three.module.js "$P/web/lib/" )
fi
# toon base: the Pen / head / face library from mromidev/claude-animated-shorts, types stripped
if [ ! -f "$KIT/vendor/toon.ts" ]; then mkdir -p "$KIT/vendor"; rm -rf "$TMPD/_cas"; git clone -q --depth 1 https://github.com/mromidev/claude-animated-shorts "$TMPD/_cas" && cp "$TMPD/_cas/templates/bridge/toon.ts" "$KIT/vendor/toon.ts"; fi
cp "$KIT/vendor/toon.ts" "$P/work/toon.ts"
( cd "$P" && node -e "const m=require('node:module'),fs=require('fs');fs.writeFileSync('web/toonbase.js',m.stripTypeScriptTypes(fs.readFileSync('work/toon.ts','utf8'),{mode:'strip'}))" 2>/dev/null )
[ -s "$P/web/toonbase.js" ] || { echo "toon type-strip failed (need node >= 22.6)"; exit 1; }
cat "$P/web/toonbase.js" "$P/web/roman.js" > "$P/web/toon.js"
# playwright: global copy if there is one, otherwise a local install (+ chromium)
if [ ! -e "$P/node_modules/playwright" ]; then
  G="$(npm root -g 2>/dev/null || true)"
  if [ -n "$G" ] && [ -d "$G/playwright" ]; then mkdir -p "$P/node_modules"; ln -sf "$G/playwright" "$P/node_modules/playwright" 2>/dev/null || cp -r "$G/playwright" "$P/node_modules/"; fi
  if [ ! -e "$P/node_modules/playwright" ]; then ( cd "$P" && { [ -f package.json ] || npm init -y >/dev/null; } && npm i playwright@1.65.1 >/dev/null 2>&1 && npx playwright install chromium >/dev/null 2>&1 ); fi
fi
[ -e "$P/node_modules/playwright" ] && echo "playwright ok" || echo "WARNING: playwright missing"
echo "ready: $P   (after editing cast code run: cat web/toonbase.js web/roman.js > web/toon.js)"
