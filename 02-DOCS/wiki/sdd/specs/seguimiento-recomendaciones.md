---
type: spec
title: Spec — Seguimiento de recomendaciones
description: WHAT y WHY de registrar lo recomendado antes de cada sorteo, compararlo con el resultado real, mostrar un marcador frente al azar y ponderar ML y estadístico según su rendimiento reciente.
tags: [sdd, spec]
timestamp: 2026-10-31T13:10:00Z
topic: sdd
slug: seguimiento-recomendaciones
status: draft
---

# Spec — Seguimiento de recomendaciones

> Slug: `seguimiento-recomendaciones` · Status: draft · Created: 2026-10-31
> Inherits: [constitution](../constitution.md) — **en borrador, sin ratificar** (ver Points to clarify).

## Problem & why
La web recomienda números y terminaciones antes de cada sorteo, pero no queda constancia de qué recomendó. Las recomendaciones cambian con cada reentreno, y el método estadístico usa azar sin semilla. Cuando sale el resultado, nadie puede comprobar «el miércoles me recomendó X y salió Y», ni saber si el ML o el estadístico rinden mejor que jugar al azar. La pestaña «Precisión» mide un backtest reconstruido a posteriori, no lo que la web mostró en su momento.

El dueño pidió una sección que compare lo recomendado con lo que salió, «para que el modelo aprenda».

**Objeción registrada (2026-10-31) y decisión del dueño.** Los sorteos son independientes. El backtest de hoy da los dos métodos al nivel del azar (top-1 ≈ 10 %, top-3 ≈ 30 %). Comparar y ponderar no hará que se acierte más; lo esperable es que el marcador confirme el azar y que la ponderación oscile alrededor de mitad y mitad. Se descartó reentrenar con los errores. El dueño eligió **marcador + ponderación de métodos** sabiéndolo: el valor que se busca es tener un registro honesto y medible.

## Cost of not building it
Poco en aciertos: no cambia la probabilidad de ganar. El coste es de confianza y transparencia. La web seguirá mostrando recomendaciones con «confianza» sin ningún registro de cómo les fue de verdad. El usuario no podrá distinguir un método útil de uno que solo parece útil.

## The cheapest alternative
Apuntar a mano, antes de cada sorteo, el top-5 y las terminaciones, y compararlos después. Funciona, pero nadie lo hará con constancia. Tampoco da un marcador acumulado ni la comparación con el azar. La pestaña «Precisión» ya existente cubre parte de la pregunta (¿rinde el modelo?), pero es una simulación, no el registro de lo mostrado.

## Goals
- Para cada sorteo, poder ver qué recomendó la web antes de que se celebrara y qué salió.
- Un marcador acumulado que compare ML, estadístico y combinada con lo que daría el azar.
- Una recomendación «Combinada» que da más peso al método que mejor rindió en los últimos 20 sorteos registrados.

## Non-goals / out of scope
- Mejorar la probabilidad de acierto, o prometerla.
- Usar los fallos registrados como señal extra para reentrenar el modelo (descartado por el dueño).
- Registrar la decena recomendada (no elegida).
- Registrar recomendaciones de premios de 2 o 5 cifras.
- Reconstruir recomendaciones de sorteos pasados: el registro empieza el día en que se active.
- Cambiar el botón ML/Estadístico actual o su comportamiento.

## Users & context
El dueño de la app (y quien la use) abre la web entre sorteos para ver las recomendaciones. Después de cada sorteo quiere saber cómo les fue, y con el tiempo quiere saber si algún método rinde mejor que el azar.

## Behaviour
- **Registro.** La primera vez que la web calcula recomendaciones después del último sorteo de una categoría, se guarda lo recomendado para el **próximo sorteo de esa categoría**. Ese registro queda congelado: los cálculos posteriores no lo cambian. Se guarda por categoría y por método (ML, estadístico y combinada): el top-5 de números y las 10 terminaciones, con la fecha y hora del registro.
- **Comparación.** Cuando llega el resultado de ese sorteo, el registro se compara con él:
  - Número exacto: un número recomendado acierta si coincide con el 1er, 2º o 3er premio de 4 cifras.
  - Terminación del número: se indica aparte si sus 2 últimas cifras coinciden con las de algún premio.
  - Dígitos en su posición: para cada número recomendado, cuántos de sus 4 dígitos coinciden en posición con cada premio de 4 cifras.
  - Terminaciones recomendadas: cuántas de las 10 coinciden con las terminaciones de los 3 premios, en cualquier formato.
- **Marcador.** Una sección nueva, «Seguimiento», muestra:
  - Sorteo a sorteo: lo recomendado por cada método frente a lo que salió, con los aciertos marcados.
  - El acumulado por método frente al valor esperado del azar para cada medida.
