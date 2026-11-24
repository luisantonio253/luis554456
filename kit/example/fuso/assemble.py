import sys, io
P = 'C:/Users/luis/shorts/gta6-primeiro/'
L = io.open(P + 'web/main.js', encoding='utf-8').read().split('\n')
block = io.open(P + 'work/world_block.js', encoding='utf-8').read()
head = '\n'.join(L[0:122])
tail = '\n'.join(L[297:])
def rep(s, old, new):
    if old not in s: sys.exit('missing: ' + old[:70])
    return s.replace(old, new, 1)
head = rep(head, "import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PL, RO, MARC, SON, TVP, CAL, BOX, CASEX } from './story.js';",
  "import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, NZ, BU, WA, RO, MI, SH, TVN, CLK, USP, WS, FOUR, SHEEP, BSHEEP, PANELS, PX, TVP, CAL, TVM, CNT, FLS } from './story.js';")
# drop the old worldState (it is inside tail)
a = tail.index('function worldState(S, f) {'); b = tail.index('function drawActors')
tail = tail[:a] + tail[b:]
tail = rep(tail, "lamp.intensity = L.lamp || 0; if (L.lampAt) lamp.position.set(...L.lampAt);",
  "lamp.intensity = L.lamp || 0; if (L.lampAt) lamp.position.set(...L.lampAt); lamp.color.set(L.lampCol || '#ffe7b0');\n  for (const c of clouds) c.material.color.set(L.cloud || '#ffffff');")
io.open(P + 'web/main.js', 'w', encoding='utf-8', newline='\n').write(head + '\n' + block + '\n' + tail)
s = io.open(P + 'web/story.js', encoding='utf-8').read()
s = rep(s, "W.count = 7200 + Math.round((1419 - f) / 30 * 1000) / 1000;", "W.count = 7200 + Math.ceil((1419 - f) / 30);")
io.open(P + 'web/story.js', 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
