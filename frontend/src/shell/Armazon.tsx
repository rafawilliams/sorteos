// El armazón de la página (spec frontend-react, T055): enlace de salto, botón del menú, y dentro de `.app` el fondo del menú, la
// cabecera, la barra de pestañas, el contenido con las 14 secciones y el pie. Es lo que antes hacían la plantilla y
// `static/app.js`; ahora la página solo trae un `<div id="root">`.
// Con el menú lateral abierto todo lo que no es la barra, el fondo ni el botón es inerte (sin foco ni lectura).
import { EnlaceDeSalto } from './Cabecera'
import { Cabecera, Pie } from './Marco'
import { Secciones } from './Secciones'
import { BotonMenu, FondoMenu, PestanasPrincipales, useMenuLateral } from './Tabs'

export function Armazon() {
  const menu = useMenuLateral()
  return (
    <>
      <EnlaceDeSalto />
      <BotonMenu abierto={menu.abierto} onAlternar={menu.alternar} refBoton={menu.refBoton} />
      <div className="app">
        <FondoMenu abierto={menu.abierto} onCerrar={menu.cerrarConFoco} />
        <Cabecera inert={menu.abierto} />
        <PestanasPrincipales abierto={menu.abierto} alElegir={menu.alElegir} />
        {/* `tabIndex=-1` y sin contorno: es el destino del enlace de salto, no un control. */}
        <main id="content" tabIndex={-1} style={{ outlineStyle: 'none' }} inert={menu.abierto}>
          <Secciones />
        </main>
        <Pie inert={menu.abierto} />
      </div>
    </>
  )
}
