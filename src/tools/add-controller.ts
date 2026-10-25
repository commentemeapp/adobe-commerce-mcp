import { z } from 'zod'
import {
  PHP_OPEN,
  ScaffoldError,
  assertIdentifier,
  basePathSchema,
  cli,
  docUrl,
  moduleNameSchema,
  parseModule,
  pascal,
  phpString,
  scaffoldError,
  scaffoldResult,
  snake,
  xmlAttr,
  type GeneratedFile,
} from '../scaffold/common.js'

export const addControllerSchema = {
  module: moduleNameSchema,
  area: z.enum(['frontend', 'adminhtml']).describe('frontend (storefront) or adminhtml (Admin)'),
  frontName: z
    .string()
    .describe(
      'URL front name: the first URL segment, <frontName>/<controller>/<action> (e.g. "reviews")'
    ),
  routeId: z
    .string()
    .optional()
    .describe('Route id in routes.xml and first part of the layout handle (default: frontName)'),
  controller: z.string().optional().describe('Controller folder (default "Index")'),
  action: z.string().optional().describe('Action class (default "Index")'),
  method: z
    .enum(['GET', 'POST'])
    .optional()
    .describe(
      'HTTP method: GET renders a page with a layout handle, POST returns JSON (default GET)'
    ),
  title: z.string().optional().describe('Page title for GET actions'),
  aclResource: z
    .string()
    .optional()
    .describe(
      'adminhtml only: ACL resource for ADMIN_RESOURCE (default "<Vendor_Module>::<controller>")'
    ),
  basePath: basePathSchema,
}

