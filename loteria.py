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
