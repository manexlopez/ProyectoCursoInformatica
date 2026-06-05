# Hidrolinera Térmica · Suite de Recuperación de Calor

Proyecto de divulgación (curso de doctorado 2026) sobre **síntesis de redes de
intercambiadores de calor en sistemas térmicos transitorios**, aplicado a una
estación de repostaje de hidrógeno.

La web tiene **5 puntos**: 4 aplicaciones sencillas + 1 proyecto principal, todo
en una sola página.

## Cómo ejecutar

Abre **`index.html`** con un navegador (recomendado **Google Chrome**).
No necesita servidor ni conexión salvo para cargar Tailwind y Chart.js desde CDN.

## Estructura

```text
index.html      → Página única. Arriba: PROYECTO PRINCIPAL (simulación animada de
                  la hidrolinera). Debajo: cuadrícula 2×2 con las 4 apps en iframes.
                  Pulsa una tarjeta para ampliarla y poder interactuar mejor.
App1.html       → Módulo 1 · Trayectorias térmicas de cada componente.
App2.html       → Módulo 2 · Propiedades reales del fluido y exergía mecánica.
App3.html       → Módulo 3 · Pérdidas ambientales y número de Biot.
App4.html       → Módulo 4 · Seguridad, time-to-limit y discretización temporal.
core/bus.js     → Motor compartido: definición de la estación, física, cálculo de
                  cada módulo, síntesis de la red (HEN) y bus de comunicación en vivo.
```

## Cómo funciona

Los 4 componentes de la estación (Compresor H₂, Gas de Repostaje, Agua Sanitaria
y Climatización) atraviesan los 4 módulos: cada uno añade una capa de información.
El **proyecto principal** recoge todo y muestra, de forma visual, cómo la red de
intercambiadores **recupera el calor residual** de la estación para cubrir las
demandas térmicas del edificio, reduciendo las _utilities_ externas.

Los módulos se comunican **en vivo** con la simulación principal mediante
`localStorage` + `postMessage`: cualquier cambio en un módulo se refleja al
instante en el proyecto principal (calor recuperado, ahorro de CO₂, € / año, etc.).
