"""Render the short on Modal (frames in parallel, encode + QA in the cloud) and download the MP4 into out/.
Run from the project folder (needs `modal` installed and authenticated: `modal token new` / `modal profile current`).
  modal run modal_render.py --title "My Short"                 (all frames; total read from work/phrases.json)
  modal run modal_render.py --frames "0,400,830" --chunk 3      (quick test; frames land in the volume only)
Fetch test frames with:  modal volume get --force <volume> frames/f0400.jpg stills/modal/f0400.jpg
Progress during a run:   modal volume ls <volume> frames | grep -c f0
"""
import json, os, pathlib, re, subprocess
import modal

HERE = pathlib.Path(__file__).parent
SLUG = re.sub(r"[^a-z0-9-]+", "-", HERE.name.lower()).strip("-") or "short"
VOLUME = f"cartoon-short-{SLUG}"[:60]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "ffmpeg", "fonts-dejavu-core", "fonts-liberation")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "mkdir -p /app && cd /app && npm init -y >/dev/null && npm i playwright@1.65.1 && npx playwright install --with-deps chromium",
    )
    .add_local_file(HERE / "render.mjs", "/app/render.mjs")
    .add_local_dir(HERE / "web", "/app/web", ignore=["main_example.js", "*.bak"])
)
app = modal.App(f"cartoon-short-{SLUG}"[:60], image=image)
vol = modal.Volume.from_name(VOLUME, create_if_missing=True)


@app.function(cpu=4.0, memory=8192, timeout=3600, volumes={"/out": vol})
def render_chunk(frames: list[int]) -> int:
    os.makedirs("/out/frames", exist_ok=True)
    r = subprocess.run(["node", "render.mjs", "/out/frames", ",".join(map(str, frames))], cwd="/app", capture_output=True, text=True)
    log = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if "GPU stall" not in l)
    print(log[-1500:])
    if r.returncode != 0 or "ERR" in log: raise RuntimeError(log[-3000:])
    vol.commit()
    return len(frames)


@app.function(timeout=600, volumes={"/out": vol})
def clear_frames() -> None:
    subprocess.run("rm -rf /out/frames", shell=True); vol.commit()


@app.function(cpu=8.0, memory=8192, timeout=1800, volumes={"/out": vol})
def encode(audio: bytes, total: int) -> tuple[bytes, bytes, str]:
    vol.reload()
    missing = [f for f in range(total) if not os.path.exists(f"/out/frames/f{f:04d}.jpg")]
    if missing: raise RuntimeError(f"missing frames: {missing[:20]} ({len(missing)})")
    open("/tmp/mix_raw.wav", "wb").write(audio)
    # one linear gain to about -14 LUFS, then a -1 dBFS peak limiter
    meas = subprocess.run(["ffmpeg", "-i", "/tmp/mix_raw.wav", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float([l for l in meas.splitlines() if l.strip().startswith("I:")][-1].split()[1]); gain = -14.0 - I
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "/tmp/mix_raw.wav", "-af", f"volume={gain:.2f}dB,alimiter=limit=0.891:level=false", "-ar", "48000", "-ac", "2", "/tmp/mix.wav"], check=True)
    out = "/tmp/short.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", "/out/frames/f%04d.jpg", "-i", "/tmp/mix.wav", "-map", "0:v:0", "-map", "1:a:0",
                    "-frames:v", str(total), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", out], check=True)
    qa = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate", "-of", "compact", out], capture_output=True, text=True).stdout
    det = subprocess.run(["ffmpeg", "-i", out, "-vf", "freezedetect=n=0.0005:d=0.4,blackdetect=d=0.05", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    qa += "\n".join(l for l in det.splitlines() if "freeze_start" in l or "black_start" in l) or "no frozen/black spans"
    loud = subprocess.run(["ffmpeg", "-i", out, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    qa += f"\nmeasured {I:.1f} LUFS, gain {gain:+.1f} dB; final " + [l.strip() for l in loud.splitlines() if l.strip().startswith("I:")][-1]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out, "-vf", "fps=2,scale=180:-1,tile=10x6", "-frames:v", "1", "/tmp/qa.jpg"], check=True)
    return open(out, "rb").read(), open("/tmp/qa.jpg", "rb").read(), qa


@app.local_entrypoint()
def main(frames: str = "", chunk: int = 24, total: int = 0, title: str = "short"):
    if not total: total = json.loads((HERE / "work" / "phrases.json").read_text(encoding="utf-8"))["frames30"]
    if not frames: clear_frames.remote()
    fl = [int(x) for x in frames.split(",")] if frames else list(range(total))
    done = 0
    for n in render_chunk.map([fl[i:i + chunk] for i in range(0, len(fl), chunk)]):
        done += n; print(f"rendered {done}/{len(fl)}", flush=True)
    if frames: print(f"test frames in volume {VOLUME}"); return
    mp4, qa_jpg, qa = encode.remote((HERE / "mix_raw.wav").read_bytes(), total)
    name = re.sub(r"[^A-Za-z0-9-]+", "-", title).strip("-") or "short"
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / f"{name}.mp4").write_bytes(mp4); (HERE / "out" / "qa_sheet.jpg").write_bytes(qa_jpg)
    print(qa); print("saved", HERE / "out" / f"{name}.mp4")
