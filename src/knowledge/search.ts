import { loadDocs, type Area, type Doc, type Section } from './loader.js'

// BM25 over page sections. The index is built in memory on the first search.

const K1 = 1.2
const B = 0.75
/** weight of the page title and section heading against the body */
const TITLE_WEIGHT = 3

const STOPWORDS = new Set(
  'a an and are as at be but by can do does for from has have how i if in into is it its of on or that the their them then there these this to use used using was what when where which will with you your'.split(
    ' '
  )
)

export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().split(/[^a-z0-9_]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue
    out.push(stem(raw))
  }
  return out
}

function stem(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y'
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us'))
    return t.slice(0, -1)
  return t
}

interface Entry {
  doc: Doc
  section: Section
  length: number
  /** tokens of the page title and the section heading */
  headings: Set<string>
}

/** bonus when the page title and section heading together cover every query term */
const HEADING_COVERAGE_BONUS = 1.5

interface Index {
  entries: Entry[]
  postings: Map<string, Array<[number, number]>>
  avgLength: number
}

let index: Index | null = null

function buildIndex(): Index {
  const entries: Entry[] = []
  const postings = new Map<string, Array<[number, number]>>()
  let total = 0
  for (const doc of loadDocs()) {
    for (const section of doc.sections) {
      const tf = new Map<string, number>()
      const titleTokens = tokenize(`${doc.title} ${section.l > 1 ? section.h : ''}`)
      for (const t of titleTokens) tf.set(t, (tf.get(t) ?? 0) + TITLE_WEIGHT)
      const body = tokenize(section.t)
      for (const t of body) tf.set(t, (tf.get(t) ?? 0) + 1)
      const length = body.length + titleTokens.length * TITLE_WEIGHT
      const i = entries.length
      entries.push({ doc, section, length, headings: new Set(titleTokens) })
      total += length
      for (const [t, n] of tf) {
        let list = postings.get(t)
        if (!list) postings.set(t, (list = []))
        list.push([i, n])
      }
    }
  }
  return { entries, postings, avgLength: total / Math.max(entries.length, 1) }
}

export interface SearchHit {
  doc: Doc
  section: Section
  score: number
  excerpt: string
}

export function searchDocs(query: string, opts: { area?: Area; limit?: number } = {}): SearchHit[] {
  index ??= buildIndex()
  const terms = [...new Set(tokenize(query))]
  if (!terms.length) return []
  const n = index.entries.length
  const scores = new Map<number, number>()
  for (const term of terms) {
    const list = index.postings.get(term)
    if (!list) continue
    const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5))
    for (const [i, tf] of list) {
      const e = index.entries[i]
      if (opts.area && e.doc.area !== opts.area) continue
      const norm = tf + K1 * (1 - B + (B * e.length) / index.avgLength)
      scores.set(i, (scores.get(i) ?? 0) + idf * ((tf * (K1 + 1)) / norm))
    }
  }
  if (terms.length > 1) {
    for (const [i, score] of scores) {
      const h = index.entries[i].headings
      if (terms.every((t) => h.has(t))) scores.set(i, score * HEADING_COVERAGE_BONUS)
    }
  }
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 20)
  // one hit per page: keep its best section
  const best = new Map<string, { i: number; score: number }>()
  for (const [i, score] of scores) {
    const id = index.entries[i].doc.id
    const cur = best.get(id)
    if (!cur || score > cur.score) best.set(id, { i, score })
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ i, score }) => {
      const e = index!.entries[i]
      return { doc: e.doc, section: e.section, score, excerpt: excerpt(e.section.t, terms) }
    })
}

function excerpt(text: string, terms: string[], size = 500): string {
  const lower = text.toLowerCase()
  let pos = -1
  for (const t of terms) {
    const p = lower.indexOf(t)
    if (p !== -1 && (pos === -1 || p < pos)) pos = p
  }
  if (pos === -1) pos = 0
  const start = Math.max(0, pos - 120)
  const end = Math.min(text.length, start + size)
  let out = text.slice(start, end).trim()
  if (start > 0) out = '...' + out
  if (end < text.length) out += '...'
  return out
}
