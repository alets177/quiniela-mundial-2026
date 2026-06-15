/**
 * PLANTILLA — copia este archivo como `config.local.js` (en la misma carpeta)
 * para probar en local con tu API key SIN subirla a GitHub.
 *
 *   cp js/config.local.example.js js/config.local.js   (Git Bash)
 *   Copy-Item js/config.local.example.js js/config.local.js   (PowerShell)
 *
 * `config.local.js` está en .gitignore: nunca se sube ni se despliega.
 * Para la versión EN LÍNEA usa el proxy (worker/README.md), no este archivo.
 */
export default {
  // Opción A — usar tu Worker (recomendado, también sirve en local):
  // proxyBase: 'https://quiniela-proxy.tu-usuario.workers.dev',

  // Opción B — key directa + proxy CORS público (solo pruebas locales):
  // apiKey: 'TU_API_KEY_DE_FOOTBALL_DATA_ORG',
};
