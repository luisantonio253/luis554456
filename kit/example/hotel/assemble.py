import sys
root = 'C:/Users/luis/shorts/gta6-hotel/'
src = open(root + 'work/main_trailer.js', encoding='utf-8').read().split('\n')
head = src[:122]
i = next(k for k, l in enumerate(src) if l.startswith('// clouds: painted billboards'))
tail = src[i:]
head[4] = "import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, HO, CI, HX, RK, PL, LAY, NCLIP, clipAt, tileScale } from './story.js';"
block = open(root + 'work/world_block.js', encoding='utf-8').read()
out = '\n'.join(head) + '\n' + block + '\n' + '\n'.join(tail)
open(root + 'web/main.js', 'w', encoding='utf-8').write(out)
print('ok', out.count('\n'))
