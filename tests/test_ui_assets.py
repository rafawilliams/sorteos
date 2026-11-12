"""Tests for UI assets: 3D lotto balls (renderBalls), Dashboard summary, heatmaps and theme styles."""
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), encoding="utf-8") as f:
        return f.read()


class TestLottoBallsAndDashboardJS:
    def test_render_balls_helper_defined_and_preserves_format(self):
        js = _read("static/app.js")
        assert "function renderBalls(" in js
        assert "lotto-ball ball-" in js
        assert 'aria-label="${esc(s)}"' in js
        assert 'aria-hidden="true"' in js
        # renderBalls itself must never padStart(4) a prize
        m = re.search(r"function renderBalls\([^)]*\)\{.*?\n\}", js, re.DOTALL)
        assert m is not None
        assert "padStart" not in m.group(0)
        assert "zfill" not in m.group(0)

    def test_dashboard_uses_hero_grid_and_last_draw_balls(self):
        js = _read("static/app.js")
        assert "dashboard-hero-grid" in js
        assert "last-draw-card" in js
        assert "last-draw-prizes" in js
        assert "last-draw-meta" in js
        assert "dashboard-kpis" in js
        assert "renderBalls(last.primero,'gold','md')" in js
        assert "renderBalls(last.segundo,'green','md')" in js
        assert "renderBalls(last.tercero,'purple','md')" in js

    def test_recommendations_and_heatmaps_use_new_ui_components(self):
        js = _read("static/app.js")
        assert "renderBalls(r.number,useML?'green':'gold','lg')" in js
        assert "renderBalls(r.ending,useML?'green':'gold','md')" in js
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
