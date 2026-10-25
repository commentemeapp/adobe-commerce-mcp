import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { outputSchema } from '../scaffold/common.js'
import { searchDocsSchema, searchDocsTool } from './search-docs.js'
import { readDocSchema, readDocTool } from './read-doc.js'
import { explainConfigFileSchema, explainConfigFile } from './explain-config-file.js'
import { lookupCliCommandSchema, lookupCliCommand } from './lookup-cli-command.js'
import { lookupWebapiSchema, lookupWebapi } from './lookup-webapi.js'
import { scaffoldModuleSchema, scaffoldModule } from './scaffold-module.js'
import { addPluginSchema, addPlugin } from './add-plugin.js'
import { addObserverSchema, addObserver } from './add-observer.js'
import { addControllerSchema, addController } from './add-controller.js'
import { addDbSchemaSchema, addDbSchema } from './add-db-schema.js'

/** Every tool only reads bundled data: nothing is written to disk and nothing goes to the network. */
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

export function registerTools(server: McpServer) {
  server.registerTool(
    'search-docs',
    {
      title: 'Search Adobe Commerce docs',
      description:
        'Search the official Adobe Commerce (Magento Open Source) developer documentation bundled offline: PHP extensions, frontend core, Web APIs and operations. Use it first for any "how do I" question about modules, plugins, DI, events, declarative schema, layouts, caching, indexers, queues or configuration. Returns excerpts with title, public URL and source path; follow up with read-doc.',
      inputSchema: searchDocsSchema,
      annotations: readOnly,
    },
    searchDocsTool
  )

  server.registerTool(
    'read-doc',
    {
      title: 'Read an Adobe Commerce doc page',
      description:
        'Read a full page, or one section, of the bundled Adobe Commerce documentation by id (from search-docs), source path or public developer.adobe.com / experienceleague.adobe.com URL. Use it after search-docs, or when the user pastes a docs link.',
      inputSchema: readDocSchema,
      annotations: readOnly,
    },
    readDocTool
  )

  server.registerTool(
    'explain-config-file',
    {
      title: 'Explain a module config file',
      description:
        'Explain an Adobe Commerce module configuration file (di.xml, events.xml, webapi.xml, db_schema.xml, crontab.xml, routes.xml, system.xml, acl.xml, config.xml, layout, ui_component, schema.graphqls, requirejs-config.js and more): what it is for, where it goes (folder and area), the XSD URN from the docs, and the documentation pages. Use it before creating or editing one of these files.',
      inputSchema: explainConfigFileSchema,
      annotations: readOnly,
    },
    explainConfigFile
  )

  server.registerTool(
    'lookup-cli-command',
    {
      title: 'Look up a bin/magento command',
      description:
        'Look up a bin/magento command of Adobe Commerce on-premises: description, usage, arguments and options, from the official CLI reference. Accepts full names, Symfony shortcuts (s:up) or keywords. Use it before suggesting or running a bin/magento command.',
      inputSchema: lookupCliCommandSchema,
      annotations: readOnly,
    },
    lookupCliCommand
  )

  server.registerTool(
    'lookup-webapi',
    {
      title: 'Look up REST endpoints and GraphQL operations',
      description:
        'Look up Adobe Commerce Web API: REST endpoints (path, method, parameters, body, which tokens can call it) from the official OpenAPI schema, and GraphQL queries and mutations (arguments, return type, example, guide). Accepts a GraphQL name, a REST path or keywords. Use it when writing integrations or storefront calls.',
      inputSchema: lookupWebapiSchema,
      annotations: readOnly,
    },
    lookupWebapi
  )

  server.registerTool(
    'scaffold-module',
    {
      title: 'Scaffold an Adobe Commerce module',
      description:
        'Generate registration.php, etc/module.xml and composer.json for a new Adobe Commerce module (Vendor_Module), adapted from the official docs. Returns the files (path and content) for the caller to write; the server never writes to disk. Use it when starting a module.',
      inputSchema: scaffoldModuleSchema,
      outputSchema,
      annotations: readOnly,
    },
    scaffoldModule
  )

  server.registerTool(
    'add-plugin',
    {
      title: 'Add a plugin (interceptor)',
      description:
        'Generate a before, after or around plugin class and its di.xml declaration for a public method of a class or interface, adapted from the official plugins docs. Returns the files for the caller to write. Use it to change the behavior of a core or third-party method without rewriting the class.',
      inputSchema: addPluginSchema,
      outputSchema,
      annotations: readOnly,
    },
    addPlugin
  )

  server.registerTool(
    'add-observer',
    {
      title: 'Add an event observer',
      description:
        'Generate an observer class and its events.xml subscription (global or per area), adapted from the official events and observers docs. Returns the files for the caller to write. Use it to react to a dispatched event.',
      inputSchema: addObserverSchema,
      outputSchema,
      annotations: readOnly,
    },
    addObserver
  )

  server.registerTool(
    'add-controller',
    {
      title: 'Add a controller and route',
      description:
        'Generate routes.xml, an action controller (GET page or POST JSON) and, for pages, the layout handle and template, for the frontend or adminhtml area (with ADMIN_RESOURCE and acl.xml for the Admin), adapted from the official routing docs. Returns the files for the caller to write.',
      inputSchema: addControllerSchema,
      outputSchema,
      annotations: readOnly,
    },
    addController
  )

  server.registerTool(
    'add-db-schema',
    {
      title: 'Add a table to db_schema.xml',
      description:
        'Generate a declarative schema etc/db_schema.xml table with columns, primary key, unique constraints, foreign keys and indexes, adapted from the official declarative schema docs, plus the whitelist and setup:upgrade steps. Returns the file for the caller to write.',
      inputSchema: addDbSchemaSchema,
      outputSchema,
      annotations: readOnly,
    },
    addDbSchema
  )
}
