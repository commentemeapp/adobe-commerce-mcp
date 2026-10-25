import { z } from 'zod'
import { findDoc, renderDoc } from '../knowledge/loader.js'
import { text } from './result.js'

export const readDocSchema = {
  ref: z
    .string()
    .min(1)
    .describe(
      'Document id as returned by search-docs (e.g. "php/development/components/plugins.md"), source path (e.g. "commerce-php/src/pages/development/components/plugins.md") or public URL. Append "#anchor" to read one section.'
    ),
  section: z
    .string()
    .optional()
    .describe('Section anchor or heading to read only that section (e.g. "around-methods")'),
}

export async function readDocTool({ ref, section }: { ref: string; section?: string }) {
  const found = findDoc(ref)
  if (!found) {
    return text(
      `Document "${ref}" not found. Use search-docs to find the id, or the resource adobe-commerce://docs for the index.`,
      true
    )
  }
  const { doc } = found
  let anchor = section ?? found.anchor
  if (anchor && !doc.sections.some((s) => s.a === anchor)) {
    const byHeading = doc.sections.find((s) => s.h.toLowerCase() === anchor!.toLowerCase())
    if (byHeading) anchor = byHeading.a
  }
  const body = renderDoc(doc, anchor)
  if (body === null) {
    const list = doc.sections
      .filter((s) => s.l > 1)
      .map((s) => `- \`${s.a}\`: ${s.h}`)
      .join('\n')
    return text(`Section "${anchor}" not found in ${doc.id}. Sections:\n\n${list}`, true)
  }
  const header = [
    `> Source: \`${doc.source}\` (${doc.repo})`,
    `> URL: ${anchor ? `${doc.url}#${anchor}` : doc.url}`,
    '',
  ].join('\n')
  return text(header + '\n' + body)
}
