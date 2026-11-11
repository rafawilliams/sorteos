"""En CI el contrato con el front no puede saltarse (spec frontend-react, T009, criterio AC6).

`test_contrato_front.py` se salta si la base no es la sembrada (600 sorteos): bien en local, pero en CI un
salto dejaría el contrato sin comprobar con el job en verde. Esta prueba falla en CI si pasara.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from contrato_front import estado_base


@pytest.mark.skipif(not os.getenv("CI"), reason="Solo en CI (GitHub Actions define CI=true).")
def test_en_ci_la_base_es_la_sembrada_y_el_contrato_se_ejecuta():
    estado, dato = estado_base()
    assert estado == "sembrada", (
        f"En CI la base debe ser la sembrada con tests/seed_db.py (600 sorteos) y es: {estado} ({dato}). "
        "Sin ella, tests/test_contrato_front.py se salta y el contrato con el front queda sin comprobar."
    )
