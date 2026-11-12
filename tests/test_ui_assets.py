"""Tests for UI assets: 3D lotto balls (renderBalls), Dashboard summary, heatmaps and theme styles."""
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), encoding="utf-8") as f:
        return f.read()


class TestLottoBallsAndDashboardJS:
    # `renderBalls`, el resumen (`renderDashboard`: dashboard-hero-grid, last-draw-*, kpi) y las esferas de las
    # recomendaciones ya no están en app.js: los pinta la isla Predicciones (T043 a T045). Lo cubren sus pruebas:
    #   - frontend/src/components/Balls.test.tsx: una esfera por carácter, aria-label con el premio, `aria-hidden` en cada
    #     esfera y el premio tal como llega (sin padStart ni zfill; además lo vigila frontend/src/sin-relleno.test.ts).
    #   - frontend/src/tabs/PrediccionesResumen.test.tsx: tarjeta del último sorteo con esferas medianas dorada, verde y
    #     morada, letras, serie y folio, y los cuatro indicadores.
    #   - frontend/src/tabs/Predicciones.test.tsx: esferas grandes doradas (verdes con reco-ml en ML) y «×N azar».
    # Que las clases existan en la hoja de estilos lo sigue comprobando TestStyleCSSCompleteness.

    def test_recommendations_and_heatmaps_use_new_ui_components(self):
        js = _read("static/app.js")
        # Las esferas de las terminaciones ya no están en app.js: las pinta la isla Terminaciones (T040). Lo cubren sus
        # pruebas (frontend/src/tabs/Terminaciones.test.tsx: esferas doradas medianas en modo estadístico, verdes y
        # con la marca reco-ml en modo ML).
        assert "heatmap-legend" in js
        assert "cell-peak" in js
        # `prize-chip` ya no está en app.js: lo pinta la isla Resultados (T035). Lo cubren sus pruebas
        # (frontend/src/tabs/Resultados.test.tsx: clases prize-1/2/3, guion de «sin dato» y premios tal como llegan);
        # que la clase exista en la hoja de estilos lo sigue comprobando TestStyleCSSCompleteness.


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
