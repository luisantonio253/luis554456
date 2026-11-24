"""Video cover (thumbnail) for a cartoon short: 1080x1920 JPG, big outlined text, highlighted words, optional ring/arrow/badge.

  python cover.py --bg stills/cover/f0100.jpg --out out/capa.jpg \
      --top "ISSO ESTÁ NO TRAILER DO GTA 6" --bottom "E ACONTECEU DE VERDADE" --hl "DE VERDADE,GTA 6" \
      --badge "FLÓRIDA" --ring 540,980,230 --arrow 860,640,640,860
  python cover.py --split top.jpg bottom.jpg --labels "NO JOGO,NA VIDA REAL" ...   (versus layout, two halves)

Coordinates are in the final 1080x1920 frame. Text stays in the Shorts safe area (x 60-1020, y 150-1480):
the bottom ~420 px is covered by the title/buttons in the Shorts player, the top ~150 px by the status bar.
"""
import argparse, os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W, H = 1080, 1920
FONTS = ["C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/ariblk.ttf", "C:/Windows/Fonts/arialbd.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/Library/Fonts/Arial Bold.ttf"]
YEL, WHITE, RED, INK = (255, 214, 10), (255, 255, 255), (230, 40, 50), (16, 10, 20)

def font(px):
    for f in FONTS:
        if os.path.exists(f): return ImageFont.truetype(f, px)
    return ImageFont.load_default()

def cover_fit(img, w, h):
    s = max(w / img.width, h / img.height); img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2; return img.crop((x, y, x + w, y + h))

def layout(text, max_w, max_lines, start_px):
    words = text.upper().split()
    for px in range(start_px, 40, -4):
        f = font(px); sp = f.getlength(" "); lines, cur, cw = [], [], 0
        for w_ in words:
            ww = f.getlength(w_)
            if cur and cw + sp + ww > max_w: lines.append(cur); cur, cw = [w_], ww
            else: cur.append(w_); cw = cw + (sp if cur[:-1] else 0) + ww
        if cur: lines.append(cur)
        if len(lines) <= max_lines and all(sum(f.getlength(x) for x in l) + sp * (len(l) - 1) <= max_w for l in lines): return f, lines
    return font(44), [words]

def draw_block(d, text, y, hl, max_lines=2, px=150, anchor="top"):
    f, lines = layout(text, 960, max_lines, px); lh = int(f.size * 1.08); sp = f.getlength(" ")
    hlw = {w.upper() for h in hl for w in h.split()}
    y0 = y if anchor == "top" else y - lh * len(lines)
    for i, l in enumerate(lines):
        lw = sum(f.getlength(x) for x in l) + sp * (len(l) - 1); x = (W - lw) / 2; yy = y0 + i * lh
        for w_ in l:
            col = YEL if w_.strip("?!.,") in hlw else WHITE
            d.text((x + 8, yy + 10), w_, font=f, fill=(0, 0, 0, 170))                       # drop shadow
            d.text((x, yy), w_, font=f, fill=col, stroke_width=max(6, f.size // 11), stroke_fill=INK)
            x += f.getlength(w_) + sp
    return y0, y0 + lh * len(lines)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bg"); ap.add_argument("--split", nargs=2); ap.add_argument("--labels", default="")
    ap.add_argument("--out", required=True); ap.add_argument("--top", default=""); ap.add_argument("--bottom", default="")
    ap.add_argument("--hl", default=""); ap.add_argument("--badge", default="")
    ap.add_argument("--ring", default=""); ap.add_argument("--arrow", default=""); ap.add_argument("--zoom", type=float, default=1.0); ap.add_argument("--px", type=int, default=130)
    a = ap.parse_args(); hl = [h.strip() for h in a.hl.split(",") if h.strip()]
    if a.split:
        img = Image.new("RGB", (W, H)); halves = [cover_fit(Image.open(p).convert("RGB"), W, H // 2) for p in a.split]
        img.paste(halves[0], (0, 0)); img.paste(halves[1], (0, H // 2))
    else:
        img = Image.open(a.bg).convert("RGB")
        if a.zoom != 1: img = img.resize((round(img.width * a.zoom), round(img.height * a.zoom)), Image.LANCZOS)
        img = cover_fit(img, W, H)
    img = ImageEnhance.Color(img).enhance(1.25); img = ImageEnhance.Contrast(img).enhance(1.08)
    # dark gradients behind the text blocks
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for y in range(0, 620): od.line([(0, y), (W, y)], fill=(0, 0, 0, int(165 * (1 - y / 620) ** 1.3)))
    for y in range(1000, H): od.line([(0, y), (W, y)], fill=(0, 0, 0, int(190 * ((y - 1000) / (H - 1000)) ** 1.2)))
    img = Image.alpha_composite(img.convert("RGBA"), ov); d = ImageDraw.Draw(img)
    if a.split:
        d.line([(0, H // 2), (W, H // 2)], fill=WHITE, width=14); d.line([(0, H // 2), (W, H // 2)], fill=INK, width=6)
        labs = [s.strip() for s in a.labels.split(",") if s.strip()]
        for i, s in enumerate(labs[:2]):
            f = font(64); tw = f.getlength(s.upper()); y = H // 2 - 110 if i == 0 else H // 2 + 30
            d.rounded_rectangle([W - tw - 110, y, W - 40, y + 86], 22, fill=RED if i else (40, 40, 60), outline=INK, width=6)
            d.text((W - tw - 75, y + 6), s.upper(), font=f, fill=WHITE)
    if a.ring:
        x, y, r = map(int, a.ring.split(","))
        for k, (col, wd) in enumerate([(INK, 30), (RED, 18)]): d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=wd)
    if a.arrow:
        x1, y1, x2, y2 = map(int, a.arrow.split(",")); import math
        ang = math.atan2(y2 - y1, x2 - x1); hx, hy = x2 - 70 * math.cos(ang), y2 - 70 * math.sin(ang)
        head = [(x2, y2), (hx + 48 * math.sin(ang), hy - 48 * math.cos(ang)), (hx - 48 * math.sin(ang), hy + 48 * math.cos(ang))]
        d.line([(x1, y1), (hx, hy)], fill=INK, width=44); d.polygon(head, fill=INK)
        d.line([(x1, y1), (hx, hy)], fill=RED, width=26)
        inner = [(x2 - 10 * math.cos(ang), y2 - 10 * math.sin(ang)), (hx + 34 * math.sin(ang), hy - 34 * math.cos(ang)), (hx - 34 * math.sin(ang), hy + 34 * math.cos(ang))]
        d.polygon(inner, fill=RED)
    top_end = 170
    if a.badge:
        f = font(58); tw = f.getlength(a.badge.upper())
        d.rounded_rectangle([(W - tw) / 2 - 34, 160, (W + tw) / 2 + 34, 252], 26, fill=RED, outline=INK, width=7)
        d.text(((W - tw) / 2, 168), a.badge.upper(), font=f, fill=WHITE); top_end = 280
    if a.top: draw_block(d, a.top, top_end, hl, max_lines=3, px=a.px)
    if a.bottom: draw_block(d, a.bottom, 1480, hl, max_lines=2, px=a.px, anchor="bottom")
    img.convert("RGB").save(a.out, quality=94); print("cover", a.out)

if __name__ == "__main__":
    main()
