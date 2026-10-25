import { z } from 'zod'
import {
  PHP_OPEN,
  ScaffoldError,
  basePathSchema,
  cli,
  docUrl,
  kebab,
  moduleNameSchema,
  parseModule,
  phpString,
  scaffoldError,
  scaffoldResult,
  xmlAttr,
  type GeneratedFile,
} from '../scaffold/common.js'

export const scaffoldModuleSchema = {
  module: moduleNameSchema,
  description: z.string().optional().describe('composer.json description'),
  packageName: z
    .string()
    .optional()
    .describe('Composer package name (default "<vendor>/module-<module>", lowercase)'),
  version: z.string().optional().describe('composer.json version (default "1.0.0")'),
  license: z
    .array(z.string())
    .optional()
    .describe('composer.json license list (default ["proprietary"])'),
  sequence: z
    .array(z.string())
    .optional()
    .describe(
      'Modules that must load before this one, for <sequence> in module.xml (e.g. ["Magento_Catalog"])'
    ),
  php: z
    .string()
    .optional()
    .describe(
      'PHP constraint for composer.json require (e.g. "~8.3.0||~8.4.0"). Omitted when not given.'
    ),
  basePath: basePathSchema,
}

export async function scaffoldModule(args: {
  module: string
  description?: string
  packageName?: string
  version?: string
  license?: string[]
  sequence?: string[]
  php?: string
  basePath?: string
}) {
  try {
    const mod = parseModule(args.module, args.basePath)
    const sequence = (args.sequence ?? []).map((s) => parseModule(s).full)
    const pkg = args.packageName ?? `${mod.vendor.toLowerCase()}/module-${kebab(mod.module)}`
    if (!/^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*$/.test(pkg)) {
      throw new ScaffoldError(`Invalid Composer package name "${pkg}".`)
    }

    const registration = `${PHP_OPEN}
use Magento\\Framework\\Component\\ComponentRegistrar;

ComponentRegistrar::register(ComponentRegistrar::MODULE, ${phpString(mod.full)}, __DIR__);
`

    const seq = sequence.length
      ? `\n        <sequence>\n${sequence.map((s) => `            <module name="${xmlAttr(s)}"/>`).join('\n')}\n        </sequence>\n    `
      : ''
    const moduleXml = `<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Module/etc/module.xsd">
    <module name="${xmlAttr(mod.full)}"${seq ? `>${seq}</module>` : '/>'}
</config>
`

    const composer: Record<string, unknown> = {
      name: pkg,
      description: args.description ?? `${mod.full} module`,
      type: 'magento2-module',
      version: args.version ?? '1.0.0',
      license: args.license ?? ['proprietary'],
    }
    if (args.php) composer.require = { php: args.php }
    composer.autoload = {
      files: ['registration.php'],
      'psr-4': { [`${mod.namespace}\\`]: '' },
    }

    const files: GeneratedFile[] = [
      {
        path: `${mod.basePath}/registration.php`,
        content: registration,
        source: docUrl('php/development/build/component-registration.md'),
      },
      {
        path: `${mod.basePath}/etc/module.xml`,
        content: moduleXml,
        source: docUrl('php/development/build/component-name.md'),
      },
      {
        path: `${mod.basePath}/composer.json`,
        content: JSON.stringify(composer, null, 4) + '\n',
        source: docUrl('php/development/build/composer-integration.md'),
      },
    ]

    const notes = [
      `Enable the module and update the database: \`${cli(`module:enable ${mod.full}`)}\`, then \`${cli('setup:upgrade')}\`.`,
      `module.xml has no setup_version: the docs say to omit it when the module uses declarative schema (${docUrl('php/development/build/component-name.md')}).`,
    ]
    if (sequence.length) {
      notes.push(
        `The docs say a dependency goes in both <sequence> and composer.json "require"; add the Composer packages of ${sequence.join(', ')} with the versions you target (${docUrl('php/development/build/component-load-order.md')}).`
      )
    }
    if (!args.php) {
      notes.push(
        `No PHP constraint was added. The supported PHP versions are in the system requirements: ${docUrl('operations/installation/system-requirements.md')}.`
      )
    }
    if (/^ui$/i.test(mod.module)) {
      notes.push(
        'The docs advise against "Ui" as a module name: the %Vendor%_Ui notation can cause issues.'
      )
    }
    return scaffoldResult(`Module ${mod.full}`, files, notes)
  } catch (e) {
    return scaffoldError(e)
  }
}
