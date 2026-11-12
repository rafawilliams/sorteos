"""En CI el contrato con el front no puede saltarse (spec frontend-react, T009, criterio AC6).

`test_contrato_front.py` se salta si la base no es la sembrada (600 sorteos): bien en local, pero en CI un
salto dejaría el contrato sin comprobar con el job en verde. Esta prueba falla en CI si pasara. Lee el mismo
estado que usó ese módulo para decidir si se saltaba, no uno recalculado, para que no puedan discrepar.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _ci_activo():
    """GitHub Actions define CI=true; un `CI=false` o vacío no cuenta."""
    return os.getenv("CI", "").strip().lower() in {"1", "true", "yes"}


@pytest.mark.skipif(not _ci_activo(), reason="Solo en CI (GitHub Actions define CI=true).")
def test_en_ci_la_base_es_la_sembrada_y_el_contrato_se_ejecuta():
    import test_contrato_front as contrato

    assert contrato._ESTADO == "sembrada", (
        f"En CI la base debe ser la sembrada con tests/seed_db.py (600 sorteos) y es: {contrato._ESTADO} "
        f"({contrato._DATO}). Sin ella, tests/test_contrato_front.py se salta y el contrato con el front "
        "queda sin comprobar."
    )
