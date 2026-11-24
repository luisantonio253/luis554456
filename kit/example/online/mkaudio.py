# Replace the cue table + TOTAL / MUSIC_END in audio.py (synths and music loop kept). Root-relative.
# Re-runnable: it splits on MARK, so keep MARK as the first line of your new cue table.
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
MARK = '# 1-6 living room'
TOTAL, MUSIC_END = 1945, 1870
src = open(root + 'audio.py', encoding='utf-8').read()
head, rest = src.split(MARK, 1)
tail = 'fade = ' + rest.split('\nfade = ', 1)[1]
head = re.sub(r'TOTAL = \d+', 'TOTAL = %d' % TOTAL, head)
head = re.sub(r'MUSIC_END = F\(\d+\).*', 'MUSIC_END = F(%d)  # music stops on the twist line' % MUSIC_END, head)
cues = MARK + ''' (scene 1)
place(sfx, ting(), F(79), 0.5)
'''
open(root + 'audio.py', 'w', encoding='utf-8').write(head + cues + '\n' + tail)
print('ok')