- **Ponderación.** La recomendación «Combinada» mezcla ML y estadístico. El peso de cada uno depende de su media de **dígitos en su posición** en los últimos 20 sorteos comparados. Con menos de 10 sorteos comparados, el peso es mitad y mitad. La web muestra el peso vigente.
- **Casos límite:**
  - Si nadie abre la web entre dos sorteos de una categoría, ese sorteo queda **sin registro**. Se muestra así y no cuenta en el marcador.
  - Un sorteo cuyo 2º o 3er premio no es de 4 cifras (por ejemplo, el gordito) solo compara números exactos y dígitos con los premios de 4 cifras. Las terminaciones sí usan todos los premios.
  - Dos sorteos de la misma categoría el mismo día: cada uno se compara con su propio registro si lo hay. Si no, queda sin registro.
  - Si el modelo ML no está entrenado al calcular, se registra solo el estadístico, y la combinada es igual al estadístico.
- **Errores:** si falla el guardado del registro, las recomendaciones se siguen mostrando con normalidad. El fallo queda en el log, nunca en el navegador.

## Acceptance criteria
- Given una categoría cuyo último sorteo ya está en la base, When la web calcula recomendaciones por primera vez, Then queda un registro para el próximo sorteo de esa categoría, con el top-5 y las 10 terminaciones de cada método.
- Given un registro ya guardado para el próximo sorteo, When la web vuelve a calcular recomendaciones (incluso tras reentrenar), Then el registro no cambia.
- Given un registro y el resultado de su sorteo ya sincronizado, When se abre «Seguimiento», Then se ve lo recomendado junto a lo que salió, con los aciertos exactos, de terminación y de dígitos en posición marcados.
- Given un top-5 que contiene el número del 3er premio, When se compara, Then cuenta 1 acierto exacto para ese método.
- Given un gordito cuyo 2º y 3º son de 2 cifras, When se compara, Then los números recomendados solo se comparan con el 1er premio, y las terminaciones recomendadas con los 3.
- Given menos de 10 sorteos comparados, When se calcula la combinada, Then el peso mostrado es 50 % / 50 %.
- Given 20 o más sorteos comparados en los que el ML tiene mayor media de dígitos en posición, When se calcula la combinada, Then el peso del ML es mayor que el 50 %, y solo cuentan los 20 más recientes.
- Given un sorteo sin registro previo, When se abre «Seguimiento», Then aparece como «sin registro» y no suma ni resta en el marcador.
- Given el marcador acumulado, When se muestra, Then junto a cada medida aparece el valor esperado del azar.
- Given un fallo al guardar el registro, When se piden las recomendaciones, Then se muestran igual, y la respuesta no contiene detalles del error.

## Points to clarify
- **pregunta abierta** — ¿Qué fórmula convierte la diferencia de medias en pesos? Por ejemplo, un peso proporcional a la media de cada método, o una función más suave que no pase del 80/20 con 20 sorteos de ruido. Afecta a cuánto oscila la combinada.
- **suposición tomada** — El valor esperado del azar se muestra como cifra teórica: 0,4 dígitos por número y premio de 4 cifras; ≈ 0,15 % de aciertos exactos del top-5 con 3 premios; ≈ 27 % (1 − 0,9³) de que al menos 1 de 10 terminaciones coincida con las de 3 premios. *Base:* probabilidad uniforme por dígito. *Riesgo:* si se prefiere un azar simulado (números aleatorios registrados igual que los métodos), cambia el criterio del marcador.
- **suposición tomada** — «Próximo sorteo de una categoría» es el siguiente sorteo de esa categoría que llegue, sea cual sea su fecha (el extraordinario no tiene calendario fijo). *Base:* la app no conoce el calendario oficial. *Riesgo:* si llega un sorteo de otra modalidad etiquetado con esa categoría, se compara con ese registro.
- **suposición tomada** — La combinada se registra y puntúa igual que los otros dos métodos. *Base:* así se mide si ponderar sirve de algo. *Riesgo:* ninguno conocido.
- **decisión diferida** — Ratificar la constitución. Está en borrador y dice «se trabaja directo en la rama principal», cuando `main` está protegido y todo entra por PR. Fuera de este ciclo; esta spec sigue el flujo real (rama + PR).
- **área no formulable** — Cómo afectan los reentrenos frecuentes a la comparación justa entre métodos: si el ML se reentrena entre el registro y el sorteo, el registro sigue siendo el congelado. Intuyo que hay una pregunta sobre el momento del reentreno, pero aún no sé formularla.
