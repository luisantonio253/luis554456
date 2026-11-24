import sys, re
root = 'C:/Users/luis/shorts/gta6-trailer/'
ex = open('C:/Users/luis/.claude/skills/cartoon-audio-short/kit/example/gta6/main.js', encoding='utf-8').read().split('\n')
head = ex[:122]
tail = ex[287:]
block = open(root + 'work/world_block.js', encoding='utf-8').read()
head[4] = "import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PO, RO, ST, SR, MP, TVP, TVY, TVYAW, CAL, PPH, SIGNP, CNT, CAR, tileScale } from './story.js';"
t = '\n'.join(tail)
a = t.index('function worldState(S, f) {')
b = t.index('\n}\n', a) + 3
t = t[:a] + t[b:]
def rep(s, old, new):
    if old not in s: sys.exit('missing: ' + old[:70])
    return s.replace(old, new)
t = rep(t, "lamp.intensity = L.lamp || 0;", "lamp.color.set(L.lampCol || '#ffe7b0'); lamp.intensity = L.lamp || 0;")
t = rep(t, "for (const c of clouds) c.quaternion.copy(camera.quaternion);", "for (const c of clouds) { c.quaternion.copy(camera.quaternion); c.material.color.set(L.cloud || '#ffffff'); }")
out = '\n'.join(head) + '\n' + block + '\n' + t
open(root + 'web/main.js', 'w', encoding='utf-8').write(out)
print('ok', out.count('\n'))
