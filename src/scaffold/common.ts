import { z } from 'zod'
import { findDoc, loadCli } from '../knowledge/loader.js'

export interface GeneratedFile {
  path: string
  content: string
  /** documentation page the template was adapted from */
  source: string
}

export const outputSchema = {
  files: z
    .array(
      z.object({
        path: z.string().describe('Path relative to the Commerce root'),
        content: z.string(),
        source: z.string().describe('Documentation page the template was adapted from'),
      })
    )
    .describe('Files to write. The server never writes to disk.'),
  notes: z.array(z.string()).describe('Next steps and caveats'),
}

const MODULE_NAME = /^([A-Z][A-Za-z0-9]*)_([A-Z][A-Za-z0-9]*)$/
const PHP_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const PHP_FQCN = /^\\?[A-Za-z_][A-Za-z0-9_]*(\\[A-Za-z_][A-Za-z0-9_]*)*$/

export class ScaffoldError extends Error {}

export interface ModuleName {
  full: string
  vendor: string
  module: string
  namespace: string
  basePath: string
}

export const moduleNameSchema = z
  .string()
  .describe('Module name as Vendor_Module (e.g. "Acme_Reviews"), as registered in registration.php')

export const basePathSchema = z
  .string()
  .optional()
  .describe('Module directory relative to the Commerce root (default "app/code/<Vendor>/<Module>")')

export function parseModule(name: string, basePath?: string): ModuleName {
  const m = MODULE_NAME.exec(name.trim())
  if (!m) {
    throw new ScaffoldError(
      `Invalid module name "${name}". Use Vendor_Module, both parts starting with an uppercase letter and only letters and digits (e.g. Acme_Reviews).`
    )
  }
  const base = (basePath ?? `app/code/${m[1]}/${m[2]}`).replace(/\\/g, '/').replace(/\/+$/, '')
  if (base.includes('..') || base.startsWith('/')) {
    throw new ScaffoldError(
      `basePath must be relative to the Commerce root and cannot contain "..".`
    )
  }
  return { full: m[0], vendor: m[1], module: m[2], namespace: `${m[1]}\\${m[2]}`, basePath: base }
}

export function assertPhpName(value: string, what: string): string {
  if (!PHP_NAME.test(value))
    throw new ScaffoldError(`Invalid ${what} "${value}": use letters, digits and "_".`)
  return value
}

export function assertFqcn(value: string, what: string): string {
  const v = value.trim().replace(/^\\/, '')
  if (!PHP_FQCN.test(v))
    throw new ScaffoldError(
      `Invalid ${what} "${value}": expected a PHP class name like Magento\\Catalog\\Model\\Product.`
    )
  return v
}

export function assertIdentifier(value: string, what: string, pattern = /^[a-z0-9_]+$/): string {
  if (!pattern.test(value)) throw new ScaffoldError(`Invalid ${what} "${value}".`)
  return value
}

export function pascal(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

export function snake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase()
}

export function kebab(value: string): string {
  return snake(value).replace(/_/g, '-')
}

export function xmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function phpString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Opening of every generated PHP file: the technical guidelines require strict types in new files. */
export const PHP_OPEN = '<?php\ndeclare(strict_types=1);\n'

/** Public URL of a bundled document; fails loudly if the id is wrong, so templates never cite a page that is not in data/. */
export function docUrl(id: string, anchor?: string): string {
  const found = findDoc(id)
  if (!found) throw new Error(`Template source ${id} is not in data/docs`)
  if (anchor && !found.doc.sections.some((s) => s.a === anchor)) {
    throw new Error(`Template source ${id} has no section #${anchor}`)
  }
  return anchor ? `${found.doc.url}#${anchor}` : found.doc.url
}

/** A bin/magento command, checked against the bundled CLI reference. */
export function cli(command: string): string {
  const name = command.split(/\s+/)[0]
  if (!loadCli().commands.some((c) => c.name === name))
    throw new Error(`Unknown CLI command ${name}`)
  return `bin/magento ${command}`
}

export const AREA_EVENTS = [
  'global',
  'adminhtml',
  'crontab',
  'frontend',
  'graphql',
  'webapi_rest',
  'webapi_soap',
] as const
export const AREA_DI = [
  'global',
  'adminhtml',
  'frontend',
  'graphql',
  'webapi_rest',
  'webapi_soap',
  'crontab',
] as const

export function etcPath(mod: ModuleName, area: string, file: string): string {
  return area === 'global' ? `${mod.basePath}/etc/${file}` : `${mod.basePath}/etc/${area}/${file}`
}

function lang(path: string): string {
  if (path.endsWith('.php') || path.endsWith('.phtml')) return 'php'
  if (path.endsWith('.xml')) return 'xml'
  if (path.endsWith('.json')) return 'json'
  return 'text'
}

export function scaffoldResult(title: string, files: GeneratedFile[], notes: string[]) {
  const lines = [
    `# ${title}`,
    '',
    'Files to write (the server does not write anything to disk):',
    '',
  ]
  for (const f of files) lines.push(`- \`${f.path}\``)
  lines.push('')
  for (const f of files) {
    lines.push(
      `## \`${f.path}\``,
      '',
      `Adapted from: ${f.source}`,
      '',
      '```' + lang(f.path),
      f.content.trimEnd(),
      '```',
      ''
    )
  }
  if (notes.length) {
    lines.push('## Next steps', '')
    for (const n of notes) lines.push(`- ${n}`)
  }
  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
    structuredContent: { files, notes },
  }
}

export function scaffoldError(e: unknown) {
  if (e instanceof ScaffoldError) {
    return { content: [{ type: 'text' as const, text: e.message }], isError: true }
  }
  throw e
}
