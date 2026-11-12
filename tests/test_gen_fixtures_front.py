"""Funciones puras del generador de fixtures del front (spec frontend-react, T008)."""
import copy
import os
import sys
from datetime import date, timedelta

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

    def test_los_id_no_se_repiten_con_los_id_reales_de_la_base_sembrada(self):
        sembrada = [{"id": str(i), "fecha": "2019-01-01", "cat": "gordito", "primero": "1111", "segundo": "11", "tercero": "22"}
                    for i in range(1, 601)]
        ids = [s["id"] for s in gen.duplicar_hacia_atras(sembrada)]
        assert len(ids) == 1200 and len(set(ids)) == 1200


class TestDesplazarFechas:
    def test_mueve_todas_las_fechas_los_dias_indicados(self):
        r = gen.desplazar_fechas(SORTEOS, 10)
        assert [s["fecha"] for s in r] == ["2026-01-14", "2026-01-13", "2026-01-12", "2026-01-11"]

    def test_acepta_dias_negativos_y_cruza_meses_y_anios(self):
        r = gen.desplazar_fechas(SORTEOS, -4)
        assert [s["fecha"] for s in r] == ["2025-12-31", "2025-12-30", "2025-12-29", "2025-12-28"]

    def test_no_cambia_ids_categorias_ni_premios(self):
        r = gen.desplazar_fechas(SORTEOS, 30)
        for original, nuevo in zip(SORTEOS, r):
            assert {k: v for k, v in nuevo.items() if k != "fecha"} == {k: v for k, v in original.items() if k != "fecha"}

    def test_no_modifica_la_lista_original(self):
        copia = copy.deepcopy(SORTEOS)
        gen.desplazar_fechas(SORTEOS, 5)
        assert SORTEOS == copia


class TestGenerarRespetaLaGuarda:
    """`generar` debe consultar el `contar` que se le inyecta y abortar antes de tocar la aplicación o escribir."""

    @staticmethod
    def _contador(valor):
        llamadas = []

        def contar():
            llamadas.append(1)
            return valor
        return contar, llamadas

    def test_con_una_base_real_aborta_antes_de_escribir_nada(self, tmp_path):
        contar, llamadas = self._contador(9296)
        with pytest.raises(SystemExit) as error:
            gen.generar(destino=str(tmp_path), contar=contar)
        assert llamadas == [1]
        assert "9296" in str(error.value)
        assert list(tmp_path.iterdir()) == []

    def test_con_una_base_vacia_tambien_aborta(self, tmp_path):
        contar, llamadas = self._contador(0)
        with pytest.raises(SystemExit):
            gen.generar(destino=str(tmp_path), contar=contar)
        assert llamadas == [1]
        assert list(tmp_path.iterdir()) == []


class TestRelojFijo:
    def test_llevar_al_presente_deja_el_sorteo_mas_nuevo_tres_dias_antes_del_hoy_fijo(self):
        r = gen.llevar_al_presente(SORTEOS)
        assert max(s["fecha"] for s in r) == (gen.HOY_FIJO - timedelta(days=3)).isoformat()

    def test_conserva_el_orden_y_las_distancias_entre_sorteos(self):
        r = gen.llevar_al_presente(SORTEOS)
        assert [s["id"] for s in r] == [s["id"] for s in SORTEOS]
        assert (date.fromisoformat(r[0]["fecha"]) - date.fromisoformat(r[3]["fecha"])).days == 3

    def test_no_depende_de_que_el_primero_sea_el_mas_nuevo(self):
        al_reves = list(reversed(SORTEOS))
        assert max(s["fecha"] for s in gen.llevar_al_presente(al_reves)) == (gen.HOY_FIJO - timedelta(days=3)).isoformat()

    def test_reloj_fijo_pasa_hoy_y_ahora_fijos_a_registrar_y_lo_restaura(self, monkeypatch):
        import seguimiento
        llamadas = []

        def falso(session, sorteos, recos, hoy=None, ahora=None):
            llamadas.append((hoy, ahora))
            return ["hecho"]
        monkeypatch.setattr(seguimiento, "registrar", falso)
        with gen._reloj_fijo():
            assert seguimiento.registrar(None, [], {}) == ["hecho"]
        assert llamadas == [(gen.HOY_FIJO, gen.AHORA_FIJO)]
        assert seguimiento.registrar is falso


class TestGuardaAntesDeImportarLaApp:
    def test_con_base_real_aborta_sin_haber_importado_la_aplicacion(self, tmp_path, monkeypatch):
        monkeypatch.setitem(sys.modules, "app", None)          # importar `app` fallaría con ImportError
        with pytest.raises(SystemExit):
            gen.generar(destino=str(tmp_path), contar=lambda: 9296)

    def test_con_la_base_sembrada_la_guarda_deja_pasar_y_sigue_hasta_importar_la_aplicacion(self, tmp_path, monkeypatch):
        monkeypatch.setitem(sys.modules, "app", None)
        with pytest.raises(ImportError):
            gen.generar(destino=str(tmp_path), contar=lambda: 600)
        assert list(tmp_path.iterdir()) == []


