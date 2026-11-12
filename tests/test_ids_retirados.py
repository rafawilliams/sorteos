"""Guardia de ids retirados (spec frontend-react, T018).

Cada pestaña que pasa a React deja de tener en `static/app.js`, `static/style.css` y `templates/index.html` sus `id`
y sus funciones antiguas. Esta prueba falla si alguien los reintroduce (por ejemplo al resolver un conflicto de fusión
con una rama vieja): código muerto que además vuelve a pelear con la isla por el mismo contenedor.

Al migrar otra pestaña, añade aquí sus `id` y funciones retirados y el nombre de su isla.
"""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
ARCHIVOS = ("static/app.js", "static/style.css", "templates/index.html")

# id retirado -> isla que lo sustituye (su marcador `data-react-root` debe existir en la plantilla)
IDS_RETIRADOS = {
    "gapsContent": "gaps",
    "segLoader": "seguimiento",
    "segContent": "seguimiento",
    "segSummary": "seguimiento",
    "segPendientes": "seguimiento",
    "segMarcador": "seguimiento",
    "segHistorial": "seguimiento",
    "favInput": "favoritos",
    "favContainer": "favoritos",
    "compInput": "comparador",
    "compTags": "comparador",
    "compResults": "comparador",
    "compMonthlyChart": "comparador",
    "simNumero": "simulador",
    "simCat": "simulador",
    "simFrom": "simulador",
    "simTo": "simulador",
    "simBtn": "simulador",
    "simResults": "simulador",
    "monthlyTarget": "mensual",
    "monthlyAdvantage": "mensual",
    "monthlyProfileChart": "mensual",
    "monthlyCards": "mensual",
    "precisionLoader": "precision",
    "precisionContent": "precision",
    "precisionSummary": "precision",
    "precisionPositions": "precision",
    "precisionComparison": "precision",
    "precisionTrendChart": "precision",
}
# funciones de app.js que ya no deben existir ni llamarse
FUNCIONES_RETIRADAS = (
    "loadGaps", "renderGaps",
    "loadSeguimiento", "renderSeguimiento", "segPct", "segNum", "SEG_METODOS",
    "getFavorites", "saveFavorites", "addFavorite", "removeFavorite", "renderFavorites", "updateFavBadge",
    "addCompNumber", "removeCompNumber", "clearCompNumbers", "renderCompTags", "runComparison", "renderCompResults",
    "compNumbers", "compChartInstance",
    "initSimCats", "runSimulation", "renderSimResults", "simChartInstance",
    "renderMonthlySection", "monthlyProfileChartInstance",
    "loadBacktesting", "renderBacktesting", "renderPrecisionTrend", "backtestData", "precisionChartInstance",
)


def menciones(texto: str, palabra: str) -> list[int]:
    """Líneas (desde 1) donde aparece `palabra` como palabra completa, entre comillas, en un selector o en un atributo."""
    patron = re.compile(rf"(?<![A-Za-z0-9_$-]){re.escape(palabra)}(?![A-Za-z0-9_$-])")
    return [n for n, linea in enumerate(texto.splitlines(), start=1) if patron.search(linea)]


def leer(ruta: str) -> str:
    return (RAIZ / ruta).read_text(encoding="utf-8")


class TestElDetectorFunciona:
    """El detector tiene que poder fallar: se prueba contra texto sintético con cada forma de reintroducir un id."""

    @pytest.mark.parametrize(
        "linea",
        [
            "document.getElementById('gapsContent').innerHTML=h;",
            'document.getElementById("gapsContent")',
            "document.querySelector('#gapsContent .card')",
            "const c = `gapsContent`;",
            '<div id="gapsContent" role="region"></div>',
            "#gapsContent{display:none}",
            "loadGaps();",
        ],
    )
    def test_detecta_cada_forma(self, linea):
        palabra = "loadGaps" if "loadGaps" in linea else "gapsContent"
        assert menciones(linea, palabra) == [1]

    @pytest.mark.parametrize(
        "linea",
        ["gapsContentX", "xgapsContent", "gaps-content", "loadGapsMore", "reloadGaps()", "gapsContent_viejo"],
    )
    def test_no_confunde_nombres_parecidos(self, linea):
        assert menciones(linea, "gapsContent") == []
        assert menciones(linea, "loadGaps") == []

    def test_da_el_numero_de_linea(self):
        assert menciones("a\nb\nloadGaps()\n", "loadGaps") == [3]


@pytest.mark.parametrize("archivo", ARCHIVOS)
@pytest.mark.parametrize("id_retirado", sorted(IDS_RETIRADOS))
def test_ningun_id_retirado_vuelve(archivo, id_retirado):
    assert menciones(leer(archivo), id_retirado) == [], (
        f"«{id_retirado}» está retirado: lo sustituye la isla «{IDS_RETIRADOS[id_retirado]}». "
        f"Quítalo de {archivo} (¿un conflicto de fusión con una rama vieja?)."
    )


@pytest.mark.parametrize("funcion", FUNCIONES_RETIRADAS)
def test_ninguna_funcion_retirada_vuelve(funcion):
    assert menciones(leer("static/app.js"), funcion) == [], f"«{funcion}» está retirada de static/app.js: la sustituye una isla React."


@pytest.mark.parametrize("isla", sorted(set(IDS_RETIRADOS.values())))
def test_cada_isla_sustituta_tiene_su_marcador(isla):
    assert f'data-react-root="{isla}"' in leer("templates/index.html")
