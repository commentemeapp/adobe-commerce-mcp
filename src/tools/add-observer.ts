import { z } from 'zod'
import {
  AREA_EVENTS,
  PHP_OPEN,
  assertIdentifier,
  assertPhpName,
  basePathSchema,
  cli,
  docUrl,
  etcPath,
  moduleNameSchema,
  parseModule,
  pascal,
  scaffoldError,
  scaffoldResult,
  snake,
  xmlAttr,
  type GeneratedFile,
} from '../scaffold/common.js'

export const addObserverSchema = {
  module: moduleNameSchema,
  event: z
    .string()
    .describe(
      'Event name to observe (e.g. "catalog_product_save_after", "checkout_cart_add_product_complete")'
    ),
  observerClass: z
    .string()
    .optional()
    .describe(
      'Observer class name inside <Module>\\Observer (default derived from the event name)'
    ),
  observerName: z.string().optional().describe('Observer name in events.xml (unique per event)'),
  area: z
    .enum(AREA_EVENTS)
    .optional()
    .describe('global (etc/events.xml, all areas) or one area folder (default global)'),
  basePath: basePathSchema,
}

export async function addObserver(args: {
  module: string
  event: string
  observerClass?: string
  observerName?: string
  area?: (typeof AREA_EVENTS)[number]
  basePath?: string
}) {
  try {
    const mod = parseModule(args.module, args.basePath)
    const event = assertIdentifier(args.event.trim(), 'event name', /^[a-z0-9_.]+$/i)
    const cls = assertPhpName(args.observerClass ?? pascal(event), 'observerClass')
    const area = args.area ?? 'global'
    const fqcn = `${mod.namespace}\\Observer\\${cls}`
    const name = args.observerName ?? `${snake(mod.vendor)}_${snake(mod.module)}_${snake(cls)}`

    const php = `${PHP_OPEN}
namespace ${mod.namespace}\\Observer;

use Magento\\Framework\\Event\\Observer;
use Magento\\Framework\\Event\\ObserverInterface;

class ${cls} implements ObserverInterface
{
    public function __construct()
    {
        // Inject the dependencies this observer needs.
    }

    public function execute(Observer $observer)
    {
        // Data passed to dispatch() is available through $observer->getData('<key>').
    }
}
`
    const xml = `<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Event/etc/events.xsd">
    <event name="${xmlAttr(event)}">
        <observer name="${xmlAttr(name)}" instance="${xmlAttr(fqcn)}"/>
    </event>
</config>
`
    const page = 'php/development/components/events-and-observers/index.md'
    const files: GeneratedFile[] = [
      {
        path: `${mod.basePath}/Observer/${cls}.php`,
        content: php,
        source: docUrl(page, 'creating-an-observer'),
      },
      {
        path: etcPath(mod, area, 'events.xml'),
        content: xml,
        source: docUrl(page, 'subscribing-to-events'),
      },
    ]
    const notes = [
      `If ${etcPath(mod, area, 'events.xml')} already exists, add the <event> node to it instead of replacing the file.`,
      `Check the event name and the data it carries in the event list: ${docUrl('php/development/components/events-and-observers/event-list.md')}.`,
      `Clean the configuration cache after changing events.xml: \`${cli('cache:clean config')}\`.`,
    ]
    return scaffoldResult(`Observer ${cls} for ${event}`, files, notes)
  } catch (e) {
    return scaffoldError(e)
  }
}
