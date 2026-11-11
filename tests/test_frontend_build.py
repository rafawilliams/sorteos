"""La página sirve la interfaz React construida, o un aviso claro si falta el build.

Spec frontend-react, criterio «clon sin build»: sin `static/dist/app.js` la página
muestra cómo construirla (sin error 500 ni detalles internos) y la API sigue respondiendo.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module
from app import app

AVISO = "npm --prefix frontend run build"


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def sin_build(monkeypatch, tmp_path):
    monkeypatch.setattr(app_module, "FRONTEND_BUILD", str(tmp_path / "no-existe" / "app.js"))


@pytest.fixture
def con_build(monkeypatch, tmp_path):
    build = tmp_path / "dist" / "app.js"
    build.parent.mkdir()
    build.write_text("/* build de prueba */")
    monkeypatch.setattr(app_module, "FRONTEND_BUILD", str(build))


class TestSinBuild:
    def test_muestra_el_aviso_con_el_comando_para_construir(self, client, sin_build):
        r = client.get("/")
        assert r.status_code == 200
        html = r.get_data(as_text=True)
        assert 'role="alert"' in html
        assert AVISO in html

    def test_no_incluye_el_script_de_la_interfaz(self, client, sin_build):
        html = client.get("/").get_data(as_text=True)
        assert "dist/app.js" not in html

    def test_la_api_sigue_respondiendo(self, client, sin_build):
        r = client.get("/api/sorteos?page=1&per_page=1")
        assert r.status_code == 200
        assert "data" in r.get_json()


class TestConBuild:
    def test_incluye_el_script_como_modulo(self, client, con_build):
        html = client.get("/").get_data(as_text=True)
        assert '<script type="module"' in html
        assert "dist/app.js" in html

    def test_no_muestra_el_aviso(self, client, con_build):
        html = client.get("/").get_data(as_text=True)
        assert AVISO not in html
        assert 'role="alert"' not in html
