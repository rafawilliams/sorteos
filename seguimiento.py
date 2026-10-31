"""
Seguimiento de recomendaciones (spec: 02-DOCS/wiki/sdd/specs/seguimiento-recomendaciones.md).

Before each draw of a category, the first computed recommendations (top-5 numbers and 10 endings
per method) are frozen in the `predicciones` table. When the draw arrives they are compared with
the real result. A "combinada" method mixes ML and statistical, weighted by their recent mean of
digits matched in position.

Draws are the dicts returned by app.get_sorteos(): {"id": "12", "fecha": "YYYY-MM-DD", "cat": ...,
"primero"/"segundo"/"tercero": prize in its real format}.
"""

import json
from collections import defaultdict
from datetime import date, datetime, timedelta
from math import comb

from sqlalchemy import Column, Date, DateTime, Float, Integer, String, Text

from base import Base

PREMIOS = ("primero", "segundo", "tercero")
METODOS = ("ml", "estadistico", "combinada")
N_NUMEROS = 5
N_TERMINACIONES = 10
VENTANA_PESO = 20          # recent compared draws used for the weight
MINIMO_PESO = 10           # below this, 50/50
DIAS_CATEGORIA_ACTIVA = 365


class Prediccion(Base):
    __tablename__ = "predicciones"
    id = Column(Integer, primary_key=True)
    categoria = Column(String(100), nullable=False, index=True)
    ultima_fecha = Column(Date, nullable=False)      # last draw of the category when recorded
    ultimo_id = Column(Integer, nullable=False)      # max sorteos.id when recorded
    metodo = Column(String(20), nullable=False)
    numeros = Column(Text, nullable=False)           # JSON list (top-5)
    terminaciones = Column(Text, nullable=False)     # JSON list (10)
    peso_ml = Column(Float)                          # weight used for "combinada"
    creado_en = Column(DateTime, nullable=False)

    def lista_numeros(self):
        return json.loads(self.numeros)

    def lista_terminaciones(self):
        return json.loads(self.terminaciones)


# ---------------------------------------------------------------------------
# Pure functions
# ---------------------------------------------------------------------------

def _premios_4(sorteo):
    return [sorteo[p] for p in PREMIOS if len(sorteo.get(p) or "") == 4]


def _terminaciones_premios(sorteo):
    return {sorteo[p][-2:] for p in PREMIOS if len(sorteo.get(p) or "") >= 2}


def digitos_en_posicion(numero, premio):
    """Digits of `numero` equal to `premio` in the same position (4-digit only, else 0)."""
    if len(numero) != 4 or len(premio) != 4:
        return 0
    return sum(a == b for a, b in zip(numero, premio))


def comparar(numeros, terminaciones, sorteo):
    """Metrics of one method's frozen recommendation against a real draw."""
    p4 = _premios_4(sorteo)
    ends = _terminaciones_premios(sorteo)
    digitos = [digitos_en_posicion(n, p) for n in numeros for p in p4]
    acertadas = [t for t in terminaciones if t in ends]
    return {
        "exactos": sum(n in p4 for n in numeros),
        "numeros_acertados": [n for n in numeros if n in p4],
        "terminacion_numeros": sum(n[-2:] in ends for n in numeros),
        "digitos_media": sum(digitos) / len(digitos) if digitos else None,
        "terminaciones_aciertos": len(acertadas),
        "terminaciones_acertadas": acertadas,
        "alguna_terminacion": bool(acertadas),
    }


def azar(sorteo, n_numeros=N_NUMEROS, n_terminaciones=N_TERMINACIONES):
    """Expected value of each metric for uniformly random picks against this draw."""
    k = len(_premios_4(sorteo))
    d = len(_terminaciones_premios(sorteo))
    return {
        "exactos": n_numeros * k / 10000,
        "terminacion_numeros": n_numeros * d / 100,
        "digitos_media": 0.4 if k else None,
        "terminaciones_aciertos": n_terminaciones * d / 100,
        "alguna_terminacion": 1 - comb(100 - d, n_terminaciones) / comb(100, n_terminaciones),
    }


