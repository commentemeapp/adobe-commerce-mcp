import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  AREAS,
  AREA_LABELS,
  findDoc,
  loadConfigFiles,
  loadDocs,
  loadSources,
  renderDoc,
} from '../knowledge/index.js'

export function registerResources(server: McpServer) {
  server.registerResource(
    'adobe-commerce-docs-index',
    'adobe-commerce://docs',
    {
      title: 'Adobe Commerce docs index',
      description:
        'Index of the bundled official Adobe Commerce documentation (PHP, frontend core, Web APIs, operations), grouped by area and folder',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const lines = [
        '# Adobe Commerce documentation (offline)',
        '',
        'Read a page with the resource `adobe-commerce://docs/{id}` or the `read-doc` tool; find pages with `search-docs`.',
        '',
      ]
      for (const area of AREAS) {
        const docs = loadDocs(area)
        lines.push(`## ${area}: ${AREA_LABELS[area]} (${docs.length} pages)`, '')
        const folders = new Map<string, number>()
        for (const d of docs) {
          const parts = d.id.split('/')
          const folder = parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0]
          folders.set(folder, (folders.get(folder) ?? 0) + 1)
        }
        for (const [f, n] of [...folders].sort()) lines.push(`- \`${f}/\` (${n})`)
        lines.push('')
      }
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] }
    }
  )

  server.registerResource(
    'adobe-commerce-doc',
    new ResourceTemplate('adobe-commerce://docs/{+id}', { list: undefined }),
    {
      title: 'Adobe Commerce doc page',
      description:
        'One page of the bundled documentation by id, e.g. adobe-commerce://docs/php/development/components/plugins.md',
      mimeType: 'text/markdown',
    },
    async (uri, variables) => {
      const id = Array.isArray(variables.id) ? variables.id.join('/') : String(variables.id ?? '')
      const found = findDoc(decodeURIComponent(id))
      const text = found
        ? `> Source: \`${found.doc.source}\`\n> URL: ${found.doc.url}\n\n${renderDoc(found.doc) ?? ''}`
        : `Page "${id}" not found. See adobe-commerce://docs.`
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] }
    }
  )

  server.registerResource(
    'adobe-commerce-config-files',
    'adobe-commerce://config-files',
    {
      title: 'Module configuration files',
      description:
        'Catalog of module configuration files (di.xml, events.xml, db_schema.xml...) with location, XSD URN and docs',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const lines = [
        '# Module configuration files',
        '',
        'Details of each one: `explain-config-file`.',
        '',
      ]
      for (const e of loadConfigFiles()) {
        lines.push(`- \`${e.file}\`: ${e.title}. ${e.location.map((l) => `\`${l}\``).join(', ')}`)
      }
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] }
    }
  )

  server.registerResource(
    'adobe-commerce-sources',
    'adobe-commerce://sources',
    {
      title: 'Data sources and licenses',
      description: 'Repositories, commits and licenses of the bundled documentation',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(loadSources(), null, 2),
        },
      ],
    })
  )
}
