"""Funciones puras del generador de fixtures del front (spec frontend-react, T008)."""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

import gen_fixtures_front as gen


class TestRecortar:
    def test_recorta_listas_largas_al_maximo(self):
        assert gen.recortar(list(range(100)), 3) == [0, 1, 2]

    def test_recorta_listas_anidadas_en_diccionarios_y_listas(self):
        valor = {"a": {"b": list(range(50))}, "c": [list(range(50)), list(range(2))]}
        assert gen.recortar(valor, 4) == {"a": {"b": [0, 1, 2, 3]}, "c": [[0, 1, 2, 3], [0, 1]]}

    def test_deja_intactas_las_listas_cortas_y_los_escalares(self):
        valor = {"x": [1, 2], "y": "texto", "z": None, "w": 3.5, "v": True}
        assert gen.recortar(valor, 5) == valor

    def test_no_modifica_el_original(self):
        original = {"a": list(range(30))}
        copia = copy.deepcopy(original)
        gen.recortar(original, 3)
        assert original == copia

    def test_el_maximo_por_defecto_es_25(self):
        assert gen.MAX_ELEMENTOS == 25
        assert len(gen.recortar(list(range(100)))) == 25


class TestExigirBaseSembrada:
    def test_acepta_exactamente_600_sorteos(self):
        gen.exigir_base_sembrada(lambda: 600)

    def test_se_niega_con_la_base_real_y_lo_explica(self):
        with pytest.raises(SystemExit) as error:
            gen.exigir_base_sembrada(lambda: 9296)
        mensaje = str(error.value)
        assert "9296" in mensaje and "600" in mensaje and "sembrada" in mensaje

    def test_se_niega_con_una_base_vacia(self):
        with pytest.raises(SystemExit):
            gen.exigir_base_sembrada(lambda: 0)


SORTEOS = [
    {"id": "4", "fecha": "2026-01-04", "cat": "extraordinario", "primero": "1234", "segundo": "5678", "tercero": "9012"},
    {"id": "3", "fecha": "2026-01-03", "cat": "gordito", "primero": "3456", "segundo": "7890", "tercero": "1357"},
    {"id": "2", "fecha": "2026-01-02", "cat": "dominical", "primero": "2468", "segundo": "1122", "tercero": "3344"},
    {"id": "1", "fecha": "2026-01-01", "cat": "miercolito", "primero": "0001", "segundo": "0002", "tercero": "0003"},
]


class TestUltimos:
    def test_devuelve_los_n_primeros_que_son_los_mas_recientes(self):
        assert [s["id"] for s in gen.ultimos(SORTEOS, 2)] == ["4", "3"]

    def test_no_falla_si_pides_mas_de_los_que_hay(self):
        assert len(gen.ultimos(SORTEOS, 10)) == 4


class TestFormatosReales:
    def test_el_extraordinario_pasa_a_cinco_cifras(self):
        r = {s["id"]: s for s in gen.a_formatos_reales(SORTEOS)}
        assert [r["4"][k] for k in ("primero", "segundo", "tercero")] == ["01234", "05678", "09012"]

    def test_el_gordito_conserva_el_primero_y_pasa_el_segundo_y_el_tercero_a_dos_cifras(self):
        r = {s["id"]: s for s in gen.a_formatos_reales(SORTEOS)}
        assert (r["3"]["primero"], r["3"]["segundo"], r["3"]["tercero"]) == ("3456", "90", "57")

    def test_las_demas_categorias_no_cambian(self):
        r = {s["id"]: s for s in gen.a_formatos_reales(SORTEOS)}
        assert r["2"] == SORTEOS[2] and r["1"] == SORTEOS[3]

    def test_no_modifica_la_lista_original(self):
        copia = copy.deepcopy(SORTEOS)
        gen.a_formatos_reales(SORTEOS)
        assert SORTEOS == copia


class TestDuplicarHaciaAtras:
    def test_duplica_la_cantidad_de_sorteos(self):
        assert len(gen.duplicar_hacia_atras(SORTEOS)) == 2 * len(SORTEOS)

    def test_los_originales_van_primero_y_sin_cambios(self):
        r = gen.duplicar_hacia_atras(SORTEOS)
        assert r[:4] == SORTEOS

    def test_las_copias_son_siete_anios_mas_viejas_por_defecto(self):
        r = gen.duplicar_hacia_atras(SORTEOS)
        assert [s["fecha"] for s in r[4:]] == ["2019-01-04", "2019-01-03", "2019-01-02", "2019-01-01"]

    def test_las_copias_conservan_categoria_y_premios(self):
        r = gen.duplicar_hacia_atras(SORTEOS)
        for original, copia in zip(r[:4], r[4:]):
            assert (copia["cat"], copia["primero"], copia["segundo"], copia["tercero"]) == (
                original["cat"], original["primero"], original["segundo"], original["tercero"])

    def test_los_id_no_se_repiten(self):
        ids = [s["id"] for s in gen.duplicar_hacia_atras(SORTEOS)]
        assert len(set(ids)) == len(ids)

    def test_el_29_de_febrero_no_rompe_el_desplazamiento(self):
        bisiesto = [{"id": "9", "fecha": "2024-02-29", "cat": "gordito", "primero": "1111", "segundo": "11", "tercero": "22"}]
        assert gen.duplicar_hacia_atras(bisiesto, 1)[1]["fecha"] == "2023-02-28"

    def test_no_modifica_la_lista_original(self):
        copia = copy.deepcopy(SORTEOS)
        gen.duplicar_hacia_atras(SORTEOS)
        assert SORTEOS == copia
