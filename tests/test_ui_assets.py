"""Tests for UI assets: 3D lotto balls (renderBalls), Dashboard summary, heatmaps and theme styles."""
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), encoding="utf-8") as f:
        return f.read()


# Las comprobaciones sobre el JavaScript antiguo (`app.js` de `static/`, esferas, resumen, mapas de calor) se fueron con cada pestaña que
# pasó a React; las cubren las pruebas de sus islas, y aquí solo queda lo que sigue en la hoja de estilos:
#   - T043 a T045 (Predicciones): `renderBalls`, el resumen (dashboard-hero-grid, last-draw-*, kpi) y las esferas de las
#     recomendaciones. frontend/src/components/Balls.test.tsx (una esfera por carácter, aria-label con el premio, `aria-hidden`
#     y el premio tal como llega; además lo vigila frontend/src/sin-relleno.test.ts), tabs/PrediccionesResumen.test.tsx y
#     tabs/Predicciones.test.tsx (esferas grandes doradas, verdes con reco-ml en ML, y «×N azar»).
#   - T040 (Terminaciones): esferas doradas medianas en modo estadístico, verdes y con reco-ml en modo ML.
#   - T049 (Análisis): el mapa de calor con su leyenda `heatmap-legend` y `cell-peak` desde el 90 % del máximo.
#   - T035 (Resultados): `prize-chip` con las clases prize-1/2/3, el guion de «sin dato» y los premios tal como llegan.
# Que las clases existan en la hoja de estilos lo comprueba TestStyleCSSCompleteness.


class TestStyleCSSCompleteness:
    def test_lotto_ball_variants_and_dashboard_classes_exist(self):
        css = _read("static/style.css")
        for selector in (
            ".lotto-balls",
            ".lotto-ball",
            ".ball-gold",
            ".ball-green",
            ".ball-purple",
            ".ball-hot",
            ".dashboard-hero-grid",
            ".last-draw-card",
            ".last-draw-prizes",
            ".dashboard-kpis",
            ".kpi-card",
            ".prize-chip",
            ".heatmap-table",
            ".heatmap-legend",
            ".cell-peak",
            "--surface-2",
        ):
            assert selector in css, f"Missing {selector} in static/style.css"

    def test_light_theme_overrides_preserved(self):
        css = _read("static/style.css")
        assert '[data-theme="light"]' in css
        assert '[data-theme="light"] .reco-card' in css
        assert '[data-theme="light"] .ball-gold' in css
