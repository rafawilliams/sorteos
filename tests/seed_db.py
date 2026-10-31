"""Seed an EMPTY database with deterministic synthetic draws, for CI.

Usage:  python tests/seed_db.py [n_draws]
Refuses to run if the `sorteos` table already has rows, so it never touches real data.
"""
import os
import random
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from base import Base, Session, engine
from loteria import Loteria

CATEGORIAS = ["dominical", "miercolito", "gordito", "extraordinario"]


def seed(n_draws=600):
    Base.metadata.create_all(engine)
    session = Session()
    try:
        if session.query(Loteria).count():
            raise SystemExit("La tabla sorteos ya tiene datos: no se siembra (solo para BD vacía de CI).")
        rng = random.Random(42)
        start = date(2014, 1, 5)
        for i in range(n_draws):
            num = lambda: f"{rng.randrange(10000):04d}"
            session.add(Loteria(
                tipo=CATEGORIAS[i % len(CATEGORIAS)],
                fecha=start + timedelta(days=7 * (i // 2) + 3 * (i % 2)),
                primero=num(), segundo=num(), tercero=num(),
                letras="ABCD", folio=str(i), serie=str(rng.randrange(1, 30)),
            ))
        session.commit()
        print(f"Sembrados {n_draws} sorteos sintéticos.")
    finally:
        session.close()


if __name__ == "__main__":
    seed(int(sys.argv[1]) if len(sys.argv) > 1 else 600)
