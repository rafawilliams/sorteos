"""Servidor fijo de la aplicación: waitress, solo en este equipo y sin depuración.

Uso:  python servir.py

`python app.py` es el servidor de desarrollo de Flask: con FLASK_DEBUG=1 (el .env de desarrollo) arranca el depurador
de Werkzeug, que permite ejecutar código, y muere al cerrar la terminal. Este script es para dejarlo siempre arriba:

- Escucha solo en 127.0.0.1: no es accesible desde otros equipos de la red.
- Apaga FLASK_DEBUG antes de importar la app, aunque el .env lo encienda.
- El puerto es 5000; `LOTERIA_PUERTO` lo cambia (p. ej. 5001 para pruebas junto al servidor fijo).
"""
import os
from importlib import import_module

HOST = "127.0.0.1"
PUERTO_POR_DEFECTO = 5000
HILOS = 4


def puerto():
    """Puerto de LOTERIA_PUERTO (1-65535) o el 5000; un valor inválido falla con un mensaje claro."""
    texto = os.getenv("LOTERIA_PUERTO", str(PUERTO_POR_DEFECTO))
    try:
        valor = int(texto)
    except ValueError:
        valor = 0
    if not 1 <= valor <= 65535:
        raise ValueError(f"LOTERIA_PUERTO debe ser un entero entre 1 y 65535 (recibido: {texto!r}).")
    return valor


def _importar_app():
    return import_module("app").app


def main():
    # Antes de importar la app: Flask lee FLASK_DEBUG al crearla y base.load_dotenv no pisa lo ya definido.
    os.environ["FLASK_DEBUG"] = "0"
    from waitress import serve

    serve(_importar_app(), host=HOST, port=puerto(), threads=HILOS)


if __name__ == "__main__":
    main()