def peso_ml(historial):
    """ML weight for "combinada": proportional to the mean digits-in-position of each method over the
    last VENTANA_PESO compared draws (`historial` most recent first). 0.5 with fewer than MINIMO_PESO."""
    validos = [h for h in historial if h.get("ml") is not None and h.get("estadistico") is not None]
    validos = validos[:VENTANA_PESO]
    if len(validos) < MINIMO_PESO:
        return 0.5
    m_ml = sum(h["ml"] for h in validos) / len(validos)
    m_est = sum(h["estadistico"] for h in validos) / len(validos)
    return m_ml / (m_ml + m_est) if (m_ml + m_est) > 0 else 0.5


def combinar(lista_ml, lista_est, peso, n):
    """Merge two ranked lists: score = peso·rank_ml + (1−peso)·rank_est, rank = (len−i)/len."""
    puntos = defaultdict(float)
    orden = []
    for lista, w in ((lista_ml, peso), (lista_est, 1 - peso)):
        for i, x in enumerate(lista):
            puntos[x] += w * (len(lista) - i) / len(lista)
            if x not in orden:
                orden.append(x)
    return sorted(orden, key=lambda x: (-puntos[x], orden.index(x)))[:n]


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _ensure_table(session):
    Prediccion.__table__.create(session.get_bind(), checkfirst=True)


def objetivo(registro, sorteos_cat):
    """The draw a record was made for: first draw of its category (by fecha, id) added after it."""
    limite = registro.ultima_fecha.isoformat()
    candidatos = [s for s in sorteos_cat
                  if int(s["id"]) > registro.ultimo_id and s.get("fecha", "") >= limite]
    return min(candidatos, key=lambda s: (s["fecha"], int(s["id"]))) if candidatos else None


def _grupos(session):
    """Records grouped per (categoria, ultima_fecha, ultimo_id) → {metodo: Prediccion}."""
    grupos = defaultdict(dict)
    for r in session.query(Prediccion).order_by(Prediccion.id).all():
        grupos[(r.categoria, r.ultima_fecha, r.ultimo_id)][r.metodo] = r
    return grupos


def _por_categoria(sorteos):
    cats = defaultdict(list)
    for s in sorteos:
        cats[s.get("cat", "")].append(s)
    return cats


def _evaluar(grupos, sorteos):
    """Split record groups into compared (with metrics) and pending; most recent compared first."""
    cats = _por_categoria(sorteos)
    comparados, pendientes = [], []
    for (cat, _, _), metodos in grupos.items():
        uno = next(iter(metodos.values()))
        obj = objetivo(uno, cats.get(cat, []))
        base = {
            "categoria": cat,
            "registrado_en": uno.creado_en.isoformat(timespec="minutes"),
            "peso_ml": metodos["combinada"].peso_ml if "combinada" in metodos else None,
        }
        if obj is None:
            base["metodos"] = {m: {"numeros": r.lista_numeros(), "terminaciones": r.lista_terminaciones()}
                               for m, r in metodos.items()}
            pendientes.append(base)
            continue
        base["sorteo"] = obj
        base["azar"] = azar(obj)
        base["metodos"] = {}
        for m, r in metodos.items():
            nums, ends = r.lista_numeros(), r.lista_terminaciones()
            base["metodos"][m] = {"numeros": nums, "terminaciones": ends, **comparar(nums, ends, obj)}
        comparados.append(base)
    comparados.sort(key=lambda c: (c["sorteo"]["fecha"], int(c["sorteo"]["id"])), reverse=True)
    return comparados, pendientes


def _historial(comparados):
    return [{m: c["metodos"].get(m, {}).get("digitos_media") for m in ("ml", "estadistico")}
            for c in comparados]


