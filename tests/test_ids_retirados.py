"""Guardia de ids retirados (spec frontend-react, T018).

Cada pestaña que pasó a React dejó de tener en `static/style.css` y `templates/index.html` sus `id` antiguos, y
el JavaScript antiguo (`app.js` de `static/`) ya no existe. Esta prueba falla si alguien los reintroduce (por ejemplo al resolver
un conflicto de fusión con una rama vieja): código muerto que además vuelve a pelear con la sección por el mismo contenedor.
"""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
ARCHIVOS = ("static/style.css", "templates/index.html")

# id retirado -> sección de React que lo sustituye (`<Seccion id="…">` en frontend/src/shell/Secciones.tsx)
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
    "statCounters": "resultados",
    "searchInput": "resultados",
    "catFilter": "resultados",
    "dateFrom": "resultados",
    "dateTo": "resultados",
    "sorteosBody": "resultados",
    "csvBtn": "resultados",
    "decenaContainer": "decenas",
    "endCatTabs": "terminaciones",
    "endingsRecoContainer": "terminaciones",
    "endingsBacktestNote": "terminaciones",
    "endingsHotChart": "terminaciones",
    "endingsColdChart": "terminaciones",
    "endP1Chart": "terminaciones",
    "endP2Chart": "terminaciones",
    "endP3Chart": "terminaciones",
    "endingsHeatmap": "terminaciones",
    "endingsTrendChart": "terminaciones",
    "statsPrizeTabs": "estadisticas",
    "digitChart": "estadisticas",
    "endingsChart": "estadisticas",
    "hotChart": "estadisticas",
    "coldChart": "estadisticas",
    "seriesChart": "estadisticas",
    "letrasChart": "estadisticas",
    "radarChart": "estadisticas",
    "scatterChart": "estadisticas",
    "formatosCard": "estadisticas",
    "formatosGrid": "estadisticas",
    "trendChart": "tendencias",
    "volumeChart": "tendencias",
    "positionGrids": "analisis",
    "heatmap": "analisis",
    "dashboardSummary": "predicciones-resumen",
    "prizeTabs": "predicciones",
    "recoCatTabs": "predicciones",
    "recoContainer": "predicciones",
    # `pagination` (id) no se vigila: `.pagination` sigue siendo una clase de style.css que usa la isla.
    # `updateBtn` tampoco se vigila: es el `id` del botón «Actualizar datos» que pinta `shell/Actualizar.tsx` (no está en la plantilla).
}


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


def test_el_javascript_antiguo_ya_no_existe():
    assert not (RAIZ / "static" / "app.js").exists(), "el app.js de static/ está retirado: toda la interfaz es React (frontend/src)."


@pytest.mark.parametrize("isla", sorted(set(IDS_RETIRADOS.values())))
def test_cada_seccion_sustituta_existe_en_el_armazon(isla):
    # `predicciones-resumen` es la primera isla de la sección «predicciones»
    seccion = isla.split("-")[0]
    assert f'<Seccion id="{seccion}">' in leer("frontend/src/shell/Secciones.tsx")


class TestPlantillaMinima:
    """La plantilla solo trae la raíz de React: ni marcadores de islas, ni el JavaScript antiguo, ni la CDN de Chart.js."""

    def test_trae_la_raiz_donde_se_pinta_la_interfaz(self):
        assert 'id="root"' in leer("templates/index.html")

    def test_no_quedan_marcadores_de_islas(self):
        assert "data-react-root" not in leer("templates/index.html")

    def test_no_carga_el_javascript_antiguo_ni_chart_js_de_una_cdn(self):
        plantilla = leer("templates/index.html")
        assert "filename='app.js'" not in plantilla
        assert "cdn.jsdelivr" not in plantilla
        assert "chart.umd" not in plantilla

    def test_solo_carga_el_build_de_react_como_modulo(self):
        assert "filename='dist/app.js'" in leer("templates/index.html")