class TestFijarValoresVolatiles:
    def test_fija_la_fecha_de_entrenamiento_del_modelo(self):
        r = gen.fijar_valores_volatiles({"ml_info": {"train_date": "2026-11-11 11:52", "otros": 1}})
        assert r["ml_info"] == {"train_date": "2026-01-15 12:00", "otros": 1}

    def test_no_toca_respuestas_sin_ml_info_ni_otros_valores(self):
        cuerpo = {"data": [1, 2], "total": 2, "ml_info": {"sin_fecha": True}}
        assert gen.fijar_valores_volatiles(cuerpo) == cuerpo

    def test_no_modifica_el_original(self):
        original = {"ml_info": {"train_date": "2026-11-11 11:52"}}
        gen.fijar_valores_volatiles(original)
        assert original["ml_info"]["train_date"] == "2026-11-11 11:52"


class TestRelojFijoCompleto:
    def test_fija_el_hoy_de_estadisticas_que_decide_el_mes_objetivo(self):
        import estadisticas
        with gen._reloj_fijo():
            assert estadisticas._dt.date.today() == gen.HOY_FIJO
            hoy = estadisticas._dt.date.today()
            assert (hoy.year, hoy.month, hoy.day) == (2026, 1, 15)

    def test_restaura_estadisticas_y_seguimiento_aunque_falle_el_cuerpo(self, monkeypatch):
        import estadisticas
        import seguimiento
        dt_original, registrar_original = estadisticas._dt, seguimiento.registrar
        with pytest.raises(RuntimeError):
            with gen._reloj_fijo():
                assert estadisticas._dt is not dt_original and seguimiento.registrar is not registrar_original
                raise RuntimeError("fallo en el cuerpo")
        assert estadisticas._dt is dt_original
        assert seguimiento.registrar is registrar_original

    def test_la_fecha_falsa_de_estadisticas_sigue_comportandose_como_date(self):
        import estadisticas
        with gen._reloj_fijo():
            assert estadisticas._dt.date(2026, 3, 4).month == 3
            assert estadisticas._dt.date.fromisoformat("2019-10-02").year == 2019


class TestFijarValoresVolatilesSoloTextos:
    @pytest.mark.parametrize("valor", [None, 5, {"x": 1}, ["a"]])
    def test_si_la_fecha_ya_no_es_un_texto_se_deja_a_la_vista(self, valor):
        r = gen.fijar_valores_volatiles({"ml_info": {"train_date": valor}})
        assert r["ml_info"]["train_date"] == valor


class TestGuardarAplicaLaNormalizacion:
    def test_el_archivo_escrito_lleva_la_fecha_de_entrenamiento_fija(self, tmp_path):
        import json
        ruta = gen._guardar(str(tmp_path), "x", {"ml_info": {"train_date": "2031-07-07 09:09"}, "lista": list(range(40))})
        guardado = json.load(open(ruta, encoding="utf-8"))
        assert guardado["ml_info"]["train_date"] == "2026-01-15 12:00"
        assert len(guardado["lista"]) == gen.MAX_ELEMENTOS


class TestConNumerosRepetidos:
    @staticmethod
    def _sembrada(n=600):
        return [{"id": str(n - i), "fecha": "2019-01-01", "cat": "gordito", "primero": f"{(i * 7) % 10000:04d}",
                 "segundo": "11", "tercero": "22"} for i in range(n)]

    def test_un_numero_reciente_y_otro_lejano_salen_cada_uno_diez_veces(self):
        r = gen.con_numeros_repetidos(self._sembrada())
        primeros = [s["primero"] for s in r]
        assert primeros.count("1111") >= 10 and primeros.count("2222") >= 10

    def test_el_reciente_esta_entre_los_primeros_y_el_lejano_entre_los_antiguos(self):
        r = gen.con_numeros_repetidos(self._sembrada())
        indices_1111 = [i for i, s in enumerate(r) if s["primero"] == "1111"]
        indices_2222 = [i for i, s in enumerate(r) if s["primero"] == "2222"]
        assert max(indices_1111) < 100 and min(indices_2222) >= 250

    def test_no_cambia_el_numero_de_sorteos_ni_sus_ids(self):
        original = self._sembrada()
        r = gen.con_numeros_repetidos(original)
        assert [s["id"] for s in r] == [s["id"] for s in original]

    def test_no_modifica_la_lista_original(self):
        original = self._sembrada()
        copia = copy.deepcopy(original)
        gen.con_numeros_repetidos(original)
        assert original == copia


class TestSoloPrimerosPremiosDe4Cifras:
    def test_el_segundo_y_el_tercero_quedan_de_dos_cifras_en_todas_las_categorias(self):
        r = gen.solo_primeros_premios_de_4_cifras(SORTEOS)
        assert [(s["segundo"], s["tercero"]) for s in r] == [("78", "12"), ("90", "57"), ("22", "44"), ("02", "03")]

    def test_el_primero_y_lo_demas_no_cambian(self):
        r = gen.solo_primeros_premios_de_4_cifras(SORTEOS)
        for original, nuevo in zip(SORTEOS, r):
            assert {k: v for k, v in nuevo.items() if k not in ("segundo", "tercero")} == \
                   {k: v for k, v in original.items() if k not in ("segundo", "tercero")}

    def test_no_modifica_la_lista_original(self):
        copia = copy.deepcopy(SORTEOS)
        gen.solo_primeros_premios_de_4_cifras(SORTEOS)
        assert SORTEOS == copia
