"""
seed_photos/ 의 원본 사진(seed_{m,f}01~06.*)을 3:4(1024x1365) PNG로 정규화하고
manifest.json 을 갱신한다. seed_demo.py 실행 전에 사진을 교체했을 때만 쓰는 일회성 도구.

기존 manifest 의 apparent_age / description 은 보존한다 (직접 채운 값이 덮어써지지 않도록).

    python backend/scripts/normalize_seed_photos.py   # 어느 디렉토리에서 실행해도 됨
"""

import json
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[2] / "seed_photos"
MANIFEST = SRC / "manifest.json"
W, H = 1024, 1365

existing = {}
if MANIFEST.exists():
    existing = {m["id"]: m for m in json.loads(MANIFEST.read_text(encoding="utf-8"))}

manifest = []
for i in range(1, 7):
    for g in ("m", "f"):
        sid = f"{g}{i:02d}"
        name = f"seed_{sid}"
        src = next(SRC.glob(f"{name}.*"), None)
        if not src:
            print(f"[MISSING] {name}")
            continue

        im = Image.open(src).convert("RGB")
        # 3:4로 센터 크롭 후 리사이즈
        tw, th = im.width, int(im.width * H / W)
        if th > im.height:
            th, tw = im.height, int(im.height * W / H)
        left, top = (im.width - tw) // 2, (im.height - th) // 2
        im = im.crop((left, top, left + tw, top + th)).resize((W, H), Image.LANCZOS)

        out = SRC / f"{name}.png"
        im.save(out)
        if src != out:
            src.unlink()

        prev = existing.get(sid, {})
        manifest.append({
            "id": sid,
            "gender": "male" if g == "m" else "female",
            "apparent_age": prev.get("apparent_age", ""),  # 비어 있으면 직접 채우기
            "filename": out.name,
            "description": prev.get("description", ""),    # 비어 있으면 직접 채우기
        })

MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"done: {len(manifest)}/12")
