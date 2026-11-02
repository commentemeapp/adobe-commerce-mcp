![adobe-commerce-mcp · Servidor MCP para módulos de Adobe Commerce en PHP, sin red y sin credenciales](https://raw.githubusercontent.com/commentemeapp/adobe-commerce-mcp/main/assets/banner.png)

# adobe-commerce-mcp

**Servidor MCP para módulos de Adobe Commerce en PHP, sin red y sin credenciales.**

![npm](https://img.shields.io/npm/v/@commenteme/adobe-commerce-mcp?labelColor=005278&color=FFBD38)
![node](https://img.shields.io/node/v/adobe-commerce-mcp?labelColor=005278&color=FFBD38)
![license](https://img.shields.io/npm/l/adobe-commerce-mcp?labelColor=005278&color=FFBD38)

## Instalación

```bash
claude mcp add adobe-commerce -- npx -y @commenteme/adobe-commerce-mcp
```

Requiere Node `>= 18`. El cliente ejecuta el servidor con `npx`, así que no hace falta instalarlo. Para Claude Desktop, Cursor, Windsurf, VS Code y otros clientes, mira [Otros clientes](#otros-clientes).

## Uso rápido

Reinicia el cliente y pide lo que necesitas en lenguaje natural. El asistente elige la herramienta:

- "Crea el módulo `Acme_Reviews` que dependa de `Magento_Catalog`"
- "Agrega un plugin after a `Magento\Catalog\Model\Product::getName`"
- "Dónde va el `system.xml` y cuál es su XSD?"
- "Crea la tabla `acme_review` con clave foránea a `catalog_product_entity`"
- "Que opciones tiene `bin/magento setup:static-content:deploy`?"
- "Que argumentos recibe la mutation `addProductsToCart`?"

## Que incluye

Para quien escribe módulos de Adobe Commerce (Magento Open Source) en PaaS o en servidor propio: `di.xml`, plugins, observers, layout, `db_schema.xml`, `webapi.xml` y el resto del día a día en PHP.

- **Documentación oficial offline**: 1.896 páginas de cuatro repositorios de AdobeDocs, con búsqueda BM25 por secciones. Cada resultado trae título, URL pública y ruta en el repositorio de origen.
- **Archivos de configuración**: que es cada uno, dónde va (carpeta y área), la URN del XSD cuando la documentación la da y las páginas que lo explican.
- **CLI y Web API**: los 147 comandos de `bin/magento` (2.4.9) con sus opciones, 614 endpoints REST del esquema OpenAPI y 225 queries y mutations de GraphQL.
- **Scaffolding**: módulo, plugin, observer, controller y tabla de `db_schema.xml`. Las herramientas devuelven los archivos (ruta y contenido) para que el cliente los escriba, y cada archivo dice de que página de la documentación salió.
- **Local y sin credenciales**: no abre conexiones, no pide login y no escribe en disco. Todo el conocimiento está en `data/`.

Funciona con Claude Code, Claude Desktop, Cursor, VS Code, Windsurf y cualquier cliente MCP con transporte stdio.

## Por que existe

El MCP oficial de Adobe, [`@adobe-commerce/commerce-extensibility-tools`](https://www.npmjs.com/package/@adobe-commerce/commerce-extensibility-tools), cubre el desarrollo con App Builder (comandos `aio`). Pide iniciar sesión en Adobe IMS (`aio auth login`), incluso para buscar documentación; su licencia es propietaria (EULA), y una de sus herramientas envía el historial de la conversación a Adobe. Si desarrollas con App Builder, ocupa ese. Para el desarrollo en PHP no hay servidor oficial: este cubre ese caso con la documentación pública de Adobe Commerce, licencia MIT, sin cuenta y sin red.

## Documentación

### Otros clientes

En `claude_desktop_config.json` (Claude Desktop), `~/.cursor/mcp.json` o `.cursor/mcp.json` (Cursor) y `~/.codeium/windsurf/mcp_config.json` (Windsurf):

```json
{
  "mcpServers": {
    "adobe-commerce": {
      "command": "npx",
      "args": ["-y", "@commenteme/adobe-commerce-mcp"]
    }
  }
}
```

En VS Code, `.vscode/mcp.json`:

```json
{
  "servers": {
    "adobe-commerce": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@commenteme/adobe-commerce-mcp"]
    }
  }
}
```

Cualquier cliente con transporte `stdio` sirve: el comando es `npx` y los argumentos, `-y @commenteme/adobe-commerce-mcp`. Con una instalación global (`npm install -g @commenteme/adobe-commerce-mcp`), el comando es `adobe-commerce-mcp`. En Claude Code, `--scope project` deja la configuración en `.mcp.json` para compartirla con el equipo.

### Herramientas

La entrada [src/index.ts](src/index.ts) conecta el servidor por stdio, y las diez herramientas se registran en [src/tools/index.ts](src/tools/index.ts).

**Documentación y referencia**

| herramienta           | parámetros                           | que hace                                                                                                                                                           |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search-docs`         | `query`, `area?`, `limit?`           | Busca en la documentación; `area` es `php`, `frontend`, `webapi` u `operations`. Devuelve extractos con título, URL y ruta de origen.                              |
| `read-doc`            | `ref`, `section?`                    | Devuelve una página completa o una sección, por id, ruta de origen o URL pública.                                                                                  |
| `explain-config-file` | `file`                               | Explica un archivo de configuración: `di.xml`, `events.xml`, `webapi.xml`, `db_schema.xml`, `crontab.xml`, `routes.xml`, `system.xml`, `acl.xml`, layout y 32 mas. |
| `lookup-cli-command`  | `command`                            | Descripción, uso, argumentos y opciones de un comando de `bin/magento`; acepta atajos (`s:up`) y palabras clave.                                                   |
| `lookup-webapi`       | `query`, `api?`, `method?`, `limit?` | Endpoints REST (parámetros, cuerpo, que token los llama) y queries y mutations de GraphQL (argumentos, retorno, ejemplo, guía).                                    |

**Scaffolding**

| herramienta       | parámetros                                                                                                                           | que genera                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaffold-module` | `module`, `description?`, `packageName?`, `version?`, `license?`, `sequence?`, `php?`, `basePath?`                                   | `registration.php`, `etc/module.xml` y `composer.json`.                                                                                         |
| `add-plugin`      | `module`, `targetClass`, `method`, `type`, `pluginClass?`, `pluginName?`, `area?`, `sortOrder?`, `basePath?`                         | La clase del plugin (before, after o around) y su `di.xml`.                                                                                     |
| `add-observer`    | `module`, `event`, `observerClass?`, `observerName?`, `area?`, `basePath?`                                                           | La clase del observer y su `events.xml`.                                                                                                        |
| `add-controller`  | `module`, `area`, `frontName`, `routeId?`, `controller?`, `action?`, `method?`, `title?`, `aclResource?`, `basePath?`                | `routes.xml` y el controller (página GET o JSON por POST); para páginas, el layout y el template; en `adminhtml`, `ADMIN_RESOURCE` y `acl.xml`. |
| `add-db-schema`   | `module`, `table`, `columns?`, `primaryKey?`, `unique?`, `indexes?`, `foreignKeys?`, `comment?`, `resource?`, `engine?`, `basePath?` | La tabla en `etc/db_schema.xml`, con los pasos del whitelist y de `setup:upgrade`.                                                              |

Las herramientas de scaffolding devuelven también `structuredContent` con `files` (`path`, `content`, `source`) y `notes`. Las rutas son relativas a la raíz de la instalación (`app/code/<Vendor>/<Module>` por defecto). La herramienta no ve el módulo: si el archivo ya existe, el nodo nuevo se fusiona con lo que hay, y las notas lo avisan.

### Resources

| URI                             | contenido                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `adobe-commerce://docs`         | Índice de la documentación por área y carpeta.                                         |
| `adobe-commerce://docs/{id}`    | Una página, por ejemplo `adobe-commerce://docs/php/development/components/plugins.md`. |
| `adobe-commerce://config-files` | Lista de los archivos de configuración del catálogo.                                   |
| `adobe-commerce://sources`      | Repositorios, commits y licencias de los datos.                                        |

### De dónde vienen los datos

Todo sale de los repositorios públicos de documentación de Adobe Commerce, en el commit fijado en [data/fonte.json](data/fonte.json):

| repositorio                                                                             | licencia   | que aporta                                                                                                            |
| --------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| [AdobeDocs/commerce-php](https://github.com/AdobeDocs/commerce-php)                     | Apache-2.0 | 807 páginas: extensiones PHP, arquitectura, tutoriales, estándares de código, referencia de módulos.                  |
| [AdobeDocs/commerce-frontend-core](https://github.com/AdobeDocs/commerce-frontend-core) | Apache-2.0 | 262 páginas: temas, layouts, templates, UI components, JavaScript, Page Builder.                                      |
| [AdobeDocs/commerce-webapi](https://github.com/AdobeDocs/commerce-webapi)               | Apache-2.0 | 532 páginas de guías REST y GraphQL, el esquema OpenAPI 2.4.9 y la referencia generada de GraphQL 2.4.9.              |
| [AdobeDocs/commerce-operations.en](https://github.com/AdobeDocs/commerce-operations.en) | MIT        | 295 páginas: configuración, CLI, instalación, rendimiento, seguridad, actualización y la referencia de `bin/magento`. |

Quedaron fuera las notas de versión, las mas de 900 páginas de parches del Quality Patches Tool, las herramientas de monitoreo en la nube y la referencia de GraphQL de versiones anteriores. El código y los XSD de `magento/magento2` no se usan: su licencia (OSL-3.0) no es compatible con la MIT de este paquete. Los templates de scaffolding se adaptaron de los ejemplos de la documentación.

Las licencias de las fuentes van en [data/licenses/](data/licenses/) y el detalle, en [NOTICE](NOTICE). Este proyecto no está afiliado a Adobe ni cuenta con su respaldo.

### Estructura

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

### Desarrollo

```bash
npm install
npm run check
```

| comando                        | que hace                                                                                   |
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

Convenciones: TypeScript con módulos ESM; Prettier sin punto y coma y con comillas simples. Las descripciones de las herramientas van en inglés, porque es lo que el modelo lee para elegirlas. El conocimiento es de solo lectura en tiempo de ejecución: nada se escribe en disco ni se descarga.

### Actualizar la documentación

1. Clona en una misma carpeta `AdobeDocs/commerce-php`, `commerce-frontend-core`, `commerce-webapi` y `commerce-operations.en` (un clon superficial alcanza).
2. Corre `npm run ingerir -- <carpeta>`. El script solo lee los archivos de texto; nada de los clones se ejecuta.
3. La ingestión falla si una entrada del catálogo de configuración cita una página que no existe o una URN que no aparece en sus fuentes.
4. Corre `npm run check` y commitea `data/`: el paquete lo necesita.

### Ramas y publicación

El trabajo nace en una rama salida de `dev` y el PR va contra `dev`. De ahí se promueve a `qa` y, después de probar, a `main`, siempre con merge de la rama completa. El CI corre `npm run check` en Node 18, 20 y 22.

Para publicar, sube la versión en `package.json`, `server.json` y `CHANGELOG.md` y empuja un tag `v*`: el workflow `publish.yml` corre el gate, publica en npm con _provenance_, crea el GitHub Release y publica `server.json` en el MCP Registry. Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).

## Contribuir · Licencia

Abre un PR contra `dev`, con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) y `npm run check` en verde.

[MIT](LICENSE). Los datos de `data/` conservan las licencias de sus fuentes (Apache-2.0 y MIT): mira [NOTICE](NOTICE).

---

Hecho por [commente.me](https://commente.me) · hola@commente.me
