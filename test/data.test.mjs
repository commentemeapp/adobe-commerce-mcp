import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  loadConfigFiles,
  loadDocs,
  loadSources,
  loadCli,
  loadRest,
  loadGraphql,
  findDoc,
} from '../build/knowledge/loader.js'

const HOSTS = {
  php: 'https://developer.adobe.com/commerce/php/',
  frontend: 'https://developer.adobe.com/commerce/frontend-core/',
  webapi: 'https://developer.adobe.com/commerce/webapi/',
  operations: 'https://experienceleague.adobe.com/en/docs/commerce-operations/',
}

test('fonte.json records the four repositories, commit and license', () => {
  const src = loadSources()
  assert.deepEqual(src.map((s) => s.repo).sort(), [
    'AdobeDocs/commerce-frontend-core',
    'AdobeDocs/commerce-operations.en',
    'AdobeDocs/commerce-php',
    'AdobeDocs/commerce-webapi',
  ])
  for (const s of src) {
    assert.match(s.commit, /^[0-9a-f]{40}$/)
    assert.ok(['Apache-2.0', 'MIT'].includes(s.license))
    assert.ok(s.documents > 0)
  }
  assert.equal(src.find((s) => s.repo.endsWith('operations.en')).license, 'MIT')
})

test('every document has id, title, public URL and clean text', () => {
  const docs = loadDocs()
  assert.ok(docs.length > 1000)
  const ids = new Set()
  for (const d of docs) {
    assert.ok(!ids.has(d.id), `duplicate ${d.id}`)
    ids.add(d.id)
    assert.ok(d.title, `${d.id} without title`)
    assert.ok(d.url.startsWith(HOSTS[d.area]), `${d.id}: ${d.url}`)
    assert.ok(d.source.startsWith(`${d.repo}/`))
    const text = d.sections.map((s) => s.t).join('\n')
    for (const leftover of [
      '<InlineAlert',
      '<Fragment',
      'slots="',
      '{{$include',
      '[!UICONTROL',
      '[!NOTE]',
    ]) {
      // inside code blocks the docs may show these on purpose; outside they are rendering leftovers
      const prose = text.replace(/```[\s\S]*?```/g, '')
      assert.ok(!prose.includes(leftover), `${d.id} still has ${leftover}`)
    }
  }
})

test('the GraphQL reference is not duplicated as documents', () => {
  assert.equal(
    loadDocs('webapi').filter((d) => d.id.startsWith('webapi/reference/graphql/')).length,
    0
  )
})

test('config catalog: every source exists and the URN is literally in the docs', () => {
  for (const e of loadConfigFiles()) {
    assert.ok(e.sources.length > 0, e.file)
    for (const id of e.sources) assert.ok(findDoc(id), `${e.file}: ${id}`)
    if (e.urn) {
      const found = e.sources.some((id) =>
        findDoc(id).doc.sections.some((s) => s.t.includes(e.urn))
      )
      assert.ok(found, `${e.file}: ${e.urn} not in its sources`)
    }
  }
})

test('structured references are present', () => {
  const cli = loadCli()
  assert.ok(cli.commands.length > 100)
  assert.ok(cli.commands.some((c) => c.name === 'setup:upgrade'))
  const rest = loadRest()
  assert.ok(rest.endpoints.length > 500)
  assert.ok(rest.endpoints.every((e) => /^\/V\d+\//.test(e.path)))
  const gql = loadGraphql()
  assert.ok(gql.operations.some((o) => o.kind === 'query' && o.name === 'products'))
  assert.ok(gql.operations.some((o) => o.kind === 'mutation' && o.name === 'placeOrder'))
})

test('the package ships data and build only', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
  assert.deepEqual(pkg.files, ['build', 'data'])
  assert.equal(pkg.bin['adobe-commerce-mcp'], 'build/index.js')
  assert.equal(pkg.mcpName, 'io.github.zeluizr/adobe-commerce-mcp')
})
