"""Atualiza as miniaturas locais: execute com Python e Pillow instalados."""
import concurrent.futures
import io
import json
from pathlib import Path
import time
import subprocess

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "dados-fotos.js"
photos = json.loads(DATA.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";"))
(ROOT / "miniaturas").mkdir(exist_ok=True)


def convert(photo):
    stem = Path(photo["nome"]).stem
    paths = [ROOT / "miniaturas" / f"{stem}-{width}.webp" for width in (480, 960)]
    if not all(path.exists() for path in paths) or "width" not in photo:
        for attempt in range(3):
            try:
                source = subprocess.run(
                    ["curl.exe", "--fail", "--silent", "--show-error", "--max-time", "45", photo["url"]],
                    check=True, capture_output=True,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                ).stdout
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
        with Image.open(io.BytesIO(source)) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            photo["width"], photo["height"] = image.size
            photo["originalBytes"] = len(source)
            for width, path in zip((480, 960), paths):
                preview = image.copy()
                preview.thumbnail((width, width), Image.Resampling.LANCZOS)
                preview.save(path, "WEBP", quality=76, method=4)
    photo["thumbnail"] = f"miniaturas/{stem}-480.webp"
    photo["preview"] = f"miniaturas/{stem}-960.webp"
    return photo


if __name__ == "__main__":
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(convert, photo): photo for photo in photos}
        for count, job in enumerate(concurrent.futures.as_completed(jobs), 1):
            try:
                job.result()
            except Exception as error:
                failures.append(jobs[job]["nome"])
                print(f"Falha: {jobs[job]['nome']}: {error}", flush=True)
            if count % 25 == 0:
                print(f"{count}/{len(photos)} fotos processadas", flush=True)
    DATA.write_text("// Catálogo local e miniaturas; originais preservados para download.\nwindow.__BACKUP_PHOTOS__ = " + json.dumps(photos, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(json.dumps({"photos": len(photos), "failures": failures, "originalBytes": sum(p.get("originalBytes", 0) for p in photos), "thumbnailBytes": sum(p.stat().st_size for p in (ROOT / "miniaturas").glob("*-480.webp")), "previewBytes": sum(p.stat().st_size for p in (ROOT / "miniaturas").glob("*-960.webp"))}), flush=True)
    raise SystemExit(bool(failures))
