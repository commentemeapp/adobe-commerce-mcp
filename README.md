# Adobe Commerce MCP

**Servidor MCP para desarrollar en PHP sobre Adobe Commerce: documentación oficial, archivos de configuración, CLI, Web API y scaffolding de módulos, sin red y sin credenciales.**

`adobe-commerce-mcp` es un servidor [Model Context Protocol](https://modelcontextprotocol.io/) para quien escribe módulos de Adobe Commerce (Magento Open Source) y Adobe Commerce en PaaS o en servidor propio: `di.xml`, plugins, observers, layout, `db_schema.xml`, `webapi.xml` y el resto del día a día en PHP. La documentación oficial viaja dentro del paquete; el servidor no abre conexiones, no pide login y no escribe en disco. Funciona con Claude Code, Claude Desktop, Cursor, VS Code, Windsurf y cualquier cliente MCP con transporte stdio.

[![npm](https://img.shields.io/npm/v/adobe-commerce-mcp?color=EB1000)](https://www.npmjs.com/package/adobe-commerce-mcp)
[![node](https://img.shields.io/node/v/adobe-commerce-mcp)](https://nodejs.org)
[![licencia](https://img.shields.io/npm/l/adobe-commerce-mcp)](./LICENSE)

---

## Por qué existe

El MCP oficial de Adobe, [`@adobe-commerce/commerce-extensibility-tools`](https://www.npmjs.com/package/@adobe-commerce/commerce-extensibility-tools), cubre el desarrollo con App Builder (comandos `aio`). Para usarlo hay que iniciar sesión en Adobe IMS (`aio auth login`), también para buscar documentación; su licencia es propietaria (EULA), y una de sus herramientas envía el historial de la conversación a Adobe. Si desarrollas con App Builder, ese es el servidor que corresponde.

Para el desarrollo en PHP (módulos, `di.xml`, layout, `db_schema.xml`, `webapi.xml`) no hay un servidor oficial. Este cubre ese caso con la documentación pública de Adobe, licencia MIT, sin cuenta y sin red.

## Características

Versión del código: **0.1.0**, según [package.json](package.json). La entrada [src/index.ts](src/index.ts) conecta el servidor por **stdio**, y las diez herramientas se registran en [src/tools/index.ts](src/tools/index.ts).

- **Documentación oficial offline**: 1.896 páginas de cuatro repositorios de AdobeDocs, con búsqueda BM25 por secciones. Cada resultado trae título, URL pública y ruta en el repositorio de origen.
- **Archivos de configuración**: qué es cada uno, dónde va (carpeta y área), la URN del XSD cuando la documentación la da y las páginas que lo explican.
- **CLI y Web API**: los 147 comandos de `bin/magento` (2.4.9) con sus opciones, 614 endpoints REST del esquema OpenAPI y 225 queries y mutations de GraphQL.
- **Scaffolding**: módulo, plugin, observer, controller y tabla de `db_schema.xml`. Las herramientas devuelven los archivos (ruta y contenido) para que el cliente los escriba, y cada archivo dice de qué página de la documentación se adaptó.
- **Local y sin credenciales**: nada se descarga ni se envía; todo el conocimiento está en `data/`.

## Instalación

El cliente MCP ejecuta el servidor bajo demanda con `npx`, así que no hace falta instalarlo. Requiere Node `>= 18`.

### Claude Code

```bash
claude mcp add adobe-commerce -- npx -y adobe-commerce-mcp
```

Para compartirlo con el equipo en un repositorio, usa `--scope project`: la configuración queda en `.mcp.json`.

### Claude Desktop, Cursor y Windsurf

En `claude_desktop_config.json` (Claude Desktop), `~/.cursor/mcp.json` o `.cursor/mcp.json` (Cursor) y `~/.codeium/windsurf/mcp_config.json` (Windsurf):

```json
{
  "mcpServers": {
    "adobe-commerce": {
      "command": "npx",
      "args": ["-y", "adobe-commerce-mcp"]
    }
  }
}
```

### VS Code

En `.vscode/mcp.json`:

```json
{
  "servers": {
    "adobe-commerce": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "adobe-commerce-mcp"]
    }
  }
}
```

### Otros clientes

Cualquier cliente con transporte `stdio` sirve: el comando es `npx` y los argumentos, `-y adobe-commerce-mcp`. Con una instalación global (`npm install -g adobe-commerce-mcp`), el comando es `adobe-commerce-mcp`.

## Uso

Después de reiniciar el cliente, pide lo que necesitas en lenguaje natural y el asistente elige la herramienta:

- "Crea el módulo `Acme_Reviews` que dependa de `Magento_Catalog`"
- "Agrega un plugin after a `Magento\Catalog\Model\Product::getName`"
- "¿Dónde va el `system.xml` y cuál es su XSD?"
- "Crea la tabla `acme_review` con clave foránea a `catalog_product_entity`"
- "¿Qué opciones tiene `bin/magento setup:static-content:deploy`?"
- "¿Qué argumentos recibe la mutation `addProductsToCart`?"

## Herramientas

### Documentación y referencia

| herramienta           | parámetros                           | qué hace                                                                                                                                                           |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search-docs`         | `query`, `area?`, `limit?`           | Busca en la documentación; `area` es `php`, `frontend`, `webapi` u `operations`. Devuelve extractos con título, URL y ruta de origen.                              |
| `read-doc`            | `ref`, `section?`                    | Devuelve una página completa o una sección, por id, ruta de origen o URL pública.                                                                                  |
| `explain-config-file` | `file`                               | Explica un archivo de configuración: `di.xml`, `events.xml`, `webapi.xml`, `db_schema.xml`, `crontab.xml`, `routes.xml`, `system.xml`, `acl.xml`, layout y 32 más. |
| `lookup-cli-command`  | `command`                            | Descripción, uso, argumentos y opciones de un comando de `bin/magento`; acepta atajos (`s:up`) y palabras clave.                                                   |
| `lookup-webapi`       | `query`, `api?`, `method?`, `limit?` | Endpoints REST (parámetros, cuerpo, qué token los llama) y queries y mutations de GraphQL (argumentos, retorno, ejemplo, guía).                                    |

### Scaffolding

| herramienta       | parámetros                                                                                                                           | qué genera                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaffold-module` | `module`, `description?`, `packageName?`, `version?`, `license?`, `sequence?`, `php?`, `basePath?`                                   | `registration.php`, `etc/module.xml` y `composer.json`.                                                                                         |
| `add-plugin`      | `module`, `targetClass`, `method`, `type`, `pluginClass?`, `pluginName?`, `area?`, `sortOrder?`, `basePath?`                         | La clase del plugin (before, after o around) y su `di.xml`.                                                                                     |
| `add-observer`    | `module`, `event`, `observerClass?`, `observerName?`, `area?`, `basePath?`                                                           | La clase del observer y su `events.xml`.                                                                                                        |
| `add-controller`  | `module`, `area`, `frontName`, `routeId?`, `controller?`, `action?`, `method?`, `title?`, `aclResource?`, `basePath?`                | `routes.xml` y el controller (página GET o JSON por POST); para páginas, el layout y el template; en `adminhtml`, `ADMIN_RESOURCE` y `acl.xml`. |
| `add-db-schema`   | `module`, `table`, `columns?`, `primaryKey?`, `unique?`, `indexes?`, `foreignKeys?`, `comment?`, `resource?`, `engine?`, `basePath?` | La tabla en `etc/db_schema.xml`, con los pasos del whitelist y de `setup:upgrade`.                                                              |

Las herramientas de scaffolding devuelven también `structuredContent` con `files` (`path`, `content`, `source`) y `notes`. Las rutas son relativas a la raíz de la instalación (`app/code/<Vendor>/<Module>` por defecto). La herramienta no ve el módulo: si el archivo ya existe, el nodo nuevo se fusiona con lo que hay, y las notas lo avisan.

## Resources

| URI                             | contenido                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `adobe-commerce://docs`         | Índice de la documentación por área y carpeta.                                         |
| `adobe-commerce://docs/{id}`    | Una página, por ejemplo `adobe-commerce://docs/php/development/components/plugins.md`. |
| `adobe-commerce://config-files` | Lista de los archivos de configuración del catálogo.                                   |
| `adobe-commerce://sources`      | Repositorios, commits y licencias de los datos.                                        |

## De dónde vienen los datos

Todo sale de los repositorios públicos de documentación de Adobe, en el commit indicado en [data/fonte.json](data/fonte.json):

| repositorio                                                                             | licencia   | qué aporta                                                                                                            |
| --------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| [AdobeDocs/commerce-php](https://github.com/AdobeDocs/commerce-php)                     | Apache-2.0 | 807 páginas: extensiones PHP, arquitectura, tutoriales, estándares de código, referencia de módulos.                  |
| [AdobeDocs/commerce-frontend-core](https://github.com/AdobeDocs/commerce-frontend-core) | Apache-2.0 | 262 páginas: temas, layouts, templates, UI components, JavaScript, Page Builder.                                      |
| [AdobeDocs/commerce-webapi](https://github.com/AdobeDocs/commerce-webapi)               | Apache-2.0 | 532 páginas de guías REST y GraphQL, el esquema OpenAPI 2.4.9 y la referencia generada de GraphQL 2.4.9.              |
| [AdobeDocs/commerce-operations.en](https://github.com/AdobeDocs/commerce-operations.en) | MIT        | 295 páginas: configuración, CLI, instalación, rendimiento, seguridad, actualización y la referencia de `bin/magento`. |

Quedaron fuera las notas de versión, las más de 900 páginas de parches del Quality Patches Tool, las herramientas de monitoreo en la nube y la referencia de GraphQL de versiones anteriores. El código y los XSD del repositorio `magento/magento2` no se usan: su licencia (OSL-3.0) no es compatible con la MIT de este paquete. Los templates de scaffolding se adaptaron de los ejemplos de la documentación.

Las licencias de las fuentes van en [data/licenses/](data/licenses/) y el detalle, en [NOTICE](NOTICE). Este proyecto no está afiliado a Adobe ni cuenta con su respaldo.

## Estructura

```text
src/
├── index.ts            # entry point del binario (stdio)
├── server.ts           # McpServer: registra tools y resources
├── tools/              # una herramienta por archivo, registradas en tools/index.ts
├── scaffold/           # validación de nombres y formato de los archivos generados
├── resources/          # adobe-commerce://docs, config-files y sources
└── knowledge/          # carga de data/ y búsqueda BM25
scripts/
├── ingerir.ts          # genera data/ a partir de los clones de AdobeDocs
├── catalogo-config.ts  # catálogo de archivos de configuración, con sus fuentes
├── probar-mcp.mjs      # arranca el servidor por stdio y comprueba las herramientas
└── rastros.mjs         # busca rutas locales, correos personales y nombres de clientes
data/                   # generado: docs, cli.json, webapi/, config-files.json, licencias
test/                   # node --test sobre el build
```

## Desarrollo

Desde una copia del repositorio:

```bash
npm install
npm run check
```

| comando                        | qué hace                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run build`                | Compila TypeScript en `build/` y marca el binario como ejecutable.                         |
| `npm run lint`                 | Verificación de tipos de `src/` y `scripts/`.                                              |
| `npm test`                     | Pruebas con `node --test` sobre el build.                                                  |
| `npm run probar-mcp`           | Arranca el servidor compilado por stdio y falla si falta alguna herramienta esperada.      |
| `npm run rastros`              | Busca rutas locales, correos personales y nombres de clientes fuera de `node_modules`.     |
| `npm run check`                | El gate: `prettier --check`, lint, build, pruebas, `probar-mcp` y `rastros`.               |
| `npm run ingerir -- <carpeta>` | Regenera `data/` a partir de los clones (también con `FONTES_DIR`).                        |
| `npm run inspect`              | Abre el [MCP Inspector](https://github.com/modelcontextprotocol/inspector) sobre el build. |

Para probar la versión local en un cliente, apunta el comando a la build:

```bash
claude mcp add adobe-commerce-local -- node /ruta/a/adobe-commerce-mcp/build/index.js
```

### Actualizar la documentación

1. Clona en una misma carpeta `AdobeDocs/commerce-php`, `commerce-frontend-core`, `commerce-webapi` y `commerce-operations.en` (un clon superficial alcanza).
2. `npm run ingerir -- <carpeta>`. El script solo lee los archivos de texto; nada de los clones se ejecuta.
3. La ingestión falla si una entrada del catálogo de configuración cita una página que no existe o una URN que no aparece en sus fuentes.
4. `npm run check` y commit de `data/`: el paquete lo necesita.

### Convenciones

- TypeScript con módulos ESM; Prettier sin punto y coma y con comillas simples.
- Las descripciones de las herramientas van en inglés: es lo que el modelo lee para elegirlas.
- [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
- El conocimiento es de solo lectura en tiempo de ejecución: nada se escribe en disco ni se descarga.

### Ramas y publicación

El trabajo nace en una rama salida de `dev` y el PR va contra `dev`. De ahí se promueve a `qa` y, después de probar, a `main`, siempre con merge de la rama completa. El CI corre `npm run check` en Node 18, 20 y 22.

Para publicar, actualiza la versión en `package.json`, `server.json` y `CHANGELOG.md` y sube un tag `v*`: el workflow `publish.yml` corre el gate, publica en npm con _provenance_, crea el GitHub Release y publica `server.json` en el MCP Registry.

## Changelog

Ver [`CHANGELOG.md`](./CHANGELOG.md).

## Licencia

[MIT](./LICENSE). Los datos de `data/` conservan las licencias de sus fuentes (Apache-2.0 y MIT); ver [NOTICE](NOTICE).

_Hecho con amor y café por commente.me_
