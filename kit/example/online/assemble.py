# Splice work/world_block.js into web/main.js (engine head/tail kept). Root-relative: works in any project folder.
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
base = root + 'web/main.js'
ex = open(base, encoding='utf-8').read().split('\n')
a = next(i for i, l in enumerate(ex) if l.startswith('// ======================= WORLD'))
b = next(i for i, l in enumerate(ex) if l.startswith('// clouds: painted billboards'))
head = ex[:a]
assert head[4].startswith('import { SHOTS'), head[4]
# edit this import list to match the constants your story.js exports
head[4] = "import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PZ, LR, ST, WD, TB, TVX, CALX, CLX, RK, RDP, BRD, FP, B6, B5, PODP } from './story.js';"
block = open(root + 'work/world_block.js', encoding='utf-8').read()
out = '\n'.join(head) + '\n' + block + '\n' + '\n'.join(ex[b:])
open(base, 'w', encoding='utf-8').write(out)
print('ok', out.count('\n'))
