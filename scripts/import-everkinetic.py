#!/usr/bin/env python3
"""
Importa el catálogo Everkinetic (CC BY-SA 4.0) a Project Ascension.

Uso:
    git clone --depth 1 https://github.com/everkinetic/data /tmp/everkinetic
    python3 -I scripts/import-everkinetic.py /tmp/everkinetic

Qué hace:
  1. Recolorea cada ilustración SVG al estilo de la app (líneas cian, fondo transparente).
  2. La rasteriza a WebP (480 px de alto) en assets/exercises/everkinetic/.
  3. Genera los metadatos (texto original en inglés) y el mapa de imágenes en
     src/features/exercises/library/.
  4. Copia la licencia y documenta los cambios (requisito de CC BY-SA 4.0).

Requiere: rsvg-convert e ImageMagick (convert) con soporte WebP.
Las traducciones al español viven aparte (library/es.ts) y no las toca este script.
"""
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "exercises" / "everkinetic"
OUT_TS = ROOT / "src" / "features" / "exercises" / "library"
LINE_COLOR = "#22D3EE"
HEIGHT = 480


def recolor(svg: str) -> str:
    # El fondo blanco es un único <g fill="#FFF"> con huecos; se elimina para dejar transparencia.
    svg = re.sub(r'<g fill="#FFF">.*?</g>', "", svg, flags=re.S)
    return svg.replace('fill="#333"', f'fill="{LINE_COLOR}"')


def clean(text: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", "", text or ""))
    return re.sub(r"\s+", " ", text).strip()


def main(src: Path) -> None:
    data = json.loads((src / "dist" / "exercises.json").read_text(encoding="utf-8"))
    ASSETS.mkdir(parents=True, exist_ok=True)
    OUT_TS.mkdir(parents=True, exist_ok=True)

    records = []
    with tempfile.TemporaryDirectory() as tmp:
        for ex in data:
            ex_id = ex["id"]
            svgs = ex.get("svg") or []
            if len(svgs) != 2:
                print(f"omitido {ex_id}: {len(svgs)} imágenes", file=sys.stderr)
                continue
            for i, rel in enumerate(svgs):
                svg = recolor((src / "dist" / rel).read_text(encoding="utf-8"))
                tmp_svg = Path(tmp) / f"{ex_id}-{i}.svg"
                tmp_png = Path(tmp) / f"{ex_id}-{i}.png"
                tmp_svg.write_text(svg, encoding="utf-8")
                subprocess.run(["rsvg-convert", "-h", str(HEIGHT), str(tmp_svg), "-o", str(tmp_png)], check=True)
                subprocess.run(
                    ["convert", str(tmp_png), "-quality", "82", str(ASSETS / f"{ex_id}-{i}.webp")], check=True
                )

            primer = clean(ex.get("primer", ""))
            steps = [clean(s) for s in ex.get("steps", [])]
            # Algunos registros repiten el resumen como primer paso o traen títulos HTML sueltos.
            steps = [s for s in steps if s and s != primer and s.lower() not in ("tip", "tips")]
            records.append(
                {
                    "id": ex_id,
                    "slug": ex["name"],
                    "title": clean(ex["title"]),
                    "primer": primer,
                    "type": clean(ex.get("type", "")),
                    "primary": ex.get("primary", []),
                    "secondary": ex.get("secondary", []),
                    "equipment": [e.strip().lower() for e in ex.get("equipment", [])],
                    "steps": steps,
                    "tips": [clean(t) for t in ex.get("tips", []) if clean(t)],
                }
            )

    header = (
        "// ARCHIVO GENERADO por scripts/import-everkinetic.py — no editar a mano.\n"
        "// Fuente: Everkinetic (https://github.com/everkinetic/data), CC BY-SA 4.0.\n"
    )
    (OUT_TS / "everkinetic.data.ts").write_text(
        header
        + "import type { EverkineticRecord } from './types';\n\n"
        + "export const EVERKINETIC: EverkineticRecord[] = "
        + json.dumps(records, ensure_ascii=False, indent=1)
        + ";\n",
        encoding="utf-8",
    )

    lines = [header, "/* eslint-disable @typescript-eslint/no-require-imports */", "export const EK_IMAGES: Record<string, [number, number]> = {"]
    for r in records:
        base = f"../../../../assets/exercises/everkinetic/{r['id']}"
        lines.append(f"  '{r['id']}': [require('{base}-0.webp'), require('{base}-1.webp')],")
    lines.append("};\n")
    (OUT_TS / "everkinetic.images.ts").write_text("\n".join(lines), encoding="utf-8")

    shutil.copy(src / "LICENSE.md", ASSETS / "LICENSE.md")
    (ASSETS / "NOTICE.md").write_text(
        "# Ilustraciones y textos de Everkinetic\n\n"
        "Fuente: Everkinetic — https://github.com/everkinetic/data\n"
        "Licencia: Creative Commons Attribution-ShareAlike 4.0 International (ver LICENSE.md)\n\n"
        "## Cambios realizados por Project Ascension\n\n"
        "- Ilustraciones: fondo eliminado (transparente), líneas recoloreadas a #22D3EE, "
        f"rasterizadas a WebP de {HEIGHT} px de alto.\n"
        "- Textos: traducidos al español y adaptados; se corrigieron indicaciones técnicas erróneas del original.\n\n"
        "Estas adaptaciones se distribuyen bajo la misma licencia CC BY-SA 4.0.\n",
        encoding="utf-8",
    )
    print(f"{len(records)} ejercicios importados, {len(records) * 2} imágenes")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve())
