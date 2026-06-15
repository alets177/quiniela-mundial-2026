# Proxy seguro de la API (Cloudflare Worker)

Tu página es estática (GitHub Pages no tiene servidor). Por eso **cualquier API key
que use el navegador queda expuesta**. Este Worker resuelve eso: guarda la key como
secreto y tu página solo habla con el Worker. De paso evita el proxy CORS público
(`corsproxy.io`), que era poco fiable.

```
Navegador (GitHub Pages)  →  Worker (guarda la key)  →  football-data.org
```

Es **gratis** y toma ~10 minutos. No necesitas saber de "deploys": se hace pegando
código en un panel web.

---

## Opción A — Panel de Cloudflare (recomendada, sin instalar nada)

1. **Crea una cuenta** gratis en <https://dash.cloudflare.com/sign-up>.
2. En el panel, ve a **Workers & Pages → Create → Workers → Create Worker**.
3. Ponle un nombre, por ejemplo `quiniela-proxy`, y pulsa **Deploy**.
4. Pulsa **Edit code**. Borra el código de ejemplo y **pega el contenido de
   [`quiniela-proxy.js`](quiniela-proxy.js)**. Pulsa **Deploy** (arriba a la derecha).
5. Configura el secreto con tu API key:
   - Ve a la pestaña **Settings → Variables and Secrets** (o *Variables*).
   - En **Secret**, añade:
     - Nombre: `FOOTBALL_DATA_TOKEN`
     - Valor: tu API key de football-data.org
   - (Opcional, más seguro) añade una **Variable** de texto:
     - Nombre: `ALLOW_ORIGIN`
     - Valor: la URL de tu sitio, p. ej. `https://alets177.github.io`
   - **Deploy/Save** para aplicar.
6. Copia la URL del Worker (algo como
   `https://quiniela-proxy.TU-USUARIO.workers.dev`).
7. Pégala en [`../js/config.js`](../js/config.js), en `proxyBase`:
   ```js
   proxyBase: 'https://quiniela-proxy.TU-USUARIO.workers.dev',
   ```
8. Sube el cambio de `config.js` a GitHub. ¡Listo! Tu página en línea mostrará datos
   en vivo, ya **sin exponer la key**.

### Probar el Worker
Abre en el navegador:
```
https://quiniela-proxy.TU-USUARIO.workers.dev/competitions/WC/matches?season=2026
```
Debe devolver JSON. Si ves `Falta el secreto…`, revisa el paso 5.

---

## Opción B — Wrangler (CLI, si prefieres terminal)

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler deploy quiniela-proxy.js --name quiniela-proxy
wrangler secret put FOOTBALL_DATA_TOKEN   # pega tu key cuando lo pida
```

---

## Importante: rota la key vieja

La key anterior estuvo publicada en el repo público, así que cualquiera pudo verla.
Entra a tu cuenta de **football-data.org** y genera una nueva; usa la nueva en el
Worker y borra la vieja de `js/config.local.js`.

## Nota sobre el plan gratuito de football-data.org

El plan gratuito limita a ~10 peticiones/minuto y puede no incluir el detalle
minuto a minuto de partidos en vivo. La app ya reintenta, cachea y refresca solo
cuando hay partidos en juego, así que se mantiene dentro del límite.
