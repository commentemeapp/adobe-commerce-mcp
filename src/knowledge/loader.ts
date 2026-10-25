import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')

export const AREAS = ['php', 'frontend', 'webapi', 'operations'] as const
export type Area = (typeof AREAS)[number]

export const AREA_LABELS: Record<Area, string> = {
  php: 'PHP development (commerce-php)',
  frontend: 'Frontend core: themes, layouts, UI components, JavaScript (commerce-frontend-core)',
  webapi: 'Web APIs: REST and GraphQL guides (commerce-webapi)',
  operations:
    'Operations: configuration, CLI, installation, performance, upgrade (commerce-operations.en)',
}

export interface Section {
  /** heading */
  h: string
  /** anchor */
  a: string
  /** heading level (1 = page intro) */
  l: number
  /** markdown text */
  t: string
}

export interface Doc {
  id: string
  area: Area
  repo: string
  source: string
  title: string
  description: string
  url: string
  sections: Section[]
}

export interface SourceInfo {
  repo: string
  url: string
  commit: string
  license: string
  licenseFile: string
  licenseHeader: string
  area: Area
  publicUrl: string
  documents: number
}

export interface CliEntry {
  name: string
  aliases: string[]
  description: string
  details: string[]
}

export interface CliCommand {
  name: string
  usage: string
  description: string
  arguments: CliEntry[]
  options: CliEntry[]
}

export interface CliData {
  source: string
  url: string
  version: string
  globalOptions: CliEntry[]
  commands: CliCommand[]
}

export interface RestEndpoint {
  method: string
  path: string
  operationId: string
  description: string
  tags: string[]
  parameters: Array<{
    name: string
    in: string
    required: boolean
    type: string
    description?: string
  }>
  body?: Array<{ name: string; type: string; required: boolean }>
  returns: string
  access: string[]
}

export interface RestData {
  version: string
  title: string
  basePath: string
  source: string
  accessSources: string[]
  referenceUrl: string
  endpoints: RestEndpoint[]
}

export interface GraphqlOperation {
  name: string
  kind: 'query' | 'mutation'
  description: string
  returns: string
  arguments: Array<{ name: string; type: string; description: string }>
  example: string
  referenceUrl: string
  guide?: { id: string; url: string }
}

export interface GraphqlData {
  version: string
  sources: string[]
  operations: GraphqlOperation[]
}

export interface ConfigFileEntry {
  file: string
  aliases?: string[]
  title: string
  description: string
  location: string[]
  areas?: string[]
  urn?: string
  sources: string[]
  notes?: string[]
  links: Array<{ id: string; title: string; url: string }>
}

const cache = new Map<string, unknown>()

function loadJson<T>(...parts: string[]): T {
  const key = parts.join('/')
  if (!cache.has(key)) {
    cache.set(key, JSON.parse(readFileSync(join(DATA_DIR, ...parts), 'utf-8')))
  }
  return cache.get(key) as T
}

export function loadDocs(area?: Area): Doc[] {
  if (area) return loadJson<Doc[]>('docs', `${area}.json`)
  return AREAS.flatMap((a) => loadJson<Doc[]>('docs', `${a}.json`))
}

let docIndex: Map<string, Doc> | null = null
let urlIndex: Map<string, Doc> | null = null
let sourceIndex: Map<string, Doc> | null = null

function normalizeUrl(u: string): string {
  return u
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    .replace(/\.html$/, '')
    .replace(/\/+$/, '')
    .replace('experienceleague.adobe.com/docs/', 'experienceleague.adobe.com/en/docs/')
    .toLowerCase()
}

function buildIndexes() {
  if (docIndex) return
  docIndex = new Map()
  urlIndex = new Map()
  sourceIndex = new Map()
  for (const d of loadDocs()) {
    docIndex.set(d.id, d)
    urlIndex.set(normalizeUrl(d.url), d)
    sourceIndex.set(d.source, d)
  }
}

/**
 * Finds a document by id (`php/development/components/plugins.md`), by source path
 * (`commerce-php/src/pages/development/components/plugins.md`) or by public URL.
 * Returns the anchor of the URL, when there is one.
 */
export function findDoc(ref: string): { doc: Doc; anchor?: string } | null {
  buildIndexes()
  const raw = ref.trim()
  const anchor = /#([^#\s]+)$/.exec(raw)?.[1]
  const clean = raw.replace(/#.*$/, '').replace(/^\/+/, '')
  if (/^https?:\/\//i.test(raw) || /^(developer|experienceleague)\.adobe\.com\//i.test(raw)) {
    const doc = urlIndex!.get(normalizeUrl(raw))
    return doc ? { doc, anchor } : null
  }
  const candidates = [clean, clean.endsWith('.md') ? clean : `${clean}.md`, `${clean}/index.md`]
  for (const c of candidates) {
    const doc = docIndex!.get(c) ?? sourceIndex!.get(c)
    if (doc) return { doc, anchor }
  }
  return null
}

export function loadSources(): SourceInfo[] {
  return loadJson<SourceInfo[]>('fonte.json')
}

export function loadCli(): CliData {
  return loadJson<CliData>('cli.json')
}

export function loadRest(): RestData {
  return loadJson<RestData>('webapi', 'rest.json')
}

export function loadGraphql(): GraphqlData {
  return loadJson<GraphqlData>('webapi', 'graphql.json')
}

export function loadConfigFiles(): ConfigFileEntry[] {
  return loadJson<ConfigFileEntry[]>('config-files.json')
}

/** Rebuilds a page (or one section) as markdown. */
export function renderDoc(doc: Doc, anchor?: string): string | null {
  let sections = doc.sections
  if (anchor) {
    const i = sections.findIndex((s) => s.a === anchor || s.a === anchor.toLowerCase())
    if (i === -1) return null
    const level = sections[i].l
    let end = i + 1
    while (end < sections.length && sections[end].l > level) end++
    sections = sections.slice(i, end)
  }
  const out: string[] = []
  for (const s of sections) {
    if (s.l === 1) out.push(`# ${s.h}`)
    else out.push(`${'#'.repeat(s.l)} ${s.h}`)
    if (s.t) out.push('', s.t)
    out.push('')
  }
  return out.join('\n').trim()
}
