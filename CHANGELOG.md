# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto sigue el [Versionado Semántico](https://semver.org/lang/es/).

## [0.1.0] - 2026-10-25

### Añadido

- Servidor MCP por stdio para desarrollar en PHP sobre Adobe Commerce, sin red y sin credenciales.
- Documentación oficial embutida: 1.896 páginas de `AdobeDocs/commerce-php`, `commerce-frontend-core`,
  `commerce-webapi` y `commerce-operations.en`, con búsqueda BM25 por secciones.
- Herramientas de consulta: `search-docs`, `read-doc`, `explain-config-file` (41 archivos de
  configuración con ubicación, área, URN del XSD y fuentes), `lookup-cli-command` (147 comandos de
  `bin/magento` 2.4.9) y `lookup-webapi` (614 endpoints REST del esquema OpenAPI 2.4.9 y 225 queries y
  mutations de GraphQL 2.4.9).
- Herramientas de scaffolding que devuelven los archivos sin escribir en disco: `scaffold-module`,
  `add-plugin`, `add-observer`, `add-controller` y `add-db-schema`. Cada archivo indica la página de la
  documentación de la que se adaptó.
- Resources `adobe-commerce://docs`, `adobe-commerce://docs/{id}`, `adobe-commerce://config-files` y
  `adobe-commerce://sources`.
- Script de ingestión `npm run ingerir`, con `data/fonte.json` (repositorio, commit y licencia) y las
  licencias de las fuentes en `data/licenses/`.
- Gate `npm run check` (Prettier, tipos, build, pruebas, `probar-mcp` y búsqueda de rastros), CI en
  Node 18, 20 y 22 y workflow de publicación por tag.
