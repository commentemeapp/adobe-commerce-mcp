import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { call, closeClient, getClient } from './helpers.mjs'

after(closeClient)

test('every tool answers without error', async () => {
  const calls = {
    'search-docs': { query: 'dependency injection preference' },
    'read-doc': { ref: 'php/development/components/plugins.md' },
    'explain-config-file': { file: 'di.xml' },
    'lookup-cli-command': { command: 'setup:upgrade' },
    'lookup-webapi': { query: 'products' },
    'scaffold-module': { module: 'Acme_Reviews' },
    'add-plugin': {
      module: 'Acme_Reviews',
      targetClass: 'Magento\\Catalog\\Model\\Product',
      method: 'getName',
      type: 'after',
    },
    'add-observer': { module: 'Acme_Reviews', event: 'catalog_product_save_after' },
    'add-controller': { module: 'Acme_Reviews', area: 'frontend', frontName: 'reviews' },
    'add-db-schema': { module: 'Acme_Reviews', table: 'acme_review' },
  }
  const { tools } = await (await getClient()).listTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(calls).sort())
  for (const [name, args] of Object.entries(calls)) {
    const res = await call(name, args)
    assert.ok(!res.isError, `${name} returned an error: ${res.text}`)
    assert.ok(res.text.length > 100, `${name} returned too little`)
  }
})

test('search-docs finds the around plugin section', async () => {
  const res = await call('search-docs', { query: 'plugin around', limit: 3 })
  assert.match(res.text, /php\/development\/components\/plugins\.md/)
  assert.match(
    res.text,
    /https:\/\/developer\.adobe\.com\/commerce\/php\/development\/components\/plugins\/#around-methods/
  )
  assert.match(res.text, /commerce-php\/src\/pages\/development\/components\/plugins\.md/)
})

test('search-docs filters by area', async () => {
  const res = await call('search-docs', { query: 'cache', area: 'operations', limit: 5 })
  const urls = [...res.text.matchAll(/- URL: (\S+)/g)].map((m) => m[1])
  assert.equal(urls.length, 5)
  for (const u of urls)
    assert.match(u, /^https:\/\/experienceleague\.adobe\.com\/en\/docs\/commerce-operations\//)
})

test('read-doc accepts id, source path, URL and section', async () => {
  const byId = await call('read-doc', { ref: 'php/development/components/plugins.md' })
  const bySource = await call('read-doc', {
    ref: 'commerce-php/src/pages/development/components/plugins.md',
  })
  const byUrl = await call('read-doc', {
    ref: 'https://developer.adobe.com/commerce/php/development/components/plugins/',
  })
  assert.equal(byId.text, bySource.text)
  assert.equal(byId.text, byUrl.text)
  const section = await call('read-doc', {
    ref: 'https://developer.adobe.com/commerce/php/development/components/plugins/#around-methods',
  })
  assert.match(section.text, /^## Around methods/m)
  assert.doesNotMatch(section.text, /^## Before methods/m)
  const missing = await call('read-doc', { ref: 'php/nope.md' })
  assert.ok(missing.isError)
})

test('explain-config-file gives location, URN and docs', async () => {
  const di = await call('explain-config-file', { file: 'etc/adminhtml/di.xml' })
  assert.match(di.text, /urn:magento:framework:ObjectManager\/etc\/config\.xsd/)
  assert.match(di.text, /webapi_rest/)
  const layout = await call('explain-config-file', {
    file: 'view/frontend/layout/catalog_product_view.xml',
  })
  assert.match(layout.text, /page_configuration\.xsd/)
  const schema = await call('explain-config-file', { file: 'db_schema.xml' })
  assert.match(schema.text, /Setup\/Declaration\/Schema\/etc\/schema\.xsd/)
  const graphqls = await call('explain-config-file', { file: 'schema.graphqls' })
  assert.match(graphqls.text, /does not give an XSD URN/)
  const unknown = await call('explain-config-file', { file: 'nada.xml' })
  assert.ok(unknown.isError)
})

test('lookup-cli-command resolves names, shortcuts and keywords', async () => {
  const full = await call('lookup-cli-command', { command: 'bin/magento setup:upgrade' })
  assert.match(full.text, /--keep-generated/)
  const short = await call('lookup-cli-command', { command: 's:up' })
  assert.match(short.text, /^# bin\/magento setup:upgrade/m)
  const words = await call('lookup-cli-command', { command: 'static content deploy' })
  assert.match(words.text, /setup:static-content:deploy/)
})

test('lookup-webapi covers GraphQL and REST', async () => {
  const gql = await call('lookup-webapi', { query: 'addProductsToCart' })
  assert.match(gql.text, /cartItems/)
  assert.match(gql.text, /graphql\/schema\/cart\/mutations\/add-products/)
  const rest = await call('lookup-webapi', { query: '/V1/products/{sku}', method: 'GET' })
  assert.match(rest.text, /^# GET \/V1\/products\/\{sku\}/m)
  const prefixed = await call('lookup-webapi', {
    query: '/rest/default/V1/products/:sku',
    method: 'GET',
  })
  assert.match(prefixed.text, /^# GET \/V1\/products\/\{sku\}/m)
  const kw = await call('lookup-webapi', { query: 'coupon', api: 'graphql' })
  assert.match(kw.text, /applyCouponToCart/)
})

test('resources: index, one page, config files and sources', async () => {
  const client = await getClient()
  const read = async (uri) => (await client.readResource({ uri })).contents[0].text
  assert.match(await read('adobe-commerce://docs'), /## php:/)
  const page = await read('adobe-commerce://docs/php/development/components/plugins.md')
  assert.match(page, /^# Plugins/m)
  assert.match(await read('adobe-commerce://config-files'), /`db_schema\.xml`/)
  const sources = JSON.parse(await read('adobe-commerce://sources'))
  assert.equal(sources.length, 4)
})
