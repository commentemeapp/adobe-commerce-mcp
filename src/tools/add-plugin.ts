import { z } from 'zod'
import {
  AREA_DI,
  PHP_OPEN,
  ScaffoldError,
  assertFqcn,
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

export const addPluginSchema = {
  module: moduleNameSchema,
  targetClass: z
    .string()
    .describe(
      'Class or interface whose public method is intercepted (e.g. "Magento\\Catalog\\Model\\Product")'
    ),
  method: z.string().describe('Public method to intercept (e.g. "getName", "save")'),
  type: z
    .enum(['before', 'after', 'around'])
    .describe('Plugin type. The docs advise after over around unless the chain must be stopped.'),
  pluginClass: z
    .string()
    .optional()
    .describe('Plugin class name inside <Module>\\Plugin (default "<TargetShortName>Plugin")'),
  pluginName: z
    .string()
    .optional()
    .describe('Plugin name in di.xml (default "<vendor>_<module>_<target>_<method>")'),
  area: z
    .enum(AREA_DI)
    .optional()
    .describe('di.xml area: global (etc/di.xml) or an area folder (default global)'),
  sortOrder: z.number().int().optional().describe('sortOrder attribute in di.xml'),
  basePath: basePathSchema,
}

export async function addPlugin(args: {
  module: string
  targetClass: string
  method: string
  type: 'before' | 'after' | 'around'
  pluginClass?: string
  pluginName?: string
  area?: (typeof AREA_DI)[number]
  sortOrder?: number
  basePath?: string
}) {
  try {
    const mod = parseModule(args.module, args.basePath)
    const target = assertFqcn(args.targetClass, 'targetClass')
    const method = assertPhpName(args.method, 'method')
    if (method === '__construct' || method === '__destruct') {
      throw new ScaffoldError('Plugins cannot be used on __construct and __destruct.')
    }
    const short = target.split('\\').pop()!
    const cls = assertPhpName(args.pluginClass ?? `${short}Plugin`, 'pluginClass')
    const area = args.area ?? 'global'
    const fqcn = `${mod.namespace}\\Plugin\\${cls}`
    // naming convention: capitalize the first letter, unless the method starts with "_"
    const suffix = method.startsWith('_')
      ? method
      : method.charAt(0).toUpperCase() + method.slice(1)
    const pluginMethod = `${args.type}${suffix}`
    const name =
      args.pluginName ??
      `${snake(mod.vendor)}_${snake(mod.module)}_${snake(short)}_${snake(method)}`

    let body: string
    if (args.type === 'before') {
      body = `    /**
     * Runs before ${short}::${method}(). Return an array with the (modified) arguments, or null to keep them.
     */
    public function ${pluginMethod}(${short} $subject, ...$args): ?array
    {
        return null;
    }`
    } else if (args.type === 'after') {
      body = `    /**
     * Runs after ${short}::${method}(). Receives the result and the original arguments, and must return the result.
     */
    public function ${pluginMethod}(${short} $subject, $result, ...$args)
    {
        return $result;
    }`
    } else {
      body = `    /**
     * Runs around ${short}::${method}(). Forward the arguments to $proceed; not calling it stops
     * the remaining plugins and the original method.
     */
    public function ${pluginMethod}(${short} $subject, callable $proceed, ...$args)
    {
        return $proceed(...$args);
    }`
    }

    const php = `${PHP_OPEN}
namespace ${mod.namespace}\\Plugin;

use ${target};

class ${cls}
{
${body}
}
`
    const attrs = [`name="${xmlAttr(name)}"`, `type="${xmlAttr(fqcn)}"`]
    if (args.sortOrder !== undefined) attrs.push(`sortOrder="${args.sortOrder}"`)
    const di = `<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:ObjectManager/etc/config.xsd">
    <type name="${xmlAttr(target)}">
        <plugin ${attrs.join(' ')}/>
    </type>
</config>
`
    const plugins = 'php/development/components/plugins.md'
    const files: GeneratedFile[] = [
      {
        path: `${mod.basePath}/Plugin/${cls}.php`,
        content: php,
        source: docUrl(plugins, `${args.type}-methods`),
      },
      {
        path: etcPath(mod, area, 'di.xml'),
        content: di,
        source: docUrl(plugins, 'declaring-a-plugin'),
      },
    ]
    const notes = [
      `If ${etcPath(mod, area, 'di.xml')} already exists, merge the <type> node into it instead of replacing the file.`,
      `Replace \`...$args\` with the exact parameters of ${short}::${method}(), keeping their types and defaults: the docs require the plugin to match the original signature.`,
      `Plugins do not work on final classes or methods, non-public or static methods, __construct and __destruct, virtual types, or objects created before Magento\\Framework\\Interception is bootstrapped (${docUrl(plugins, 'limitations')}).`,
      `After new classes or di.xml changes, run \`${cli('setup:upgrade')}\` or \`${cli('setup:di:compile')}\` to generate the code (${docUrl('php/tutorials/backend/create-custom-rest-api.md')}).`,
    ]
    if (args.type === 'around') {
      notes.unshift(
        'The docs warn against around plugins when they are not required: they increase stack traces and affect performance. Use an after plugin to change the result.'
      )
    }
    return scaffoldResult(`Plugin ${pluginMethod} on ${target}`, files, notes)
  } catch (e) {
    return scaffoldError(e)
  }
}
