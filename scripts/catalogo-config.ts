/**
 * Catálogo dos arquivos de configuração de um módulo de Adobe Commerce, montado lendo as
 * fontes. Cada entrada cita os documentos de onde saiu (`sources`, ids de `data/docs`) e a
 * ingestão falha se uma fonte não existir ou se a URN não aparecer literalmente nelas.
 *
 * `description` e `location` resumem o que essas páginas dizem; nada aqui vem de memória.
 */
export interface EntradaConfig {
  /** nome do arquivo como se pede na tool (ex. `di.xml`, `layout`) */
  file: string
  aliases?: string[]
  title: string
  description: string
  /** onde o arquivo vai, como as fontes o escrevem */
  location: string[]
  /** áreas aceitas, quando as fontes as listam */
  areas?: string[]
  /** URN do XSD, só quando a documentação a dá */
  urn?: string
  sources: string[]
  notes?: string[]
}

export const CATALOGO_CONFIG: EntradaConfig[] = [
  {
    file: 'registration.php',
    title: 'Component registration',
    description:
      'Registers the component (module, theme, language package or library) through the ComponentRegistrar class. Every component must have it in its root directory.',
    location: ['<module root>/registration.php'],
    sources: ['php/development/build/component-registration.md'],
    notes: [
      "Modules: ComponentRegistrar::register(ComponentRegistrar::MODULE, '<VendorName_ModuleName>', __DIR__);",
      'composer.json must load it in autoload.files.',
    ],
  },
  {
    file: 'module.xml',
    title: 'Module declaration',
    description:
      'Declares the module name. Add setup_version only if the module does not use declarative schema; the sequence node declares load-order dependencies on other modules.',
    location: ['<module root>/etc/module.xml'],
    urn: 'urn:magento:framework:Module/etc/module.xsd',
    sources: [
      'php/development/build/component-name.md',
      'php/development/build/component-load-order.md',
    ],
  },
  {
    file: 'composer.json',
    title: 'Composer package of the component',
    description:
      'Gives the component its Composer name and dependencies. type is magento2-module, magento2-theme or magento2-language, and autoload loads registration.php and maps the PSR-4 namespace.',
    location: ['<module root>/composer.json'],
    sources: [
      'php/development/build/component-name.md',
      'php/development/build/composer-integration.md',
      'php/development/build/component-registration.md',
    ],
  },
  {
    file: 'di.xml',
    title: 'Dependency injection configuration',
    description:
      'Configures which dependencies the object manager injects: preferences, type arguments, virtual types, plugins (interceptors), proxies and sensitive or system-specific settings. Global and area-specific files are merged by appending nodes.',
    location: [
      '<module root>/etc/di.xml (global)',
      '<module root>/etc/<area>/di.xml (area-specific)',
    ],
    areas: ['adminhtml', 'frontend', 'graphql', 'webapi_rest', 'webapi_soap', 'crontab'],
    urn: 'urn:magento:framework:ObjectManager/etc/config.xsd',
    sources: [
      'php/development/build/dependency-injection-file.md',
      'php/development/components/plugins.md',
    ],
    notes: [
      'Area-specific di.xml should configure the presentation layer; the global one, the rest.',
      'Plugins are declared with <type name="..."><plugin name="..." type="..."/></type>.',
    ],
  },
  {
    file: 'events.xml',
    title: 'Event observers',
    description:
      'Subscribes observer classes to events. Observer names must be unique per event. The global file watches events in every area; area folders limit the observer to that area.',
    location: ['<module-dir>/etc/events.xml (global)', '<module-dir>/etc/<area>/events.xml'],
    areas: ['adminhtml', 'crontab', 'frontend', 'graphql', 'webapi_rest', 'webapi_soap'],
    urn: 'urn:magento:framework:Event/etc/events.xsd',
    sources: [
      'php/development/components/events-and-observers/index.md',
      'php/development/components/events-and-observers/event-list.md',
    ],
    notes: [
      'Observer classes go under <module-root>/Observer and implement Magento\\Framework\\Event\\ObserverInterface.',
    ],
  },
  {
    file: 'webapi.xml',
    title: 'Web API routes (REST and SOAP)',
    description:
      'Maps REST routes and SOAP operations to service contract interfaces and methods, and sets the resources (ACL) that may call them.',
    location: ['<module root>/etc/webapi.xml'],
    urn: 'urn:magento:module:Magento_Webapi:etc/webapi.xsd',
    sources: [
      'php/development/components/web-api/services.md',
      'php/development/components/web-api/resource-accessibility.md',
      'php/tutorials/backend/create-custom-rest-api.md',
    ],
  },
  {
    file: 'webapi_async.xml',
    title: 'Custom routes for asynchronous and bulk Web API',
    description: 'Defines custom routes for the asynchronous and bulk REST endpoints.',
    location: ['<module root>/etc/webapi_async.xml'],
    urn: 'urn:magento:module:Magento_WebapiAsync:etc/webapi_async.xsd',
    sources: ['php/development/components/web-api/custom-routes.md'],
  },
  {
    file: 'schema.graphqls',
    title: 'GraphQL schema of a module',
    description:
      'Defines or extends the GraphQL schema: queries, mutations, interfaces, types and enumerations, and the resolver classes behind them.',
    location: ['<module_name>/etc/schema.graphqls'],
    sources: [
      'webapi/graphql/develop/index.md',
      'webapi/graphql/develop/extend-existing-schema.md',
      'webapi/graphql/develop/resolvers.md',
    ],
  },
  {
    file: 'db_schema.xml',
    title: 'Declarative schema',
    description:
      'Declares the final desired state of the module database: tables with column, constraint (primary, unique, foreign) and index subnodes. The system adjusts the database to it without per-version install and upgrade scripts.',
    location: ['<Module_Vendor>/<Module_Name>/etc/db_schema.xml'],
    urn: 'urn:magento:framework:Setup/Declaration/Schema/etc/schema.xsd',
    sources: [
      'php/development/components/declarative-schema/configuration.md',
      'php/development/components/declarative-schema/migration-scripts.md',
    ],
    notes: [
      'Valid column xsi:type values: blob, boolean, date, datetime, decimal, float, int, json, real, smallint, text, timestamp, varbinary, varchar.',
      'Generate db_schema_whitelist.json after creating, renaming or dropping tables.',
    ],
  },
  {
    file: 'db_schema_whitelist.json',
    title: 'Declarative schema whitelist',
    description:
      'Records the tables, columns, constraints and indexes the module declared, so that declarative schema can drop or rename them safely. It is generated, not written by hand.',
    location: ['<module_vendor>/<module_name>/etc/db_schema_whitelist.json'],
    sources: [
      'php/development/components/declarative-schema/migration-scripts.md',
      'php/development/components/declarative-schema/configuration.md',
    ],
    notes: ['bin/magento setup:db-declaration:generate-whitelist [options]'],
  },
  {
    file: 'crontab.xml',
    title: 'Cron jobs',
    description:
      'Declares cron jobs of the module: the group, the job name, the class and method to run, and the schedule.',
    location: ['<your component base dir>/<vendorname>/module-<name>/etc/crontab.xml'],
    urn: 'urn:magento:module:Magento_Cron:etc/crontab.xsd',
    sources: [
      'operations/configuration/cron/custom-cron-reference.md',
      'operations/configuration/cron/custom-cron-tutorial.md',
    ],
  },
  {
    file: 'cron_groups.xml',
    title: 'Cron groups',
    description:
      'Declares a new cron group and its configuration options, all of which run in store view scope.',
    location: ['<your component base dir>/<vendorname>/module-<name>/etc/cron_groups.xml'],
    urn: 'urn:magento:module:Magento_Cron:etc/cron_groups.xsd',
    sources: ['operations/configuration/cron/custom-cron-reference.md'],
  },
  {
    file: 'routes.xml',
    title: 'Routes (front names)',
    description:
      'Binds a frontName to the module for a router, so that URLs <frontName>/<controller>/<action> reach the module controllers. Modules can also add themselves before or after another module on an existing route.',
    location: [
      '<module root>/etc/frontend/routes.xml (router id "standard")',
      '<module root>/etc/adminhtml/routes.xml (router id "admin")',
    ],
    areas: ['frontend', 'adminhtml'],
    urn: 'urn:magento:framework:App/etc/routes.xsd',
    sources: ['php/development/components/routing.md', 'php/tutorials/admin/create-admin-page.md'],
  },
  {
    file: 'page_types.xml',
    title: 'Page types',
    description:
      'Declares the page types (layout handles) of the module routes in the frontend area.',
    location: ['<module root>/etc/frontend/page_types.xml'],
    urn: 'urn:magento:framework:View/Layout/etc/page_types.xsd',
    sources: ['php/development/components/routing.md'],
  },
  {
    file: 'system.xml',
    title: 'Admin system configuration',
    description:
      'Manages the system configuration: tabs, sections, groups and fields shown in the Admin under Stores > Configuration.',
    location: ['<module root>/etc/adminhtml/system.xml'],
    urn: 'urn:magento:module:Magento_Config:etc/system_file.xsd',
    sources: [
      'operations/configuration/reference/config-reference-systemxml.md',
      'php/tutorials/admin/create-dynamic-row-configuration.md',
    ],
  },
  {
    file: 'config.xml',
    title: 'Default configuration values',
    description:
      'Sets the default values of configuration paths (for example the options declared in system.xml or the options of a payment method). Files in area folders override the global one for that area only.',
    location: ['<module root>/etc/config.xml'],
    urn: 'urn:magento:module:Magento_Store:etc/config.xsd',
    sources: [
      'php/development/payments-integrations/base-integration/payment-option-config.md',
      'php/development/build/required-configuration-files.md',
    ],
  },
  {
    file: 'acl.xml',
    title: 'Access control list resources',
    description:
      'Declares ACL resources (Vendor_ModuleName::resourceName) under Magento_Backend::admin. Admin controllers and web API routes reference them.',
    location: ['<module root>/etc/acl.xml'],
    urn: 'urn:magento:framework:Acl/etc/acl.xsd',
    sources: [
      'php/tutorials/backend/create-access-control-list-rule.md',
      'php/development/security/authorization.md',
    ],
    notes: ['Admin controllers restrict access with the ADMIN_RESOURCE constant.'],
  },
  {
    file: 'menu.xml',
    title: 'Admin menu',
    description:
      'Adds items to the Admin navigation, each with id, title, parent, action and the ACL resource.',
    location: ['<Module Directory>/etc/adminhtml/menu.xml'],
    urn: 'urn:magento:module:Magento_Backend:etc/menu.xsd',
    sources: [
      'php/tutorials/admin/create-admin-page.md',
      'php/development/components/add-admin-grid.md',
    ],
  },
  {
    file: 'extension_attributes.xml',
    title: 'Extension attributes',
    description:
      'Adds extension attributes to interfaces that extend ExtensibleDataInterface, optionally with a join directive and resource permissions.',
    location: ['<Module>/etc/extension_attributes.xml'],
    urn: 'urn:magento:framework:Api/etc/extension_attributes.xsd',
    sources: [
      'php/development/components/attributes.md',
      'php/development/components/add-attributes.md',
    ],
  },
  {
    file: 'indexer.xml',
    title: 'Custom indexer',
    description:
      'Declares an indexer process with attributes such as id, view_id, class, primary and shared_index.',
    location: ['<module root>/etc/indexer.xml'],
    urn: 'urn:magento:framework:Indexer/etc/indexer.xsd',
    sources: ['php/development/components/indexing/custom-indexer.md'],
  },
  {
    file: 'mview.xml',
    title: 'Materialized view (indexer subscriptions)',
    description:
      'Declares the view used by an indexer and the tables it subscribes to, so that "Update by schedule" can track changes.',
    location: ['<module root>/etc/mview.xml'],
    urn: 'urn:magento:framework:Mview/etc/mview.xsd',
    sources: ['php/development/components/indexing/custom-indexer.md'],
  },
  {
    file: 'communication.xml',
    title: 'Message queue topics',
    description:
      'Defines what all message queue communication types have in common: topics, their request and response types, and handlers.',
    location: ['<module>/etc/communication.xml'],
    urn: 'urn:magento:framework:Communication/etc/communication.xsd',
    sources: ['php/development/components/message-queues/configuration.md'],
  },
  {
    file: 'queue_consumer.xml',
    title: 'Message queue consumers',
    description: 'Defines the relationship between an existing queue and its consumer.',
    location: ['<module>/etc/queue_consumer.xml'],
    urn: 'urn:magento:framework-message-queue:etc/consumer.xsd',
    sources: ['php/development/components/message-queues/configuration.md'],
  },
  {
    file: 'queue_topology.xml',
    title: 'Message queue topology',
    description: 'Defines the message routing rules and declares queues and exchanges.',
    location: ['<module>/etc/queue_topology.xml'],
    urn: 'urn:magento:framework-message-queue:etc/topology.xsd',
    sources: ['php/development/components/message-queues/configuration.md'],
  },
  {
    file: 'queue_publisher.xml',
    title: 'Message queue publishers',
    description:
      'Defines which connection and exchange to use to publish messages for a specific topic.',
    location: ['<module>/etc/queue_publisher.xml'],
    urn: 'urn:magento:framework-message-queue:etc/publisher.xsd',
    sources: ['php/development/components/message-queues/configuration.md'],
  },
  {
    file: 'cache.xml',
    title: 'Custom cache type',
    description: 'Declares a new cache type with its name, instance class, label and description.',
    location: ['<module_dir>/etc/cache.xml'],
    urn: 'urn:magento:framework:Cache/etc/cache.xsd',
    sources: ['php/development/cache/partial/cache-type.md'],
  },
  {
    file: 'sections.xml',
    title: 'Private content sections',
    description:
      'Specifies the actions (POST or PUT requests) that invalidate private content (customer data sections) cached in the browser.',
    location: ['Vendor/ModuleName/etc/frontend/sections.xml'],
    urn: 'urn:magento:module:Magento_Customer:etc/sections.xsd',
    sources: ['php/development/cache/page/private-content.md'],
  },
  {
    file: 'csp_whitelist.xml',
    title: 'Content Security Policy whitelist',
    description:
      'Whitelists hosts, and hashes of inline scripts and styles, per CSP policy for the module.',
    location: ["<module root>/etc/csp_whitelist.xml (the custom module's etc folder)"],
    urn: 'urn:magento:module:Magento_Csp:etc/csp_whitelist.xsd',
    sources: ['php/development/security/content-security-policies.md'],
  },
  {
    file: 'widget.xml',
    title: 'Widget declaration',
    description:
      'Declares a widget: its block class, label, description and parameters shown in the Admin.',
    location: ['<module root>/etc/widget.xml'],
    urn: 'urn:magento:module:Magento_Widget:etc/widget.xsd',
    sources: ['php/tutorials/frontend/create-custom-widget.md'],
  },
  {
    file: 'fieldset.xml',
    title: 'Fieldsets to copy between entities',
    description:
      'Declares fieldsets whose fields are copied from one entity to another (for example from quote to order).',
    location: ['<module root>/etc/fieldset.xml'],
    urn: 'urn:magento:framework:DataObject/etc/fieldset.xsd',
    sources: ['php/tutorials/backend/copy-fieldsets.md'],
  },
  {
    file: 'sales.xml',
    title: 'Sales totals',
    description:
      'Declares totals, for example a custom quote total for a price adjustment, with their class and sort_order.',
    location: ['VENDOR/MODULE/etc/sales.xml'],
    urn: 'urn:magento:module:Magento_Sales:etc/sales.xsd',
    sources: ['php/development/components/price-adjustments.md'],
  },
  {
    file: 'import.xml',
    title: 'Import entity',
    description:
      'Declares a custom import entity and its model, listed with the import entities under System > Import.',
    location: ['<module root>/etc/import.xml'],
    urn: 'urn:magento:module:Magento_ImportExport:etc/import.xsd',
    sources: ['php/tutorials/backend/create-custom-import-entity.md'],
  },
  {
    file: 'layout',
    aliases: ['layout.xml', 'page_configuration', 'page-configuration'],
    title: 'Page configuration (layout) file',
    description:
      'Declares the structure of a page for a layout handle: containers, blocks, references and arguments. The file name is the handle, routeId_controller_action.xml for controller pages.',
    location: [
      '<module_dir>/view/<area>/layout/<handle>.xml',
      '<theme_dir>/<Vendor>_<Module>/layout/<handle>.xml (theme override)',
    ],
    areas: ['frontend', 'adminhtml', 'base'],
    urn: 'urn:magento:framework:View/Layout/etc/page_configuration.xsd',
    sources: [
      'frontend/guide/layouts/types.md',
      'frontend/guide/layouts/extend.md',
      'php/tutorials/admin/create-admin-page.md',
    ],
  },
  {
    file: 'page_layout',
    aliases: ['page-layout'],
    title: 'Page layout file',
    description:
      'Declares the wireframe of a page (for example 2columns-left) with containers only.',
    location: [
      '<module_dir>/view/<area>/page_layout/<name>.xml',
      '<theme_dir>/<Vendor>_<Module>/page_layout/<name>.xml',
    ],
    urn: 'urn:magento:framework:View/Layout/etc/page_layout.xsd',
    sources: ['frontend/guide/layouts/types.md', 'frontend/guide/layouts/create.md'],
  },
  {
    file: 'layouts.xml',
    title: 'Page layouts declaration',
    description: 'Lists the page layouts available, so that a new page layout can be chosen.',
    location: [
      'app/design/frontend/<VendorName>/<ThemeName>/Magento_Theme/layouts.xml',
      '<module_dir>/view/frontend/layouts.xml',
    ],
    urn: 'urn:magento:framework:View/PageLayout/etc/layouts.xsd',
    sources: ['frontend/guide/layouts/create.md', 'frontend/guide/layouts/types.md'],
  },
  {
    file: 'ui_component',
    aliases: ['ui-component', 'ui_component.xml'],
    title: 'UI component configuration',
    description:
      'Configures a UI component (listing, form and others) in a dedicated XML file named after the component.',
    location: ['<module_dir>/view/adminhtml/ui_component/<ui_component_name>.xml'],
    urn: 'urn:magento:module:Magento_Ui:etc/ui_configuration.xsd',
    sources: ['frontend/ui-components/index.md', 'frontend/ui-components/components/form.md'],
  },
  {
    file: 'requirejs-config.js',
    aliases: ['requirejs'],
    title: 'RequireJS configuration',
    description:
      'Declares RequireJS paths, maps, shims and mixins for JavaScript of a module or theme.',
    location: [
      '<module_dir>/view/<area>/requirejs-config.js (base, frontend, adminhtml)',
      '<theme_dir>/requirejs-config.js',
      '<theme_dir>/<module_dir>/requirejs-config.js',
    ],
    areas: ['base', 'frontend', 'adminhtml'],
    sources: ['frontend/javascript/custom.md', 'frontend/javascript/mixins.md'],
  },
  {
    file: 'theme.xml',
    title: 'Theme declaration',
    description:
      'Declares a theme: at least its title, and optionally the parent theme and the preview image.',
    location: ['app/design/frontend/<Vendor>/<theme>/theme.xml'],
    urn: 'urn:magento:framework:Config/etc/theme.xsd',
    sources: ['frontend/guide/themes/create-storefront.md', 'frontend/guide/themes/inheritance.md'],
  },
  {
    file: 'view.xml',
    title: 'Theme view configuration',
    description:
      'Configures product image sizes and other storefront properties of a theme. Required for a theme, optional if it exists in the parent theme.',
    location: ['<theme_dir>/etc/view.xml'],
    urn: 'urn:magento:framework:Config/etc/view.xsd',
    sources: [
      'frontend/guide/themes/create-storefront.md',
      'frontend/page-builder/viewports/index.md',
    ],
  },
  {
    file: 'env.php',
    title: 'Environment configuration (app/etc/env.php)',
    description:
      'Holds the environment settings of the installation, in sections such as backend, cache, cron, crypt (the encryption key), db (database connections) and the message queue connections.',
    location: ['<Commerce root>/app/etc/env.php'],
    sources: ['operations/configuration/reference/config-reference-envphp.md'],
  },
  {
    file: 'config.php',
    title: 'Shared configuration (app/etc/config.php)',
    description:
      'Holds the shared configuration: the list of enabled and disabled modules, the scopes (websites, store groups and stores), inline translation data and the system configuration required for static content deployment.',
    location: ['<Commerce root>/app/etc/config.php'],
    sources: ['operations/configuration/reference/config-reference-configphp.md'],
  },
]
