import { z } from 'zod'
import {
  loadGraphql,
  loadRest,
  type GraphqlOperation,
  type RestEndpoint,
} from '../knowledge/loader.js'
import { text } from './result.js'

export const lookupWebapiSchema = {
  query: z
    .string()
    .min(1)
    .describe(
      'GraphQL query or mutation name (e.g. "products", "addProductsToCart"), REST path (e.g. "/V1/products/{sku}", "V1/orders"), or keywords (e.g. "cart coupon", "customer address")'
    ),
  api: z.enum(['rest', 'graphql']).optional().describe('Limit to REST or GraphQL'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    .optional()
    .describe('REST only: HTTP method'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe('Max results for keyword search (default 10)'),
}

function renderGraphql(op: GraphqlOperation, version: string): string {
  const lines = [
    `# GraphQL ${op.kind}: \`${op.name}\``,
    '',
    op.description,
    '',
    `Returns: \`${op.returns}\``,
    '',
  ]
  if (op.arguments.length) {
    lines.push('## Arguments', '')
    for (const a of op.arguments)
      lines.push(`- \`${a.name}\`: \`${a.type}\`${a.description ? `. ${a.description}` : ''}`)
    lines.push('')
  }
  if (op.example) lines.push('## Example', '', '```graphql', op.example, '```', '')
  lines.push(`> Schema reference (Adobe Commerce ${version}): ${op.referenceUrl}`)
  if (op.guide)
    lines.push(`> Guide: ${op.guide.url} (read it with \`read-doc\` \`${op.guide.id}\`)`)
  return lines.join('\n')
}

function renderRest(list: RestEndpoint[], basePath: string, version: string, url: string): string {
  const lines: string[] = []
  for (const e of list) {
    lines.push(`# ${e.method} ${e.path}`, '', e.description || '(no description)', '')
    lines.push(`- operationId: \`${e.operationId}\``)
    lines.push(
      `- Base path in the reference schema: \`${basePath}\` (e.g. \`${basePath}${e.path}\`)`
    )
    lines.push(
      `- Available with: ${e.access.join(', ')} token${e.access.includes('guest') ? ' (guest: no token)' : ''}`
    )
    if (e.returns) lines.push(`- Returns: \`${e.returns}\``)
    if (e.parameters.length) {
      lines.push('', '## Parameters', '')
      for (const p of e.parameters) {
        lines.push(
          `- \`${p.name}\` (${p.in}${p.required ? ', required' : ''}): \`${p.type}\`${p.description ? `. ${p.description}` : ''}`
        )
      }
    }
    if (e.body?.length) {
      lines.push('', '## Body', '')
      for (const b of e.body)
        lines.push(`- \`${b.name}\`${b.required ? ' (required)' : ''}: \`${b.type}\``)
    }
    lines.push('')
  }
  lines.push(
    `> REST reference for Adobe Commerce ${version} (PaaS and Magento Open Source): ${url}`
  )
  return lines.join('\n')
}

function normalizePath(p: string): string {
  return ('/' + p.trim().replace(/^\/+/, ''))
    .replace(/^\/rest\/[^/]+(?=\/V\d)/i, '')
    .replace(/^\/rest(?=\/V\d)/i, '')
    .replace(/\{[^}]+\}|:[A-Za-z_]+/g, '{}')
    .replace(/\/+$/, '')
    .toLowerCase()
}

export async function lookupWebapi({
  query,
  api,
  method,
  limit = 10,
}: {
  query: string
  api?: 'rest' | 'graphql'
  method?: string
  limit?: number
}) {
  const gql = loadGraphql()
  const rest = loadRest()
  const q = query.trim()

  if (api !== 'rest') {
    const op = gql.operations.find((o) => o.name.toLowerCase() === q.toLowerCase())
    if (op) return text(renderGraphql(op, gql.version))
  }

  if (api !== 'graphql' && /^\/?(rest\/[^/]+\/)?V\d/i.test(q)) {
    const target = normalizePath(q)
    const hits = rest.endpoints.filter(
      (e) => normalizePath(e.path) === target && (!method || e.method === method)
    )
    if (hits.length) return text(renderRest(hits, rest.basePath, rest.version, rest.referenceUrl))
    const prefix = rest.endpoints.filter(
      (e) => normalizePath(e.path).startsWith(target) && (!method || e.method === method)
    )
    if (prefix.length) {
      const lines = [`# REST endpoints under ${q}`, '']
      for (const e of prefix.slice(0, 40))
        lines.push(`- \`${e.method} ${e.path}\`: ${e.description}`)
      if (prefix.length > 40) lines.push(`- ... and ${prefix.length - 40} more`)
      return text(lines.join('\n'))
    }
  }

  // keyword search
  const words = q
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length > 1)
  const score = (hay: string, name: string) =>
    words.reduce((s, w) => s + (name.includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0)
  type Hit = { s: number; line: string }
  const hits: Hit[] = []
  if (api !== 'rest') {
    for (const o of gql.operations) {
      const s = score(`${o.name} ${o.description}`.toLowerCase(), o.name.toLowerCase())
      if (s)
        hits.push({ s, line: `- GraphQL ${o.kind} \`${o.name}\`: ${o.description.split('\n')[0]}` })
    }
  }
  if (api !== 'graphql') {
    for (const e of rest.endpoints) {
      if (method && e.method !== method) continue
      const s = score(
        `${e.path} ${e.description} ${e.tags.join(' ')}`.toLowerCase(),
        e.path.toLowerCase()
      )
      if (s) hits.push({ s, line: `- REST \`${e.method} ${e.path}\`: ${e.description}` })
    }
  }
  if (!hits.length) {
    return text(
      `Nothing matches "${query}". The data has ${gql.operations.length} GraphQL operations and ${rest.endpoints.length} REST endpoints (Adobe Commerce ${rest.version}).`,
      true
    )
  }
  hits.sort((a, b) => b.s - a.s)
  const lines = [`# Web API matching "${query}"`, '', ...hits.slice(0, limit).map((h) => h.line)]
  lines.push(
    '',
    'Call lookup-webapi again with the exact GraphQL name or REST path for the details.'
  )
  return text(lines.join('\n'))
}
