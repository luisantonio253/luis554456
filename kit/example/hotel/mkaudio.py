root = 'C:/Users/luis/shorts/gta6-hotel/'
src = open(root + 'work/audio_trailer.py', encoding='utf-8').read().split('\n')
head = src[:23]
head[0] = '"""Synthesized music bed + SFX stems for "O vazamento do Fire Stick". Writes music.wav and sfx.wav (mono, 48 kHz).'
head = [l.replace('TOTAL = 1714', 'TOTAL = 1661') for l in head]
a = next(i for i, l in enumerate(src) if l.startswith('# ---------------- sfx'))
b = next(i for i, l in enumerate(src) if l.startswith('# hook: the gator'))
synth = src[a:b]
pl = next(i for i, l in enumerate(src) if l.startswith('def pluck('))
fl = next(i for i, l in enumerate(src) if l.startswith('# ---------------- music: a bouncy'))
helpers = src[pl:fl]
tail = src[next(i for i, l in enumerate(src) if l.startswith('fade = int(')):]
cues = open(root + 'work/cues.py', encoding='utf-8').read()
music, sfxc = cues.split('#@@SYNTH@@')
out = '\n'.join(head) + '\n' + '\n'.join(helpers) + '\n' + music + '\n' + '\n'.join(synth) + '\n' + sfxc + '\n' + '\n'.join(tail)
open(root + 'audio.py', 'w', encoding='utf-8').write(out)
print('written')