def registrar(session, sorteos, recos, hoy=None, ahora=None):
    """Freeze recommendations for the next draw of each category that has none pending.

    recos: {cat: {"ml": {"numeros": [...], "terminaciones": [...]} | None, "estadistico": {...}}}.
    Returns the categories recorded now.
    """
    hoy = hoy or date.today()
    ahora = ahora or datetime.now()
    _ensure_table(session)
    if not sorteos:
        return []
    max_id = max(int(s["id"]) for s in sorteos)
    cats = _por_categoria(sorteos)
    grupos = _grupos(session)
    comparados, pendientes = _evaluar(grupos, sorteos)
    pendientes_cat = {p["categoria"] for p in pendientes}
    peso = peso_ml(_historial(comparados))

    hechos = []
    for cat, r in recos.items():
        cat_sorteos = cats.get(cat, [])
        if not cat_sorteos or cat in pendientes_cat or not r or not r.get("estadistico"):
            continue
        ultima = max(s["fecha"] for s in cat_sorteos)
        if date.fromisoformat(ultima) < hoy - timedelta(days=DIAS_CATEGORIA_ACTIVA):
            continue
        est, ml = r["estadistico"], r.get("ml")
        p = peso if ml else 0.0
        filas = {"estadistico": est}
        if ml:
            filas["ml"] = ml
        filas["combinada"] = {
            "numeros": combinar(ml["numeros"] if ml else [], est["numeros"], p, N_NUMEROS),
            "terminaciones": combinar(ml["terminaciones"] if ml else [], est["terminaciones"], p,
                                      N_TERMINACIONES),
        }
        for metodo, datos in filas.items():
            session.add(Prediccion(
                categoria=cat, ultima_fecha=date.fromisoformat(ultima), ultimo_id=max_id,
                metodo=metodo,
                numeros=json.dumps(list(datos["numeros"])[:N_NUMEROS]),
                terminaciones=json.dumps(list(datos["terminaciones"])[:N_TERMINACIONES]),
                peso_ml=p if metodo == "combinada" else None,
                creado_en=ahora,
            ))
        hechos.append(cat)
    session.commit()
    return hechos


def resumen(session, sorteos):
    """Everything the "Seguimiento" tab shows."""
    _ensure_table(session)
    grupos = _grupos(session)
    comparados, pendientes = _evaluar(grupos, sorteos)

    # Draws inside the tracking period of a category that no record targeted.
    objetivos = {c["sorteo"]["id"] for c in comparados}
    inicio = {}
    for (cat, ultima_fecha, ultimo_id) in grupos:
        if cat not in inicio or ultimo_id < inicio[cat][1]:
            inicio[cat] = (ultima_fecha.isoformat(), ultimo_id)
    sin_registro = sorted(
        (s for s in sorteos
         if s.get("cat") in inicio and s["id"] not in objetivos
         and int(s["id"]) > inicio[s["cat"]][1] and s.get("fecha", "") >= inicio[s["cat"]][0]),
        key=lambda s: (s["fecha"], int(s["id"])), reverse=True)

    marcador = {}
    for m in METODOS:
        filas = [(c["metodos"][m], c["azar"]) for c in comparados if m in c["metodos"]]
        dig = [(f["digitos_media"], a["digitos_media"]) for f, a in filas if f["digitos_media"] is not None]
        n = len(filas)
        marcador[m] = {
            "sorteos": n,
            "exactos": sum(f["exactos"] for f, _ in filas),
            "exactos_azar": sum(a["exactos"] for _, a in filas),
            "terminacion_numeros": sum(f["terminacion_numeros"] for f, _ in filas),
            "terminacion_numeros_azar": sum(a["terminacion_numeros"] for _, a in filas),
            "digitos_media": sum(d for d, _ in dig) / len(dig) if dig else None,
            "digitos_media_azar": 0.4,
            "terminaciones_media": sum(f["terminaciones_aciertos"] for f, _ in filas) / n if n else None,
            "terminaciones_media_azar": sum(a["terminaciones_aciertos"] for _, a in filas) / n if n else None,
            "alguna_terminacion_pct": 100 * sum(f["alguna_terminacion"] for f, _ in filas) / n if n else None,
            "alguna_terminacion_pct_azar": 100 * sum(a["alguna_terminacion"] for _, a in filas) / n if n else None,
        }

    historial = _historial(comparados)
    return {
        "peso_ml": peso_ml(historial),
        "comparados_para_peso": min(len([h for h in historial if None not in h.values()]), VENTANA_PESO),
        "minimo_peso": MINIMO_PESO,
        "ventana_peso": VENTANA_PESO,
        "pendientes": sorted(pendientes, key=lambda p: p["categoria"]),
        "comparados": comparados,
        "sin_registro": sin_registro,
        "marcador": marcador,
    }