export async function addController(args: {
  module: string
  area: 'frontend' | 'adminhtml'
  frontName: string
  routeId?: string
  controller?: string
  action?: string
  method?: 'GET' | 'POST'
  title?: string
  aclResource?: string
  basePath?: string
}) {
  try {
    const mod = parseModule(args.module, args.basePath)
    const frontName = assertIdentifier(args.frontName.trim(), 'frontName', /^[a-z][a-z0-9_]*$/)
    const routeId = assertIdentifier(args.routeId ?? frontName, 'routeId', /^[a-z][a-z0-9_]*$/)
    const controller = pascal(args.controller ?? 'Index')
    const action = pascal(args.action ?? 'Index')
    if (!controller || !action)
      throw new ScaffoldError('controller and action must contain letters.')
    const method = args.method ?? 'GET'
    const admin = args.area === 'adminhtml'
    const title = args.title ?? `${controller} ${action}`
    const acl = args.aclResource ?? `${mod.full}::${snake(controller)}`
    if (admin && !/^[A-Z][A-Za-z0-9]*_[A-Z][A-Za-z0-9]*::[A-Za-z0-9_]+$/.test(acl)) {
      throw new ScaffoldError(`Invalid aclResource "${acl}": use Vendor_Module::resource.`)
    }
    const handle = `${routeId}_${controller.toLowerCase()}_${action.toLowerCase()}`
    const ns = `${mod.namespace}\\Controller\\${admin ? 'Adminhtml\\' : ''}${controller}`
    const classPath = `${mod.basePath}/Controller/${admin ? 'Adminhtml/' : ''}${controller}/${action}.php`
    const iface = method === 'GET' ? 'HttpGetActionInterface' : 'HttpPostActionInterface'

    const routing = 'php/development/components/routing.md'
    const adminPage = 'php/tutorials/admin/create-admin-page.md'

    let php: string
    if (method === 'GET') {
      const deps = admin
        ? `use Magento\\Backend\\App\\Action;
use Magento\\Backend\\App\\Action\\Context;
use Magento\\Framework\\App\\Action\\${iface};
use Magento\\Framework\\View\\Result\\Page;
use Magento\\Framework\\View\\Result\\PageFactory;`
        : `use Magento\\Framework\\App\\Action\\${iface};
use Magento\\Framework\\View\\Result\\Page;
use Magento\\Framework\\View\\Result\\PageFactory;`
      const ctor = admin
        ? `    public function __construct(
        Context $context,
        private readonly PageFactory $pageFactory
    ) {
        parent::__construct($context);
    }`
        : `    public function __construct(
        private readonly PageFactory $pageFactory
    ) {
    }`
      php = `${PHP_OPEN}
namespace ${ns};

${deps}

class ${action} ${admin ? 'extends Action ' : ''}implements ${iface}
{
${admin ? `    public const ADMIN_RESOURCE = ${phpString(acl)};\n\n` : ''}${ctor}

    /**
     * Renders the page declared in view/${args.area}/layout/${handle}.xml
     */
    public function execute(): Page
    {
        $page = $this->pageFactory->create();
        $page->getConfig()->getTitle()->prepend(__(${phpString(title)}));

        return $page;
    }
}
`
    } else {
      const deps = admin
        ? `use Magento\\Backend\\App\\Action;
use Magento\\Backend\\App\\Action\\Context;
use Magento\\Framework\\App\\Action\\${iface};
use Magento\\Framework\\Controller\\Result\\Json;
use Magento\\Framework\\Controller\\Result\\JsonFactory;`
        : `use Magento\\Framework\\App\\Action\\${iface};
use Magento\\Framework\\App\\RequestInterface;
use Magento\\Framework\\Controller\\Result\\Json;
use Magento\\Framework\\Controller\\Result\\JsonFactory;`
      const ctor = admin
        ? `    public function __construct(
        Context $context,
        private readonly JsonFactory $jsonFactory
    ) {
        parent::__construct($context);
    }`
        : `    public function __construct(
        private readonly JsonFactory $jsonFactory,
        private readonly RequestInterface $request
    ) {
    }`
      php = `${PHP_OPEN}
namespace ${ns};

${deps}

class ${action} ${admin ? 'extends Action ' : ''}implements ${iface}
{
${admin ? `    public const ADMIN_RESOURCE = ${phpString(acl)};\n\n` : ''}${ctor}

    public function execute(): Json
    {
        $params = $this->${admin ? 'getRequest()' : 'request'}->getParams();

        return $this->jsonFactory->create()->setData(['success' => true]);
    }
}
`
    }

    const routes = `<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:App/etc/routes.xsd">
    <router id="${admin ? 'admin' : 'standard'}">
        <route id="${xmlAttr(routeId)}" frontName="${xmlAttr(frontName)}">
            <module name="${xmlAttr(mod.full)}"/>
        </route>
    </router>
</config>
`
    const files: GeneratedFile[] = [
      {
        path: `${mod.basePath}/etc/${args.area}/routes.xml`,
        content: routes,
        source: admin ? docUrl(adminPage) : docUrl(routing, 'routesxml'),
      },
      {
        path: classPath,
        content: php,
        source: admin ? docUrl(adminPage, 'page-controller') : docUrl(routing, 'action-class'),
      },
    ]

    if (method === 'GET') {
      const layout = `<?xml version="1.0"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <body>
        <referenceContainer name="content">
            <block class="${admin ? 'Magento\\Backend\\Block\\Template' : 'Magento\\Framework\\View\\Element\\Template'}" name="${xmlAttr(`${snake(mod.module)}.${handle}`)}" template="${xmlAttr(`${mod.full}::${handle}.phtml`)}"/>
        </referenceContainer>
    </body>
</page>
`
      files.push({
        path: `${mod.basePath}/view/${args.area}/layout/${handle}.xml`,
        content: layout,
        source: admin ? docUrl(adminPage, 'page-view') : docUrl('frontend/guide/layouts/types.md'),
      })
      files.push({
        path: `${mod.basePath}/view/${args.area}/templates/${handle}.phtml`,
        content: `<?php\n/** @var \\Magento\\Framework\\View\\Element\\Template $block */\n/** @var \\Magento\\Framework\\Escaper $escaper */\n?>\n<p><?= $escaper->escapeHtml(__(${phpString(title)})) ?></p>\n`,
        source: docUrl('php/development/security/cross-site-scripting.md'),
      })
    }

    if (admin) {
      const [modPart, res] = acl.split('::')
      files.push({
        path: `${mod.basePath}/etc/acl.xml`,
        content: `<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Acl/etc/acl.xsd">
    <acl>
        <resources>
            <resource id="Magento_Backend::admin">
                <resource id="${xmlAttr(`${modPart}::${res}`)}" title="${xmlAttr(title)}" sortOrder="10"/>
            </resource>
        </resources>
    </acl>
</config>
`,
        source: docUrl('php/tutorials/backend/create-access-control-list-rule.md'),
      })
    }

    const url = `${frontName}/${controller.toLowerCase()}/${action.toLowerCase()}`
    const notes = [
      admin
        ? `The action answers at <admin front name>/${url}. The create-admin-page tutorial reaches it from an Admin menu item (etc/adminhtml/menu.xml, action="${frontName}/${controller.toLowerCase()}"); explain-config-file menu.xml has the details.`
        : `The action answers at /${url}${controller === 'Index' && action === 'Index' ? ` (and /${frontName})` : ''}.`,
      `If etc/${args.area}/routes.xml already exists, add the <route> to it instead of replacing the file.`,
      `Clean the cache after adding routes or layout: \`${cli('cache:clean')}\`.`,
    ]
    if (method === 'POST' && !admin) {
      notes.push(
        'The application validates the form key on every non-AJAX POST; implement CsrfAwareActionInterface if the action needs another validation.'
      )
    }
    if (admin) {
      notes.push(
        `ADMIN_RESOURCE restricts the controller to admins whose role has ${acl} (${docUrl('php/development/security/authorization.md')}).`
      )
    }
    return scaffoldResult(`${method} controller ${url} (${args.area})`, files, notes)
  } catch (e) {
    return scaffoldError(e)
  }
}
