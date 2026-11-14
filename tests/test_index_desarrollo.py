"""La página del servidor de desarrollo (`frontend/index.html`, `npm run dev`) y la plantilla de Flask no se desvían.

La de desarrollo solo existe para trabajar con recarga en caliente; si se queda atrás de la plantilla, lo que se ve en
desarrollo deja de parecerse a lo que sirve Flask (otro título, otras fuentes, otro contenedor).
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLA = (RAIZ / "templates/index.html").read_text(encoding="utf-8")
DESARROLLO = (RAIZ / "frontend/index.html").read_text(encoding="utf-8")


def etiqueta(html: str, patron: str) -> str:
    """Primera coincidencia del patrón, sin las llamadas `url_for` de Jinja ni los espacios sobrantes."""
    m = re.search(patron, html, re.S)
    assert m, f"no se encontró {patron!r}"
    return re.sub(r"\s+", " ", m.group(0)).strip()


def test_mismo_titulo_idioma_y_fuentes():
    for patron in (r"<html lang=\"[a-z]+\">", r"<title>.*?</title>", r"<link href=\"https://fonts\.googleapis\.com[^>]*>"):
        assert etiqueta(PLANTILLA, patron) == etiqueta(DESARROLLO, patron)


def test_misma_raiz_fondo_y_aviso_emergente():
    for patron in (
        r"<div class=\"bg-orbs\".*?</div></div>",
        r"<div class=\"toast\" id=\"toast\"[^>]*></div>",
        r"<div id=\"root\">.*?</div>\s*</div>",
    ):
        assert etiqueta(PLANTILLA, patron) == etiqueta(DESARROLLO, patron)


def test_la_pagina_de_desarrollo_pide_los_estaticos_a_static_y_no_usa_jinja():
    assert "{{" not in DESARROLLO and "{%" not in DESARROLLO
    assert 'href="/static/style.css"' in DESARROLLO
    assert 'href="/static/favicon.svg"' in DESARROLLO
    assert "url_for('static', filename='style.css')" in PLANTILLA


def test_la_pagina_de_desarrollo_no_trae_el_script_del_build():
    assert "dist/app.js" not in DESARROLLO
    assert '<script type="module" src="/src/main.tsx"></script>' in DESARROLLO
