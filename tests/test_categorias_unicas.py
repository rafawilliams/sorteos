"""One category per draw: extraordinaria/extraordonario = extraordinario, zodiaco = gordito (fix/categorias-unicas)."""
import os
import sys
from datetime import date
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from loteria import categoria_canonica


@pytest.mark.parametrize("cruda, canonica", [
    ("dominical", "dominical"),
    ("miercolito", "miercolito"),
    ("gordito", "gordito"),
    ("zodiaco", "gordito"),
    ("extraordinario", "extraordinario"),
    ("extraordinaria", "extraordinario"),
    ("extraordonario", "extraordinario"),
    (" Extraordonario ", "extraordinario"),
    ("ZODIACO", "gordito"),
    ("Desconocida ", "desconocida"),
    ("", ""),
    (None, ""),
])
def test_categoria_canonica(cruda, canonica):
    assert categoria_canonica(cruda) == canonica


def _fila(tipo, fecha, p1, p2, p3):
    return SimpleNamespace(id=1, tipo=tipo, fecha=fecha, primero=p1, segundo=p2, tercero=p3,
                           letras="", serie="", folio="")


class TestLectura:
    def test_zodiaco_row_reads_as_gordito_with_2_digit_prizes(self):
        import app
        d = app._row_to_dict(_fila("zodiaco", date(2023, 12, 1), "4231", "1", "25"))
        assert d["cat"] == "gordito"
        assert (d["primero"], d["segundo"], d["tercero"]) == ("4231", "01", "25")

    def test_extraordinaria_row_reads_as_extraordinario(self):
        import app
        d = app._row_to_dict(_fila("Extraordinaria", date(2020, 12, 20), "5309", "98327", "61748"))
        assert d["cat"] == "extraordinario"


class TestGuardado:
    def test_api_variant_is_stored_canonical(self):
        from actualizar_db import fila_a_loteria
        s = fila_a_loteria({"fecha": "2026-12-20", "cat": "Extraordonario ", "primero": "05309",
                            "segundo": "98327", "tercero": "61748"})
        assert s.tipo == "extraordinario"

    def test_zodiaco_from_api_is_stored_as_gordito(self):
        from actualizar_db import fila_a_loteria
        s = fila_a_loteria({"fecha": "2023-12-01", "cat": "zodiaco", "primero": "4231",
                            "segundo": "1", "tercero": "25"})
        assert s.tipo == "gordito" and s.segundo == "01"

    def test_keys_use_the_canonical_category(self):
        from actualizar_db import clave_sorteo
        assert clave_sorteo("2026-12-20", "extraordonario", "05309") == \
            clave_sorteo("2026-12-20", "extraordinario", "05309")


class TestML:
    def test_variants_share_the_canonical_code(self):
        from ml_model import CAT_MAP
        assert CAT_MAP["extraordinaria"] == CAT_MAP["extraordonario"] == CAT_MAP["extraordinario"]
        assert CAT_MAP["zodiaco"] == CAT_MAP["gordito"]


def test_labels_have_no_variants():
    import estadisticas as E
    assert set(E.CAT_LABELS) == {"dominical", "miercolito", "gordito", "extraordinario"}


# --- closing review: endpoints, dedup with a stored zodiaco row, JS labels -------------------

GORDITO = {"id": "9026", "fecha": "2023-12-01", "cat": "gordito", "primero": "4231",
           "segundo": "01", "tercero": "25", "letra": "", "serie": "", "folio": ""}


@pytest.fixture
def client(monkeypatch):
    import app as app_module
    monkeypatch.setattr(app_module, "get_sorteos", lambda: [GORDITO])
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


@pytest.mark.parametrize("cat", ["zodiaco", "Gordito", " ZODIACO "])
def test_sorteos_filter_accepts_variants(client, cat):
    data = client.get(f"/api/sorteos?cat={cat}").get_json()
    assert [s["id"] for s in data["data"]] == ["9026"]


def test_simulador_filter_accepts_variants(client):
    data = client.get("/api/simulador?numero=4231&cat=zodiaco").get_json()
    assert data["total_sorteos"] == 1


def test_dedup_against_a_stored_zodiaco_row():
    from actualizar_db import descartar_sospechosos
    guardado = {"fecha": date(2023, 12, 1), "cat": "zodiaco", "primero": "4231", "segundo": "1", "tercero": "25"}
    nuevo = {"fecha": "2023-12-02", "cat": "gordito", "primero": "4231", "segundo": "01", "tercero": "25"}
    validos, descartados = descartar_sospechosos([nuevo], [guardado])
    assert validos == [] and descartados[0][1] == "fecha corregida"     # same draw, not a copy


def test_ui_labels_have_no_variants():
    import re
    ts = open(os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "lib", "formato.ts"), encoding="utf-8").read()
    etiquetas = re.search(r"export const CAT_LABELS[^=]*=\s*\{([^}]*)\}", ts).group(1)
    assert set(re.findall(r"(\w+):\s*'", etiquetas)) == {"dominical", "miercolito", "gordito", "extraordinario"}
