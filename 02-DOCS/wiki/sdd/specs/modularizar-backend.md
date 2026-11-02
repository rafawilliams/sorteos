---
type: spec
title: Spec — Modularizar el backend (separar cálculo estadístico de la capa web)
description: WHAT y WHY de separar los cálculos estadísticos puros de la capa HTTP/caché/persistencia en el backend, preservando todos los contratos de la API y de las pruebas existentes.
tags: [sdd, spec]
timestamp: 2026-11-02T11:00:00Z
topic: sdd
slug: modularizar-backend
status: approved in autopilot, not item by item (2026-11-02)
---

# Spec — Modularizar el backend

> Slug: `modularizar-backend` · Status: approved in autopilot, not item by item · Created: 2026-11-02
> Inherits: [constitution](../constitution.md) (`v1.0.0`)

## Problem & why
El archivo principal del servidor concentra en ~1250 líneas dos responsabilidades distintas: la atención de peticiones web (rutas, límites por IP, caché, lectura de base de datos, lanzamiento de sincronización) y todos los cálculos estadísticos puros sobre sorteos (frecuencias, recomendaciones, decenas, terminaciones, formatos de 2/5 cifras, recomendación mensual, tendencias, gaps, comparador, simulador y backtest estadístico). Mientras que el modelo de aprendizaje automático y el seguimiento de recomendaciones ya viven en módulos independientes y probables sin servidor web, las estadísticas siguen acopladas al archivo de rutas.

**Objeción registrada (2026-11-02) y decisión del dueño.** Para el usuario final de la web no cambia ningún resultado ni pantalla, y mover funciones entre archivos conlleva el riesgo de romper importaciones o parches de las pruebas existentes si no se mantiene compatibilidad. El dueño eligió **modularizar solo el backend** en modo autopilot para dejar la lógica estadística aislada igual que los demás dominios del proyecto.

## Cost of not building it
Ninguno visible para quien consulta resultados en el navegador. El coste recae en el mantenimiento: cualquier cambio en una métrica estadística obliga a editar el mismo archivo de ~1250 líneas que configura el servidor web, el limitador de peticiones y las rutas, y las funciones de cálculo de gaps, comparador y simulador no pueden invocarse ni probarse de forma unitaria sin pasar por una petición HTTP.

## The cheapest alternative
No mover el código actual y limitarse a escribir en módulos nuevos las funcionalidades futuras (como ya se hizo con el seguimiento de recomendaciones). Resuelve el crecimiento futuro sin tocar lo existente, pero deja las ~800 líneas de estadística actual mezcladas con la capa HTTP y tres cálculos (gaps, comparador y simulador) encerrados dentro de sus manejadores de ruta.

## Goals
- Separar toda la lógica de cálculo estadístico y simulación en una unidad independiente que opere sobre colecciones de sorteos en memoria, sin depender del servidor web ni de la conexión a la base de datos.
- Permitir que el cálculo de gaps, la comparación de números y el simulador histórico se puedan invocar y probar directamente como funciones de dominio, además de a través de sus rutas web.
- Reducir el archivo principal del servidor únicamente a la configuración web, caché, acceso a datos y rutas.
- Mantener intactos todos los comportamientos observables de la API y la compatibilidad con la suite de pruebas existente.

## Non-goals / out of scope
- Dividir o modificar el código del cliente (`static/app.js`, `static/style.css`, `templates/index.html`).
- Cambiar fórmulas, pesos, semillas o formatos de respuesta de ninguna ruta existente.
- Reescribir el modelo de aprendizaje automático o el módulo de seguimiento.
- Añadir nuevas rutas o nuevas pestañas en la interfaz.

## Users & context
Quien desarrolla y mantiene el proyecto: al modificar o probar una regla estadística (frecuencias, decenas, terminaciones, formatos, mensual, gaps, comparador, simulador o backtest), trabaja sobre un módulo puro sin levantar ni importar la aplicación web ni la conexión a MariaDB.

## Behaviour
- **Aislamiento del dominio estadístico:** todos los cálculos estadísticos reciben listas de sorteos en memoria y devuelven estructuras de datos nativas, sin leer variables de entorno de base de datos ni abrir conexiones ni requerir contexto de petición HTTP.
- **Paridad funcional de extremo a extremo:** todas las rutas de la API (`/api/sorteos`, `/api/stats`, `/api/seguimiento`, `/api/gaps`, `/api/comparar`, `/api/simulador`, `/api/actualizar`, `/api/backtesting`) devuelven exactamente la misma estructura, códigos de estado y reglas de validación que antes del cambio.
- **Compatibilidad de importación:** cualquier prueba o script existente que importe funciones o constantes estadísticas desde el módulo principal del servidor sigue funcionando sin modificaciones.

## Acceptance criteria
- Given el módulo de estadísticas del backend, When se importa e invoca en un proceso Python sin servidor web activo ni conexión a base de datos, Then ejecuta todos los cálculos estadísticos (frecuencias, recomendaciones, decenas, terminaciones, formatos, mensual, tendencias, gaps, comparador, simulador y backtest) sin lanzar errores.
- Given el archivo principal del servidor web tras la separación, When se mide su tamaño y responsabilidad, Then contiene únicamente configuración web, caché, acceso a datos y rutas (menos de 500 líneas) y delega todos los cálculos estadísticos al módulo dedicado.
- Given la suite de pruebas existente (`153` tests), When se ejecuta sin modificar los tests previos, Then el 100 % de los tests pasa con cero warnings (`pytest -q -W error`).
- Given las funciones de dominio de gaps, comparador y simulador, When se prueban directamente con sorteos sintéticos en memoria, Then producen los mismos resultados que las rutas `/api/gaps`, `/api/comparar` y `/api/simulador`.

## Points to clarify
- **resuelta (frontier 2026-11-02)** — Alcance de la modularización: solo el backend (dejar `static/app.js` fuera de este ciclo).
- **suposición tomada** — Se mantiene la reexportación de los nombres estadísticos en el módulo principal (`app`) para no obligar a cambiar las importaciones existentes en `tests/`. *Base:* evita roturas innecesarias y cumple el criterio de compatibilidad hacia atrás. *Riesgo:* ninguno conocido.
- **decisión diferida** — Modularización del frontend (`static/app.js`); fuera de este ciclo.

## Revisions
- 2026-11-02 — Alcance fijado en backend únicamente y ejecución aprobada en autopilot por el dueño.
