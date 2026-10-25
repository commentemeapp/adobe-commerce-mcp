import { z } from 'zod'
import { AREAS } from '../knowledge/loader.js'
import { searchDocs } from '../knowledge/search.js'
import { text } from './result.js'

export const searchDocsSchema = {
  query: z
    .string()
    .min(1)
    .describe(
      'Keywords to look for in the official Adobe Commerce docs (e.g. "plugin around method", "declarative schema foreign key", "message queue consumer", "full page cache private content")'
    ),
  area: z
    .enum(AREAS)
    .optional()
    .describe(
      'Restrict to one doc set: php (PHP extensions), frontend (themes, layouts, UI components, JS), webapi (REST and GraphQL guides), operations (configuration, CLI, installation, performance)'
    ),
  limit: z.number().int().min(1).max(20).optional().describe('Max results (default 5, max 20)'),
}

export async function searchDocsTool({
  query,
  area,
  limit,
}: {
  query: string
  area?: (typeof AREAS)[number]
  limit?: number
}) {
  const hits = searchDocs(query, { area, limit })
  if (!hits.length) {
    return text(
      `No results for "${query}"${area ? ` in area ${area}` : ''}. Try other keywords or drop the area filter.`
    )
  }
  const lines = [`# Results for "${query}"${area ? ` (area: ${area})` : ''}`, '']
  for (const h of hits) {
    const heading = h.section.l > 1 ? ` > ${h.section.h}` : ''
    const url = h.section.l > 1 && h.section.a ? `${h.doc.url}#${h.section.a}` : h.doc.url
    lines.push(`## ${h.doc.title}${heading}`)
    lines.push(`- URL: ${url}`)
    lines.push(`- Source: \`${h.doc.source}\``)
    lines.push(
      `- Read it: \`read-doc\` with \`${h.doc.id}${h.section.l > 1 && h.section.a ? `#${h.section.a}` : ''}\``
    )
    lines.push('')
    lines.push(h.excerpt)
    lines.push('')
  }
  return text(lines.join('\n'))
}
