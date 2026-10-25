import { z } from 'zod'
import { loadConfigFiles, type ConfigFileEntry } from '../knowledge/loader.js'
import { text } from './result.js'

export const explainConfigFileSchema = {
  file: z
    .string()
    .min(1)
    .describe(
      'Config file name or path inside a module (e.g. "di.xml", "etc/adminhtml/system.xml", "db_schema.xml", "crontab.xml", "webapi.xml", "view/frontend/layout/catalog_product_view.xml", "requirejs-config.js")'
    ),
}

export function findConfigFile(input: string): ConfigFileEntry | null {
  const entries = loadConfigFiles()
  const raw = input.trim().replace(/\\/g, '/')
  const lower = raw.toLowerCase()
  const name = lower.split('/').pop() ?? lower
  const exact = entries.find(
    (e) => e.file.toLowerCase() === name || e.aliases?.some((a) => a.toLowerCase() === name)
  )
  if (exact) return exact
  // view/<area>/layout/<handle>.xml, view/<area>/page_layout/<name>.xml, ui_component/<name>.xml
  for (const folder of ['page_layout', 'layout', 'ui_component']) {
    if (lower.includes(`/${folder}/`) || lower.startsWith(`${folder}/`)) {
      return entries.find((e) => e.file === folder) ?? null
    }
  }
  return null
}

export async function explainConfigFile({ file }: { file: string }) {
  const entry = findConfigFile(file)
  if (!entry) {
    const all = loadConfigFiles()
      .map((e) => `\`${e.file}\``)
      .join(', ')
    return text(
      `No catalog entry for "${file}". Known files: ${all}.\n\nFor anything else, try search-docs.`,
      true
    )
  }
  const lines = [`# ${entry.file}: ${entry.title}`, '', entry.description, '', '## Location', '']
  for (const l of entry.location) lines.push(`- \`${l}\``)
  if (entry.areas?.length) {
    lines.push('', `Areas: ${entry.areas.map((a) => `\`${a}\``).join(', ')}`)
  }
  lines.push('', '## Schema', '')
  if (entry.urn) {
    lines.push(`\`xsi:noNamespaceSchemaLocation="${entry.urn}"\``)
  } else {
    lines.push('The documentation does not give an XSD URN for this file.')
  }
  if (entry.notes?.length) {
    lines.push('', '## Notes', '')
    for (const n of entry.notes) lines.push(`- ${n}`)
  }
  lines.push('', '## Documentation', '')
  for (const l of entry.links) lines.push(`- [${l.title}](${l.url}) (\`${l.id}\`)`)
  lines.push('', 'Read any of them with `read-doc`.')
  return text(lines.join('\n'))
}
