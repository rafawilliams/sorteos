"""Menú lateral (decisión del dueño, 2026-11-11): la barra de 14 pestañas pasa a barra lateral y, en pantallas
estrechas, se esconde y la abre un botón con el icono de menú. El comportamiento lo prueba
`frontend/src/store/menu.test.ts` contra `app.js`; aquí se fijan el marcado y las reglas de CSS que lo hacen posible
y que jsdom no puede ver (posición fija, punto de corte, orden de apilamiento).
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLA = (RAIZ / "templates/index.html").read_text(encoding="utf-8")
CSS = (RAIZ / "static/style.css").read_text(encoding="utf-8")

PESTANAS = [
    "predicciones", "decenas", "terminaciones", "resultados", "estadisticas", "tendencias", "analisis",
    "comparador", "gaps", "simulador", "favoritos", "mensual", "precision", "seguimiento",
]


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


class TestMarcado:
    def test_las_14_secciones_siguen_en_la_lista_de_pestanas_vertical(self):
        nav = re.search(r'<nav class="nav-tabs" id="navTabs"([^>]*)>(.*?)</nav>', PLANTILLA, re.S)
        assert nav, "falta <nav id=navTabs>"
        assert 'role="tablist"' in nav.group(1) and 'aria-orientation="vertical"' in nav.group(1)
        assert re.findall(r'data-tab="([a-z]+)"', nav.group(2)) == PESTANAS

    def test_tres_marcas_de_grupo(self):
        grupos = re.findall(r'class="nav-tab nav-tab-group" data-tab="([a-z]+)"', PLANTILLA)
        assert grupos == ["resultados", "comparador", "precision"]

    def test_boton_del_menu_con_icono_y_nombre_accesible(self):
        boton = re.search(r'<button class="menu-toggle"[^>]*>(.*?)</button>', PLANTILLA, re.S)
        assert boton, "falta el botón .menu-toggle"
        etiqueta = re.search(r'<button class="menu-toggle"([^>]*)>', PLANTILLA).group(1)
        assert 'aria-label="Abrir menú de secciones"' in etiqueta
        assert 'aria-expanded="false"' in etiqueta and 'aria-controls="navTabs"' in etiqueta
        assert boton.group(1).count("<svg") == 2 and boton.group(1).count('aria-hidden="true"') == 2

    def test_el_fondo_esta_oculto_y_dentro_de_app(self):
        """Dentro de `.app` (que crea su propio contexto de apilamiento) para que quede POR DEBAJO de la barra."""
        app = PLANTILLA.index('<div class="app">')
        assert PLANTILLA.index('id="menuBackdrop"') > app
        assert re.search(r'id="menuBackdrop" hidden>', PLANTILLA)


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
