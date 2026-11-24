import sys
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/') + '/'  # project dir (script lives in work/)
src = root + 'work/main_trailer.js'
ex = open(src, encoding='utf-8').read().split('\n')
def L(a, b): return ex[a - 1:b]  # 1-based inclusive
head = L(1, 122)
head[4] = "import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PO, RO, ST, SR, MP, LE, NA, CN, TVP, TVY, TVYAW, CAL, PPH, BH, DH, BAG, CARP, MENU, BF, HOUSES, CMP, BILL, ROCK, GATOR, FLAM, PANELS, DESK, SLOTS } from './story.js';"
assert ex[122].startswith('// ====='), ex[122]
assert ex[344].startswith('// ---------- RO'), ex[344]
assert ex[435].startswith('// ---------- MP'), ex[435]
assert ex[476].startswith('// clouds'), ex[476]
body = L(123, 313) + L(345, 377) + L(436, 445)
block = open(root + 'work/world_block.js', encoding='utf-8').read()
tail = '\n'.join(L(477, len(ex)))
out = '\n'.join(head) + '\n' + '\n'.join(body) + '\n' + block + '\n' + tail
open(root + 'web/main.js', 'w', encoding='utf-8').write(out)
print('ok', out.count('\n'))
