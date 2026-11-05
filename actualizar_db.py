"""
Actualizar base de datos con sorteos desde la API.
Consulta los meses desde el último sorteo guardado hasta hoy e inserta solo los que no existen.

Uso:  python actualizar_db.py [--desde YYYY-MM]
"""

import requests
from collections import defaultdict
from datetime import date
from base import Session, engine, Base, api_credentials
from loteria import Loteria, premio_en_formato

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def get_token():
    url = "https://api.loteriapanama.net/v1/auth/"
    headers = {
        "Content-type": "application/x-www-form-urlencoded",
        "Accept": "text/plain",
        "User-Agent": UA,
    }
    resp = requests.post(url, data=api_credentials(), headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def buscar_por_mes(token, year, month):
    """Busca sorteos por año y mes usando el endpoint de búsqueda."""
    url = f"https://api.loteriapanama.net/v1/sorteos/?c=todos&t=search&y={year}&m={month}&p=0"
    headers = {
        "Xsrf-Token": token["token"],
        "withCredentials": "true",
        "Authorization": f"Bearer {token['token']}",
        "Content-type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain",
        "User-Agent": UA,
    }
    resp = requests.post(url, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json().get("data", [])


def meses_a_consultar(desde, hasta):
    """(año, mes) from the month of `desde` to the month of `hasta`, both included."""
    meses = []
    y, m = desde.year, desde.month
    while (y, m) <= (hasta.year, hasta.month):
        meses.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return meses


# Same draw under another name: the API now returns the Dec-2023 "zodiaco" draws as "gordito"
# (Gordito del Zodíaco). Only used to compare keys; stored categories are not changed.
ALIAS_CATEGORIA = {"zodiaco": "gordito"}


def clave_sorteo(fecha, cat, primero):
    """Identity of a draw: fecha + categoría + 1er premio in its real format.

    The 1st prize is part of the key because two real draws can share date and category
    (e.g. 2002-12-29 dominical), and the DB has no API id to tell them apart.
    """
    fecha = fecha.isoformat() if hasattr(fecha, "isoformat") else (fecha or "")
    cat = (cat or "").strip().lower()
    cat = ALIAS_CATEGORIA.get(cat, cat)
    return (fecha, cat, premio_en_formato(cat, fecha, "primero", primero))


def _clave(fila):
    return clave_sorteo(fila.get("fecha"), fila.get("cat"), fila.get("primero"))


def filtrar_nuevos(data, existentes, hasta):
    """Rows not already stored (by fecha+categoría+1er premio), with a date, not after `hasta`."""
    limite = hasta.isoformat()
    vistos = set(existentes)
    nuevos = []
    for fila in data:
        clave = _clave(fila)
        if not clave[0] or clave[0] > limite or clave in vistos:
            continue
        vistos.add(clave)
        nuevos.append(fila)
    return nuevos


VENTANA_SOSPECHOSOS = 7      # days: a re-dated draw or a cross-category copy shows up within a week


def _huella(fila):
    """(fecha, categoría, (1º, 2º, 3º)) in real format; None without a date or with an empty prize."""
    fecha = fila.get("fecha")
    fecha = fecha.isoformat() if hasattr(fecha, "isoformat") else (fecha or "")
    cat = (fila.get("cat") or "").strip().lower()
    cat = ALIAS_CATEGORIA.get(cat, cat)
    premios = tuple(premio_en_formato(cat, fecha, p, fila.get(p)) for p in ("primero", "segundo", "tercero"))
    if not fecha or not all(premios):
        return None
    return date.fromisoformat(fecha), cat, premios


def descartar_sospechosos(nuevos, guardados, ventana=VENTANA_SOSPECHOSOS):
    """Drop new rows whose three prizes repeat a draw (stored or accepted) within `ventana` days.

    Same category → "fecha corregida" (the API re-dated a draw already stored).
    Other category → "copia de otra categoría" (the API copied another draw's prizes).
    New rows go oldest first, so the original stays. Rows without a date or with an empty prize
    are never compared. Returns (valid rows, [(row, reason, matched row)]).
    """
    vistos = defaultdict(list)                  # prizes → [(huella, row)]: O(1) lookup per new row
    for f in guardados:
        if h := _huella(f):
            vistos[h[2]].append((h, f))
    huellas = [(_huella(f), f) for f in nuevos]
    orden = sorted(range(len(nuevos)), key=lambda i: huellas[i][0][0] if huellas[i][0] else date.max)
    aceptados, descartados = set(), []
    for i in orden:
        h, fila = huellas[i]
        if h is None:
            aceptados.add(i)
            continue
        igual = next(((hv, fv) for hv, fv in vistos[h[2]] if abs((hv[0] - h[0]).days) <= ventana), None)
        if igual:
            motivo = "fecha corregida" if igual[0][1] == h[1] else "copia de otra categoría"
            descartados.append((fila, motivo, igual[1]))
            continue
        aceptados.add(i)
        vistos[h[2]].append((h, fila))
    return [f for i, f in enumerate(nuevos) if i in aceptados], descartados


def fila_a_loteria(fila):
    """API row → Loteria, prizes padded to their real format (2, 4 or 5 digits; empty stays empty)."""
    cat, fecha = fila.get("cat", ""), fila.get("fecha", "")
    return Loteria(
        fila.get("cat", ""),
        fila.get("fecha", ""),
        premio_en_formato(cat, fecha, "primero", fila.get("primero")),
        fila.get("letra", ""),
        fila.get("folio", ""),
        fila.get("serie", ""),
        premio_en_formato(cat, fecha, "segundo", fila.get("segundo")),
        premio_en_formato(cat, fecha, "tercero", fila.get("tercero")),
    )


def actualizar(desde=None):
    """Sync draws from the month of the last stored draw (or `desde`) up to today."""
    Base.metadata.create_all(engine)
    session = Session()
    hoy = date.today()

    # Claves de los sorteos guardados, para no duplicarlos (la DB usa IDs propios)
    existentes = set()
    guardados = []
    ultima = None
    for r in session.query(Loteria.fecha, Loteria.tipo, Loteria.primero, Loteria.segundo,
                           Loteria.tercero).all():
        existentes.add(clave_sorteo(r.fecha, r.tipo, r.primero))
        guardados.append({"fecha": r.fecha, "cat": r.tipo, "primero": r.primero,
                          "segundo": r.segundo, "tercero": r.tercero})
        if r.fecha and (ultima is None or r.fecha > ultima):
            ultima = r.fecha
    print(f"Sorteos existentes en DB: {len(existentes)} (último: {ultima or 'ninguno'})")

    if desde is None:
        desde = ultima or hoy
    meses = meses_a_consultar(desde, hoy)
    print(f"Meses a consultar: {', '.join(f'{y}-{m:02d}' for y, m in meses)}")

    token = get_token()
    print("Token obtenido correctamente.")

    data = []
    for year, month in meses:
        print(f"\nBuscando sorteos de {year}-{month:02d}...")
        filas = buscar_por_mes(token, year, month)
        print(f"  Encontrados en API: {len(filas)}")
        data.extend(filas)

    nuevos, descartados = descartar_sospechosos(filtrar_nuevos(data, existentes, hoy), guardados)
    for fila, motivo, igual in descartados:
        print(f"  AVISO: descartado {fila.get('fecha')} | {fila.get('cat')} | "
              f"{fila.get('primero')} {fila.get('segundo')} {fila.get('tercero')} — {motivo} "
              f"(igual que {igual.get('fecha')} | {igual.get('cat')})")
    print(f"\nSorteos nuevos a insertar: {len(nuevos)}")

    insertados = 0
    for fila in nuevos:
        try:
            sorteo = fila_a_loteria(fila)
            session.add(sorteo)
            session.commit()
            insertados += 1
            print(f"  + {fila['fecha']} | {sorteo.tipo} | 1ro: {sorteo.primero} | 2do: {sorteo.segundo} | 3ro: {sorteo.tercero}")
        except Exception as e:
            session.rollback()
            print(f"  ERROR insertando {fila}: {e}")

    session.close()
    print(f"\nActualización completada: {insertados} sorteos insertados.")
    return insertados


def registrar_seguimiento():
    """Compute stats so Seguimiento freezes the recommendations for each category's next draw."""
    import app  # heavy (loads the ML model): only when there is something to freeze
    _, hechos = app._calcular_stats()
    return hechos


def main(argv=None):
    import argparse
    from datetime import datetime

    parser = argparse.ArgumentParser(description="Sincroniza sorteos nuevos desde api.loteriapanama.net")
    parser.add_argument("--desde", help="Mes inicial YYYY-MM (por defecto: el del último sorteo guardado)")
    parser.add_argument("--sin-seguimiento", action="store_true",
                        help="No congelar las recomendaciones de Seguimiento tras sincronizar")
    args = parser.parse_args(argv)
    insertados = actualizar(datetime.strptime(args.desde, "%Y-%m").date() if args.desde else None)
    if insertados and not args.sin_seguimiento:
        print("\nSeguimiento: congelando las recomendaciones para los próximos sorteos...")
        try:
            hechos = registrar_seguimiento()
            print(f"Seguimiento: registradas para {', '.join(hechos) if hechos else 'ninguna categoría nueva'}.")
        except Exception as e:  # the sync itself already succeeded
            print(f"Seguimiento: no se pudieron registrar las recomendaciones ({type(e).__name__}).")


if __name__ == "__main__":
    main()
