"""Servidor fijo (waitress): escucha solo en este equipo, puerto configurable y sin depuración."""
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import servir


class TestPuerto:
    def test_por_defecto_5000(self, monkeypatch):
        monkeypatch.delenv("LOTERIA_PUERTO", raising=False)
        assert servir.puerto() == 5000

    def test_se_puede_cambiar_por_entorno(self, monkeypatch):
        monkeypatch.setenv("LOTERIA_PUERTO", "5001")
        assert servir.puerto() == 5001

    @pytest.mark.parametrize("valor", ["abc", "", "0", "-1", "65536", "50.5"])
    def test_valor_invalido_falla_con_mensaje_claro(self, monkeypatch, valor):
        monkeypatch.setenv("LOTERIA_PUERTO", valor)
        with pytest.raises(ValueError, match="LOTERIA_PUERTO"):
            servir.puerto()


class TestSoloLocal:
    def test_el_host_es_el_bucle_local(self):
        assert servir.HOST == "127.0.0.1"


class TestMain:
    @pytest.fixture
    def falsos(self, monkeypatch):
        llamadas = []
        app_falsa = object()
        monkeypatch.setitem(sys.modules, "app", types.SimpleNamespace(app=app_falsa))
        monkeypatch.setattr("waitress.serve", lambda app, **kw: llamadas.append((app, kw)))
        monkeypatch.delenv("LOTERIA_PUERTO", raising=False)
        return llamadas, app_falsa

    def test_sirve_la_app_en_127_0_0_1_sin_depuracion(self, monkeypatch, falsos):
        llamadas, app_falsa = falsos
        monkeypatch.setenv("FLASK_DEBUG", "1")  # el .env de desarrollo la enciende
        servir.main()
        assert len(llamadas) == 1
        app, kw = llamadas[0]
        assert app is app_falsa
        assert kw["host"] == "127.0.0.1"
        assert kw["port"] == 5000
        assert os.environ["FLASK_DEBUG"] == "0"

    def test_la_depuracion_se_apaga_antes_de_importar_la_app(self, monkeypatch, falsos):
        monkeypatch.setenv("FLASK_DEBUG", "1")
        visto = {}
        monkeypatch.delitem(sys.modules, "app")

        def importar_app():
            visto["debug"] = os.environ["FLASK_DEBUG"]
            return object()

        monkeypatch.setattr(servir, "_importar_app", importar_app)
        servir.main()
        assert visto["debug"] == "0"
