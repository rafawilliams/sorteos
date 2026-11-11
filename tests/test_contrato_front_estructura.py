"""Pruebas de las funciones que comparan la estructura de dos respuestas JSON."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from contrato_front import aplanar, diferencias


class TestAplanar:
    def test_escalares_con_sus_tipos(self):
        r = aplanar({"a": 1, "b": "x", "c": True, "d": None, "e": 1.5})
        assert r[""] == {"dict"}
        assert r["a"] == {"number"} and r["e"] == {"number"}
        assert r["b"] == {"str"} and r["c"] == {"bool"} and r["d"] == {"null"}

    def test_un_booleano_no_cuenta_como_numero(self):
        assert aplanar({"c": False})["c"] == {"bool"}

    def test_listas_juntan_los_tipos_de_todos_sus_elementos(self):
        r = aplanar({"l": [{"x": 1}, {"x": None, "y": "s"}]})
        assert r["l"] == {"list"} and r["l[]"] == {"dict"}
        assert r["l[].x"] == {"number", "null"} and r["l[].y"] == {"str"}

    def test_una_lista_vacia_no_aporta_hijos(self):
        r = aplanar({"l": []})
        assert r["l"] == {"list"} and not any(k.startswith("l[]") for k in r)

    def test_anidamiento_con_rutas_separadas_por_puntos(self):
        assert aplanar({"a": {"b": {"c": 1}}})["a.b.c"] == {"number"}


class TestDiferenciasEstrictas:
    def test_estructuras_iguales_no_difieren_aunque_cambien_los_valores(self):
        assert diferencias({"a": 1, "l": [{"x": "u"}]}, {"a": 99, "l": [{"x": "otro"}, {"x": "mas"}]}) == []

    def test_entero_y_decimal_son_el_mismo_tipo(self):
        assert diferencias({"a": 1}, {"a": 1.5}) == []

    def test_detecta_una_clave_que_falta_en_la_respuesta(self):
        r = diferencias({"a": 1, "b": 2}, {"a": 1})
        assert len(r) == 1 and "b" in r[0] and "falta" in r[0]

    def test_detecta_una_clave_nueva_sin_fixture(self):
        r = diferencias({"a": 1}, {"a": 1, "nueva": 2})
        assert len(r) == 1 and "nueva" in r[0] and "sin fixture" in r[0]

    def test_detecta_un_tipo_distinto(self):
        r = diferencias({"a": 1}, {"a": "uno"})
        assert len(r) == 1 and "a" in r[0] and "tipo" in r[0]

    def test_un_nulo_donde_se_esperaba_un_objeto_es_una_diferencia(self):
        assert diferencias({"a": {"x": 1}}, {"a": None}) != []

    def test_detecta_diferencias_dentro_de_listas(self):
        assert diferencias({"l": [{"x": 1}]}, {"l": [{"x": 1, "y": 2}]}) != []


class TestDiferenciasTolerantes:
    def test_un_nulo_equivale_a_un_objeto_y_sus_hijos_quedan_ocultos(self):
        assert diferencias({"bt": {"hits": 1, "total": 2}}, {"bt": None}, tolerar_vacios=True) == []
        assert diferencias({"bt": None}, {"bt": {"hits": 1, "total": 2}}, tolerar_vacios=True) == []

    def test_una_lista_vacia_equivale_a_una_con_elementos(self):
        assert diferencias({"l": [{"x": 1}]}, {"l": []}, tolerar_vacios=True) == []
        assert diferencias({"l": []}, {"l": [{"x": 1}]}, tolerar_vacios=True) == []

    def test_sigue_detectando_una_clave_que_falta_fuera_de_las_zonas_ocultas(self):
        r = diferencias({"a": 1, "bt": None}, {"bt": None}, tolerar_vacios=True)
        assert len(r) == 1 and "a" in r[0]

    def test_sigue_detectando_un_tipo_distinto_aunque_se_toleren_vacios(self):
        assert diferencias({"a": 1}, {"a": "uno"}, tolerar_vacios=True) != []

    def test_un_nulo_dentro_de_una_lista_no_es_una_diferencia(self):
        assert diferencias({"l": [{"x": 1}]}, {"l": [{"x": None}]}, tolerar_vacios=True) == []


class TestMapasConClavesDeDatos:
    """Diccionarios cuyas claves son datos (dígitos, terminaciones, fechas, meses, categorías) son mapas."""

    def test_las_claves_numericas_se_agrupan_bajo_un_asterisco(self):
        r = aplanar({"digit_frequency": {"0": 5, "3": 7}})
        assert r["digit_frequency"] == {"dict"} and r["digit_frequency.*"] == {"number"}
        assert not any(k.startswith("digit_frequency.0") for k in r)

    def test_las_terminaciones_con_cero_inicial_tambien(self):
        assert aplanar({"endings": {"00": 1, "07": 2, "99": 3}})["endings.*"] == {"number"}

    def test_las_fechas_y_los_meses_tambien(self):
        assert aplanar({"m": {"2019-10": 1, "2019-11": 2}})["m.*"] == {"number"}
        assert aplanar({"m": {"Sep": 1, "Oct": 2}})["m.*"] == {"number"}
        assert aplanar({"m": {"2019-10-02": 1}})["m.*"] == {"number"}

    def test_las_categorias_y_los_premios_tambien_y_sus_valores_se_unen(self):
        r = aplanar({"by_category": {"dominical": {"x": 1}, "gordito": {"x": 2, "y": "s"}}})
        assert r["by_category.*"] == {"dict"} and r["by_category.*.x"] == {"number"} and r["by_category.*.y"] == {"str"}
        assert aplanar({"prizes": {"primero": 1, "segundo": 2, "tercero": 3}})["prizes.*"] == {"number"}

    def test_un_diccionario_con_alguna_clave_que_no_es_un_dato_no_se_agrupa(self):
        r = aplanar({"id": "1", "primero": "9614", "fecha": "2019-10-02"})
        assert "id" in r and "primero" in r and "fecha" in r and not any(".*" in k or k == "*" for k in r)

    def test_un_diccionario_vacio_sigue_siendo_un_diccionario(self):
        assert aplanar({"a": {}})["a"] == {"dict"}

    def test_dos_mapas_con_distintas_claves_y_la_misma_forma_no_difieren(self):
        assert diferencias({"d": {"0": 1, "1": 2}}, {"d": {"5": 9}}) == []
        assert diferencias({"by_category": {"dominical": {"x": 1}}}, {"by_category": {"gordito": {"x": 2}}}) == []

    def test_un_mapa_cuyos_valores_cambian_de_tipo_si_difiere(self):
        assert diferencias({"d": {"0": 1}}, {"d": {"0": "uno"}}) != []

    def test_una_categoria_que_falta_en_el_mapa_es_tolerable(self):
        assert diferencias({"by_category": {"dominical": {"x": 1}, "extraordinario": {"x": 2}}},
                           {"by_category": {"dominical": {"x": 1}}}) == []


class TestDiccionariosVaciosTolerantes:
    def test_un_diccionario_vacio_equivale_a_uno_con_claves(self):
        assert diferencias({"ml": {"a": 1, "b": "x"}}, {"ml": {}}, tolerar_vacios=True) == []
        assert diferencias({"ml": {}}, {"ml": {"a": 1}}, tolerar_vacios=True) == []

    def test_en_modo_estricto_un_diccionario_vacio_si_difiere(self):
        assert diferencias({"ml": {"a": 1}}, {"ml": {}}) != []
