import requests
from base import Session, engine, Base, api_credentials
from loteria import Loteria


def get_token():
    URLAUTH = 'https://api.loteriapanama.net/v1/auth/'
    agent = {'Content-type': 'application/x-www-form-urlencoded','Accept': 'text/plain',"User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'}
    respuesta = requests.post(URLAUTH, data=api_credentials(), headers=agent)
    return respuesta.json()


def buscar_sorteos(token):
    # url filtro por year y mes
    #URLAUTH = 'https://api.loteriapanama.net/v1/sorteos/?c=todos&t=search&y=2022&m=9&p=0'
    URLAUTH = 'https://api.loteriapanama.net/v1/sorteos/?c=todos&t=multiple&q=12&p=0'
    agent = {'Xsrf-Token':token['token'],'withCredentials':'true','Authorization': "Bearer {}".format(token['token']),'Content-type': 'application/x-www-form-urlencoded','Accept': 'application/json, text/plain',"User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'}
    #parametros = {'withcredentials':'true'} | token
    respuesta = requests.post(URLAUTH, headers=agent)
    return respuesta.json()

def insertar_sorteos(sorteos):
    # Generate database schema
    Base.metadata.create_all(engine)
    # Create a new session
    session = Session()
    datos = sorteos['data']

    for fila in datos[:1]:
        print(fila)
        sorteo_hoy = Loteria(fila['cat'], fila['fecha'], fila['primero'], fila['letra'], fila['folio'], fila['serie'], fila['segundo'], fila['tercero'])
        session.add(sorteo_hoy)
        session.commit()

    session.close()  


if __name__ == '__main__':
    token = get_token()
    sorteos = buscar_sorteos(token)
    insertar_sorteos(sorteos)