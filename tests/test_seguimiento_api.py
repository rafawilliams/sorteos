"""Seguimiento wired into the app: stats registration (fail-safe) and GET /api/seguimiento."""
import logging
import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module
import seguimiento as sg
from seguimiento import Prediccion

SORTEOS = [
    {"id": "12", "fecha": "2026-10-30", "cat": "gordito", "primero": "5312", "segundo": "62", "tercero": "88"},
    {"id": "11", "fecha": "2026-10-28", "cat": "miercolito", "primero": "7533", "segundo": "2673", "tercero": "2458"},
]


@pytest.fixture
def fake_db(monkeypatch):
    engine = create_engine("sqlite://")
    Prediccion.__table__.create(engine)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(app_module, "SeguimientoSession", factory)
    monkeypatch.setattr(app_module, "get_sorteos", lambda: SORTEOS)
    return factory


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


def test_recos_por_categoria_shape():
    stats_by_cat = {"gordito": {"recommendations": [{"number": f"{i}{i}{i}{i}"} for i in range(5)]}}
    ml_cat = {"gordito": [{"number": "9999"}] * 5}
    ml_end = {"gordito": [{"ending": f"{i:02d}"} for i in range(10)]}
    recos = app_module._recos_por_categoria(SORTEOS, stats_by_cat, ml_cat, ml_end)
    g = recos["gordito"]
    assert g["estadistico"]["numeros"] == ["0000", "1111", "2222", "3333", "4444"]
    assert set(g["estadistico"]["terminaciones"]) == {"12", "62", "88"}   # only endings seen in the data
    assert g["ml"]["numeros"] == ["9999"] * 5
    assert g["ml"]["terminaciones"][0] == "00"
    assert "miercolito" not in recos          # no statistical recommendations for it


def test_recos_without_ml():
    stats_by_cat = {"gordito": {"recommendations": [{"number": "1234"}]}}
    recos = app_module._recos_por_categoria(SORTEOS, stats_by_cat, {}, {})
    assert recos["gordito"]["ml"] is None


def test_registrar_seguro_records(fake_db):
    recos = {"gordito": {"ml": None, "estadistico": {"numeros": ["1234"] * 5, "terminaciones": ["12"] * 10}}}
    assert app_module._registrar_seguro(SORTEOS, recos) == ["gordito"]
    assert fake_db().query(Prediccion).count() == 2


def test_registrar_seguro_never_raises(fake_db, monkeypatch, caplog):
    def boom(*a, **k):
        raise RuntimeError("db exploded at C:\\secret")
    monkeypatch.setattr(sg, "registrar", boom)
    with caplog.at_level(logging.ERROR):
        assert app_module._registrar_seguro(SORTEOS, {}) == []
    assert "seguimiento" in caplog.text.lower()


def test_api_seguimiento(fake_db, client):
    s = fake_db()
    sg.registrar(s, SORTEOS, {"gordito": {"ml": None, "estadistico": {"numeros": ["5312"] * 5,
                                                                       "terminaciones": ["62"] * 10}}})
    s.close()
    r = client.get("/api/seguimiento")
    assert r.status_code == 200
    data = r.get_json()
    assert set(data) >= {"peso_ml", "pendientes", "comparados", "sin_registro", "marcador"}
    assert data["pendientes"][0]["categoria"] == "gordito"


def test_api_seguimiento_error_is_generic(fake_db, client, monkeypatch):
    monkeypatch.setattr(sg, "resumen", lambda *a: (_ for _ in ()).throw(RuntimeError("C:\\secret path")))
    r = client.get("/api/seguimiento")
    assert r.status_code == 500
    assert "secret" not in r.get_data(as_text=True)
