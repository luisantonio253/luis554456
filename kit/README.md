# cartoon-short-kit
Audio in, finished vertical cartoon short out. 2D bean-head cards in an inked, painted 3D world
(three.js in headless Chromium, no Remotion and no GPU needed), with a synthesized music bed and SFX.

- `engine/` renderer: world helpers, cards, ink pass, lens blur, grade (`main.js`), painted textures (`paint.js`, `paint2.js`),
  cast drawing (`roman.js` on top of the Pen library from mromidev/claude-animated-shorts, vendored in `vendor/`),
  motion helpers (`motion.js`).
- `example/rio/` "O Rio de Janeiro que não tem rio" (PT-BR, 28 s): own `main.js` world (bay + caravel, city street, tunnel),
  story.js shot plan, audio.py cue table, script.txt, stills/QA sheets. Default example for setup.sh.
- `example/soldier/` "The Soldier Who Never Left" (EN): story.js + audio.py for the bridge world in `engine/main.js`.
- `example/tiete/` "O rio que foge do mar" (PT-BR, 35.8 s): own `main.js` (heightfield Serra do Mar + plateau, river that reveals/rewinds,
  cut-away diorama, canoe, milestone counter sign), story.js (terrain `H(x,z)` shared with main.js), audio.py (caipira loop), PLAN.md, stills/QA sheets.
- `example/enem/` "O chute que vale menos" (PT-BR, 25.4 s): own `main.js` with three sets far apart in one sunny world: an exam-room cut-away
  (desks, chalkboard, answer sheets), a giant numbered staircase with a TRI billboard, and a football pitch with goal, bulging net, crowd stand and
  scoreboard. Generic canvas signs (`mkSign`/`redraw`, keyed redraws) for boards, counters, step labels, verdict screen and scoreboard.
  story.js: coin/ball/X/check fx, `FX()` centres the drawing on its point, kick via `step`, `expr: 'blind'`. audio.py: quiz-show loop, buzzer, crowd, net swish, sad trombone.
- `tools/` setup.sh (new project), timing.py (word timings, `--lang pt`), render.mjs (frames), sheet.py (contact sheets), cover.py (1080x1920 cover/thumbnail with outlined text, ring, arrow, badge),
  mix.py (music/SFX at 50 % of the voice), modal_render.py (cloud render + encode + QA + download), finish.sh (local encode fallback).

Quick start:
```
bash tools/setup.sh ~/shorts/my-short rio
cd ~/shorts/my-short && python timing.py voice.mp3 script.txt --out work --lang pt
node render.mjs stills/a "0,100,200" && python sheet.py stills/a stills/sheet_a.jpg
python audio.py && python mix.py voice.mp3 music.wav sfx.wav
modal run modal_render.py --title "My Short"
```
Built on github.com/mromidev/claude-animated-shorts (MIT): toon.ts, look values and readability rules.
