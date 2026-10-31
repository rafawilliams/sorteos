"""
Actualizar base de datos con sorteos desde la API.
Busca sorteos de feb y mar 2026 e inserta solo los que no existen.
"""

import requests
from datetime import date
from base import Session, engine, Base, api_credentials
from loteria import Loteria

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


def actualizar():
    Base.metadata.create_all(engine)
    session = Session()

    # Fecha límite: solo insertar sorteos después del último registrado
    fecha_desde = "2026-02-19"
    fecha_hasta = "2026-03-22"

    # Obtener fechas+tipo existentes para detectar duplicados (la DB usa IDs propios)
    existentes = set()
    for r in session.query(Loteria.fecha, Loteria.tipo).all():
        fecha_str = r.fecha.isoformat() if r.fecha else ""
        existentes.add((fecha_str, (r.tipo or "").strip().lower()))
    print(f"Sorteos existentes en DB: {len(existentes)}")

    token = get_token()
    print("Token obtenido correctamente.")

    nuevos = []

    # Buscar febrero y marzo 2026
    for year, month in [(2026, 2), (2026, 3)]:
        print(f"\nBuscando sorteos de {year}-{month:02d}...")
        data = buscar_por_mes(token, year, month)
        print(f"  Encontrados en API: {len(data)}")

        for fila in data:
            sorteo_fecha = fila.get("fecha", "")
            sorteo_cat = fila.get("cat", "").strip().lower()

            # Solo insertar si es posterior al último registrado y hasta la fecha límite
            if sorteo_fecha > fecha_desde and sorteo_fecha <= fecha_hasta:
                if (sorteo_fecha, sorteo_cat) not in existentes:
                    nuevos.append(fila)
                else:
                    print(f"  (ya existe) {sorteo_fecha} | {sorteo_cat}")

    print(f"\nSorteos nuevos a insertar: {len(nuevos)}")

    insertados = 0
    for fila in nuevos:
        try:
            sorteo = Loteria(
                fila.get("cat", ""),
                fila.get("fecha", ""),
                fila.get("primero", ""),
                fila.get("letra", ""),
                fila.get("folio", ""),
                fila.get("serie", ""),
                fila.get("segundo", ""),
                fila.get("tercero", ""),
            )
            session.add(sorteo)
            session.commit()
            insertados += 1
            print(f"  + {fila['fecha']} | {fila.get('cat','')} | 1ro: {fila.get('primero','')} | 2do: {fila.get('segundo','')} | 3ro: {fila.get('tercero','')}")
        except Exception as e:
            session.rollback()
            print(f"  ERROR insertando {fila}: {e}")

    session.close()
    print(f"\nActualización completada: {insertados} sorteos insertados.")


if __name__ == "__main__":
    actualizar()
