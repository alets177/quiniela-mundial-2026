# Quiniela · Mundial 2026

Tablero de la quiniela del Mundial 2026: equipos por participante, grupos,
posiciones en vivo, calendario y apuestas. Datos en vivo desde
[football-data.org](https://www.football-data.org/).

Sitio estático (HTML + CSS + JavaScript con ES modules). **Sin paso de build**:
se despliega tal cual en GitHub Pages.

## Cómo correr en local

Los ES modules necesitan servirse por HTTP (no funciona abriendo el archivo con
doble clic / `file://`). Usa cualquiera de estas opciones desde la carpeta del proyecto:

```bash
# Python (ya lo tienes instalado)
python -m http.server 5500
# luego abre http://localhost:5500
```

O la extensión **Live Server** de VS Code: clic derecho en `index.html` → *Open with Live Server*.

## Datos en vivo y API key

La API key está en `js/config.js` (`apiKey`). Es una key **gratuita y de bajo riesgo**,
por eso se deja visible a propósito: en un sitio estático no hay forma de esconderla.

Football-data.org no permite llamadas directas desde el navegador, así que la página
usa un proxy CORS público (`legacyCorsProxy`). Ese proxy **puede fallar a veces**. Si la
página empieza a quedarse sin cargar datos, monta el proxy propio (Cloudflare Worker,
gratis) y pon su URL en `js/config.js` → `proxyBase`: es más fiable y de paso esconde la
key. Guía: [`worker/README.md`](worker/README.md).

## Pruebas

La lógica de puntajes está aislada y cubierta con pruebas (runner integrado de Node, sin dependencias):

```bash
npm test
```

## Estructura

```
index.html              Markup (carga assets/css y js/app.js)
assets/css/styles.css   Estilos: tokens, tema claro/oscuro, responsive
js/
  config.js             Configuración: apiKey, proxyBase (opcional), competición, etc.
  config.local.js       Override local opcional (NO versionado; ver .example)
  data.js               Participantes, grupos, ranking, normalización de nombres
  scoring.js            Lógica pura: posiciones, jornadas, duelos (testeable)
  api.js                Capa de datos: timeout, reintentos, caché, respaldo
  ui.js                 Helpers de DOM, formato, pestañas accesibles, tema
  render.js             Renderizadores de cada pestaña
  app.js                Orquestador: estado, init, auto-refresco
worker/                 Proxy Cloudflare (esconde la key) + guía de despliegue
tests/                  Pruebas de scoring y de renderizado
```

## Despliegue (GitHub Pages)

Ya está configurado: cada push a la rama publicada actualiza el sitio. No hay nada
que compilar. Solo recuerda poner `proxyBase` en `js/config.js` para los datos en vivo.
