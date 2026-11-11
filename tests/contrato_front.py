"""Comparación de estructuras JSON para el contrato API ↔ front (spec frontend-react, T009).

Un fixture de `frontend/fixtures/` solo sirve de contrato si su *forma* coincide con la de la API:
las mismas claves en los dos sentidos y el mismo tipo de valor en cada una. Los valores concretos
no importan. `aplanar` reduce un JSON a «ruta → tipos vistos» y `diferencias` compara dos de ellos.

Hay diccionarios cuyas claves son datos y no nombres de campos: frecuencias por dígito (`"0"…"9"`), por
terminación (`"00"…"99"`), por mes (`"2019-10"`, `"Sep"`), por categoría o por premio. Su conjunto de
claves cambia con los sorteos, así que se tratan como mapas: la clave se sustituye por `*` y se
comparan las formas de sus valores (en TypeScript son `Record<string, …>`).
"""
import re

# Un diccionario es un mapa si TODAS sus claves son datos de este tipo.
_CLAVE_DE_DATO = re.compile(
    r"^(\d+|\d{4}-\d{2}(-\d{2})?|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
    r"|dominical|miercolito|gordito|extraordinario|zodiaco|primero|segundo|tercero)$"
)


def _es_mapa(diccionario):
    return bool(diccionario) and all(_CLAVE_DE_DATO.match(str(clave)) for clave in diccionario)


def _tipo(valor):
    if valor is None:
        return "null"
    if isinstance(valor, bool):          # antes que int: en Python True es un int
        return "bool"
    if isinstance(valor, (int, float)):
        return "number"
    if isinstance(valor, str):
        return "str"
    if isinstance(valor, dict):
        return "dict"
    if isinstance(valor, list):
        return "list"
    raise TypeError(f"Valor no JSON: {type(valor).__name__}")


def aplanar(valor, ruta="", acumulado=None):
    """Mapa `ruta -> {tipos}`. Hijos de lista: `ruta[]`; claves de un mapa de datos: `ruta.*`; la raíz es `""`."""
    if acumulado is None:
        acumulado = {}
    acumulado.setdefault(ruta, set()).add(_tipo(valor))
    if isinstance(valor, dict):
        mapa = _es_mapa(valor)
        for clave, hijo in valor.items():
            nombre = "*" if mapa else clave
            aplanar(hijo, f"{ruta}.{nombre}" if ruta else nombre, acumulado)
    elif isinstance(valor, list):
        for hijo in valor:
            aplanar(hijo, ruta + "[]", acumulado)
    return acumulado


def _oculta(ruta, documento):
    """¿Algún ancestro de `ruta` es nulo, una lista vacía o un diccionario vacío en `documento`?"""
    for ancestro, tipos in documento.items():
        if ancestro == ruta or not ruta.startswith(ancestro):
            continue
        if ruta[len(ancestro)] not in ".[":
            continue
        if tipos == {"null"}:
            return True
        if tipos == {"list"} and not any(k.startswith(ancestro + "[]") for k in documento):
            return True
        if tipos == {"dict"} and not any(k.startswith(ancestro + ".") for k in documento):
            return True
    return False


def diferencias(esperado, actual, tolerar_vacios=False):
    """Lista legible de diferencias de estructura entre `esperado` (fixture) y `actual` (respuesta).

    Con `tolerar_vacios`, un nulo vale por cualquier tipo y una lista vacía por una con elementos:
    sirve para comparar una variante con nulos contra el fixture principal.
    """
    a, b = aplanar(esperado), aplanar(actual)
    resultado = []
    for ruta in sorted(set(a) | set(b)):
        nombre = ruta or "(raíz)"
        if ruta in a and ruta not in b:
            if not (tolerar_vacios and _oculta(ruta, b)):
                resultado.append(f"falta en la respuesta: {nombre}")
        elif ruta in b and ruta not in a:
            if not (tolerar_vacios and _oculta(ruta, a)):
                resultado.append(f"campo nuevo sin fixture: {nombre}")
        else:
            tipos_a, tipos_b = a[ruta], b[ruta]
            if tolerar_vacios:
                tipos_a, tipos_b = tipos_a - {"null"}, tipos_b - {"null"}
                if not tipos_a or not tipos_b:
                    continue
            if tipos_a != tipos_b:
                resultado.append(f"tipo distinto en {nombre}: fixture {sorted(a[ruta])} / respuesta {sorted(b[ruta])}")
    return resultado
