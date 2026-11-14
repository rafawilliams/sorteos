"""Menú lateral (decisión del dueño, 2026-11-11): la barra de 14 pestañas pasa a barra lateral y, en pantallas
estrechas, se esconde y la abre un botón con el icono de menú. El comportamiento lo prueba
`frontend/src/shell/Tabs.test.tsx` contra los componentes de React; aquí se fijan la plantilla y las reglas de CSS que lo hacen posible
y que jsdom no puede ver (posición fija, punto de corte, orden de apilamiento).
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLA = (RAIZ / "templates/index.html").read_text(encoding="utf-8")
CSS = (RAIZ / "static/style.css").read_text(encoding="utf-8")

def regla(selector: str) -> str:
    """Cuerpo de la regla CSS de nivel superior (columna 0, fuera de @media) cuyo selector es exactamente `selector`."""
    m = re.search(r"^" + re.escape(selector) + r"\{([^}]*)\}", CSS, re.M)
    assert m, f"no hay regla de nivel superior para {selector}"
    return m.group(1)


def bloque_media(consulta: str) -> str:
    """Contenido de TODOS los `@media(...)` con esa consulta (hay más de uno), con llaves anidadas."""
    contenido, inicio = [], 0
    while (i := CSS.find(f"@media({consulta})", inicio)) != -1:
        j = CSS.index("{", i)
        nivel, k = 1, j + 1
        while nivel:
            nivel += {"{": 1, "}": -1}.get(CSS[k], 0)
            k += 1
        contenido.append(CSS[j + 1 : k - 1])
        inicio = k
    assert contenido, f"no hay @media({consulta})"
    return "\n".join(contenido)


class TestPlantilla:
    """El marcado del menú (la lista de pestañas, el botón y el fondo) lo pinta React; su prueba está en `Tabs.test.tsx`."""

    def test_la_plantilla_ya_no_trae_el_menu_a_mano(self):
        for resto in ('id="navTabs"', 'id="menuToggle"', 'id="menuBackdrop"', "nav-tab"):
            assert resto not in PLANTILLA, f"«{resto}» lo pinta ahora el armazón de React"

    def test_la_plantilla_trae_la_raiz(self):
        assert 'id="root"' in PLANTILLA


class TestCss:
    def test_la_barra_es_lateral_y_fija(self):
        r = regla(".nav-tabs")
        assert "position:fixed" in r and "left:0" in r and "top:0" in r and "bottom:0" in r
        assert "width:248px" in r and "flex-direction:column" in r

    def test_escritorio_deja_sitio_a_la_barra(self):
        assert "padding-left:calc(24px + 248px)" in bloque_media("min-width:901px")

    def test_el_boton_solo_se_ve_con_la_barra_escondida(self):
        assert "display:none" in regla(".menu-toggle")
        assert ".menu-toggle{display:flex}" in bloque_media("max-width:900px")

    def test_escondida_no_es_alcanzable_con_el_teclado(self):
        estrecho = bloque_media("max-width:900px")
        assert "visibility:hidden" in estrecho and "translateX(-100%)" in estrecho
        assert ".nav-tabs.open{transform:none;visibility:visible" in estrecho

    def test_abrir_muestra_la_barra_al_instante(self):
        """Si `visibility` transicionara al abrir, `focus()` fallaría en el primer instante."""
        abierta = re.search(r"\.nav-tabs\.open\{([^}]*)\}", bloque_media("max-width:900px")).group(1)
        assert "visibility 0s" not in abierta

    def test_las_pestanas_no_transicionan_visibility(self):
        """`transition: all` incluía `visibility`: la pestaña seguía oculta al enfocarla justo tras abrir."""
        reglas = re.findall(r"^\.nav-tab\{([^}]*)\}", CSS, re.M)
        assert reglas, "no hay reglas .nav-tab"
        assert not any(re.search(r"transition:\s*all", r) for r in reglas)

    def test_la_barra_queda_por_encima_del_fondo_y_el_boton_por_encima_de_la_barra(self):
        z = lambda sel: int(re.search(r"z-index:(\d+)", regla(sel)).group(1))
        assert z(".menu-backdrop") < z(".nav-tabs") < z(".menu-toggle")

    def test_el_icono_cambia_a_cerrar_cuando_esta_abierto(self):
        assert '.menu-toggle[aria-expanded="true"] .ic-close{display:block}' in CSS
        assert '.menu-toggle[aria-expanded="true"] .ic-menu' in CSS

    def test_el_boton_tiene_foco_visible(self):
        assert ".menu-toggle:focus-visible" in CSS

    def test_las_rejillas_colapsan_cuando_el_contenido_mide_900_o_menos(self):
        """El contenido mide el ancho de la ventana menos los 248 px de la barra: 900 + 248 = 1148."""
        tablet = bloque_media("max-width:1148px")
        assert ".grid-2,.grid-3{grid-template-columns:1fr}" in tablet
        assert ".grid-4{grid-template-columns:repeat(2,1fr)}" in tablet
        assert "@media(max-width:900px){.grid-2" not in CSS
        # y el bloque grande de reglas de tablet (títulos, filtros, gráficos) sube con ellas
        assert ".hero h1{font-size:clamp(2rem,5vw,3rem)}" in tablet
        assert ".filter-bar{flex-direction:column" in tablet

    def test_el_boton_no_tapa_el_inicio_de_la_pagina(self):
        assert ".app{padding-top:56px}" in bloque_media("max-width:900px")
        assert ".app{padding:56px 14px 60px}" in bloque_media("max-width:640px")

    def test_movimiento_reducido_sin_transicion(self):
        assert ".nav-tabs,.nav-tabs.open{transition:none}" in bloque_media("prefers-reduced-motion:reduce")

    def test_la_barra_no_desborda_en_horizontal(self):
        assert "overflow-x:hidden" in regla(".nav-tabs")
