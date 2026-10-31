"""
Actualizar base de datos con sorteos desde la API.
Consulta los meses desde el último sorteo guardado hasta hoy e inserta solo los que no existen.

Uso:  python actualizar_db.py [--desde YYYY-MM]
"""

import requests
from datetime import date
from base import Session, engine, Base, api_credentials
from loteria import Loteria, normalizar_premio

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


def _clave(fila):
    return (fila.get("fecha") or "", (fila.get("cat") or "").strip().lower())


def filtrar_nuevos(data, existentes, hasta):
    """Rows not already stored (by fecha+categoría), with a date, not after `hasta`."""
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


def fila_a_loteria(fila):
    """API row → Loteria, with prizes zero-padded to 4 digits (empty stays empty)."""
    return Loteria(
        fila.get("cat", ""),
        fila.get("fecha", ""),
        normalizar_premio(fila.get("primero")),
        fila.get("letra", ""),
        fila.get("folio", ""),
        fila.get("serie", ""),
        normalizar_premio(fila.get("segundo")),
        normalizar_premio(fila.get("tercero")),
    )


def actualizar(desde=None):
    """Sync draws from the month of the last stored draw (or `desde`) up to today."""
    Base.metadata.create_all(engine)
    session = Session()
    hoy = date.today()

    # Obtener fechas+tipo existentes para detectar duplicados (la DB usa IDs propios)
    existentes = set()
    ultima = None
    for r in session.query(Loteria.fecha, Loteria.tipo).all():
        fecha_str = r.fecha.isoformat() if r.fecha else ""
        existentes.add((fecha_str, (r.tipo or "").strip().lower()))
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

    nuevos = filtrar_nuevos(data, existentes, hoy)
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


if __name__ == "__main__":
    import argparse
    from datetime import datetime

    parser = argparse.ArgumentParser(description="Sincroniza sorteos nuevos desde api.loteriapanama.net")
    parser.add_argument("--desde", help="Mes inicial YYYY-MM (por defecto: el del último sorteo guardado)")
    args = parser.parse_args()
    actualizar(datetime.strptime(args.desde, "%Y-%m").date() if args.desde else None)
