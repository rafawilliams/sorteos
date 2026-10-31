from sqlalchemy import Column, String, Integer, Date, Table
from base import Base

class Loteria(Base):
    __tablename__ = 'sorteos'
    id = Column(Integer, primary_key=True)
    tipo = Column(String(length=100))
    fecha = Column(Date)
    letras = Column(String(length=100))
    folio = Column(String(length=100))
    serie = Column(String(length=100))
    primero = Column(String(length=100))
    segundo = Column(String(length=100))
    tercero = Column(String(length=100))

    def __init__(self, tipo, fecha, primero, letras, folio, serie, segundo, tercero):
        self.tipo = tipo
        self.fecha = fecha
        self.primero = primero
        self.letras = letras
        self.folio = folio
        self.serie = serie
        self.segundo = segundo
        self.tercero = tercero


def normalizar_premio(valor):
    """Prize number as a zero-padded 4-digit string; empty/None stays "" (never "0000")."""
    v = "" if valor is None else str(valor).strip()
    return v.zfill(4) if v.isdigit() else v


# Categories whose 2nd/3rd prizes are 2-digit numbers (Gordito del Zodíaco).
CATS_2_CIFRAS_SEGUNDO_TERCERO = {"gordito", "zodiaco"}
# Miercolito drew 2-digit prizes in 1962–1966 (no 4-digit miercolito in that range).
MIERCOLITO_2_CIFRAS_HASTA = 1966


def formato_premio(cat, fecha, premio, valor):
    """Digits of the prize's real format: 2, 4 or 5; 0 when the prize is empty.

    Short values outside the known 2-digit formats are 4-digit numbers that lost their zeros.
    """
    v = "" if valor is None else str(valor).strip()
    if not v:
        return 0
    if len(v) >= 5:
        return 5
    if len(v) <= 2:
        c = (cat or "").strip().lower()
        if c in CATS_2_CIFRAS_SEGUNDO_TERCERO and premio in ("segundo", "tercero"):
            return 2
        if c == "miercolito" and int(str(fecha)[:4] or 0) <= MIERCOLITO_2_CIFRAS_HASTA:
            return 2
    return 4


def premio_en_formato(cat, fecha, premio, valor):
    """Prize zero-padded to its real format ("98", "0074", "05309"); "" when empty."""
    v = "" if valor is None else str(valor).strip()
    n = formato_premio(cat, fecha, premio, v)
    return v.zfill(n) if n and v.isdigit() else v
