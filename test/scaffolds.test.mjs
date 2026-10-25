import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { XMLValidator } from 'fast-xml-parser'
import { call, closeClient } from './helpers.mjs'
import { loadDocs } from '../build/knowledge/loader.js'

after(closeClient)

const php = spawnSync('php', ['-v'], { encoding: 'utf-8' })
const hasPhp = php.status === 0
const docUrls = new Set(loadDocs().map((d) => d.url))
const tmp = mkdtempSync(join(tmpdir(), 'acmcp-'))
after(() => rmSync(tmp, { recursive: true, force: true }))

/** Structural PHP check used when there is no php binary: tags, strict types, balanced brackets. */
function checkPhpShape(path, content) {
  assert.ok(content.startsWith('<?php\n'), `${path} must start with <?php`)
  if (!path.endsWith('.phtml'))
    assert.match(content, /^declare\(strict_types=1\);$/m, `${path} without strict_types`)
  const code = content
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  for (const [o, c] of [
    ['{', '}'],
    ['(', ')'],
    ['[', ']'],
  ]) {
    assert.equal(code.split(o).length, code.split(c).length, `${path}: unbalanced ${o}${c}`)
  }
}

function checkFiles(res, t) {
  assert.ok(!res.isError, res.text)
  const { files, notes } = res.structuredContent
  assert.ok(files.length > 0)
  assert.ok(Array.isArray(notes))
  for (const f of files) {
    assert.ok(!f.path.startsWith('/') && !f.path.includes('..'), `bad path ${f.path}`)
    const base = f.source.replace(/#.*$/, '')
    assert.ok(docUrls.has(base), `${f.path}: source ${f.source} is not a bundled doc`)
    if (f.path.endsWith('.xml')) {
      const v = XMLValidator.validate(f.content)
      assert.equal(v, true, `${f.path}: ${JSON.stringify(v)}`)
      assert.match(f.content, /xsi:noNamespaceSchemaLocation="urn:magento:/)
    } else if (f.path.endsWith('.json')) {
      JSON.parse(f.content)
    } else if (f.path.endsWith('.php') || f.path.endsWith('.phtml')) {
      checkPhpShape(f.path, f.content)
      if (hasPhp) {
        const file = join(tmp, f.path.replace(/\//g, '_'))
        writeFileSync(file, f.content)
        execFileSync('php', ['-l', file], { stdio: 'pipe' })
      }
    }
    // PSR-4: the namespace follows the path under app/code/<Vendor>/<Module>
    const ns = /^namespace ([^;]+);/m.exec(f.content)?.[1]
    if (ns && f.path.startsWith('app/code/')) {
      const dir = f.path.split('/').slice(2, -1).join('\\')
      assert.equal(ns, dir, `${f.path}: namespace ${ns}`)
    }
  }
  return files
}

test('php -l availability', (t) => {
  if (!hasPhp) t.diagnostic('php not found: PHP files were checked only structurally (no php -l)')
})

test('scaffold-module', async (t) => {
  const files = checkFiles(
    await call('scaffold-module', {
      module: 'Acme_Reviews',
      sequence: ['Magento_Catalog'],
      php: '~8.3.0',
    }),
    t
  )
  const byName = Object.fromEntries(files.map((f) => [f.path, f.content]))
  assert.match(
    byName['app/code/Acme/Reviews/registration.php'],
    /ComponentRegistrar::MODULE, 'Acme_Reviews', __DIR__/
  )
  assert.match(byName['app/code/Acme/Reviews/etc/module.xml'], /<module name="Magento_Catalog"\/>/)
  const composer = JSON.parse(byName['app/code/Acme/Reviews/composer.json'])
  assert.equal(composer.type, 'magento2-module')
  assert.equal(composer.name, 'acme/module-reviews')
  assert.deepEqual(composer.autoload['psr-4'], { 'Acme\\Reviews\\': '' })
  assert.deepEqual(composer.require, { php: '~8.3.0' })
  const bad = await call('scaffold-module', { module: 'acme-reviews' })
  assert.ok(bad.isError)
})

test('add-plugin: before, after and around', async (t) => {
  for (const type of ['before', 'after', 'around']) {
    const files = checkFiles(
      await call('add-plugin', {
        module: 'Acme_Reviews',
        targetClass: '\\Magento\\Catalog\\Model\\Product',
        method: 'getName',
        type,
        area: 'frontend',
        sortOrder: 10,
      }),
      t
    )
    const plugin = files.find((f) => f.path === 'app/code/Acme/Reviews/Plugin/ProductPlugin.php')
    assert.match(plugin.content, new RegExp(`public function ${type}GetName\\(Product \\$subject`))
    const di = files.find((f) => f.path === 'app/code/Acme/Reviews/etc/frontend/di.xml')
    assert.match(di.content, /<type name="Magento\\Catalog\\Model\\Product">/)
    assert.match(di.content, /type="Acme\\Reviews\\Plugin\\ProductPlugin" sortOrder="10"/)
  }
  const ctor = await call('add-plugin', {
    module: 'Acme_Reviews',
    targetClass: 'A\\B',
    method: '__construct',
    type: 'after',
  })
  assert.ok(ctor.isError)
})

test('add-observer', async (t) => {
  const files = checkFiles(
    await call('add-observer', {
      module: 'Acme_Reviews',
      event: 'catalog_product_save_after',
      area: 'adminhtml',
    }),
    t
  )
  assert.ok(
    files.some((f) => f.path === 'app/code/Acme/Reviews/Observer/CatalogProductSaveAfter.php')
  )
  const xml = files.find((f) => f.path === 'app/code/Acme/Reviews/etc/adminhtml/events.xml')
  assert.match(xml.content, /<event name="catalog_product_save_after">/)
})

test('add-controller: frontend GET, frontend POST, admin GET and POST', async (t) => {
  const front = checkFiles(
    await call('add-controller', {
      module: 'Acme_Reviews',
      area: 'frontend',
      frontName: 'reviews',
      controller: 'list',
      action: 'view',
    }),
    t
  )
  assert.ok(front.some((f) => f.path === 'app/code/Acme/Reviews/Controller/List/View.php'))
  assert.ok(
    front.some((f) => f.path === 'app/code/Acme/Reviews/view/frontend/layout/reviews_list_view.xml')
  )
  assert.match(front.find((f) => f.path.endsWith('routes.xml')).content, /<router id="standard">/)

  const post = checkFiles(
    await call('add-controller', {
      module: 'Acme_Reviews',
      area: 'frontend',
      frontName: 'reviews',
      action: 'save',
      method: 'POST',
    }),
    t
  )
  assert.match(
    post.find((f) => f.path.endsWith('Save.php')).content,
    /implements HttpPostActionInterface/
  )

  for (const method of ['GET', 'POST']) {
    const admin = checkFiles(
      await call('add-controller', {
        module: 'Acme_Reviews',
        area: 'adminhtml',
        frontName: 'acmereviews',
        controller: 'review',
        method,
      }),
      t
    )
    const ctrl = admin.find(
      (f) => f.path === 'app/code/Acme/Reviews/Controller/Adminhtml/Review/Index.php'
    )
    assert.match(ctrl.content, /public const ADMIN_RESOURCE = 'Acme_Reviews::review';/)
    assert.match(ctrl.content, /extends Action implements/)
    assert.match(admin.find((f) => f.path.endsWith('routes.xml')).content, /<router id="admin">/)
    assert.match(
      admin.find((f) => f.path.endsWith('acl.xml')).content,
      /<resource id="Acme_Reviews::review"/
    )
  }
})

test('add-db-schema', async (t) => {
  const files = checkFiles(
    await call('add-db-schema', {
      module: 'Acme_Reviews',
      table: 'acme_review',
      comment: 'Reviews & ratings',
      columns: [
        { name: 'review_id', type: 'int', unsigned: true, identity: true },
        { name: 'product_id', type: 'int', unsigned: true, nullable: false },
        { name: 'title', type: 'varchar', length: 120 },
        { name: 'rating', type: 'decimal', precision: 5, scale: 2 },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: false },
      ],
      unique: [['product_id', 'title']],
      indexes: [{ columns: ['product_id'] }],
      foreignKeys: [
        {
          column: 'product_id',
          referenceTable: 'catalog_product_entity',
          referenceColumn: 'entity_id',
        },
      ],
    }),
    t
  )
  const xml = files[0].content
  assert.match(
    xml,
    /<constraint xsi:type="primary" referenceId="PRIMARY">\s*<column name="review_id"\/>/
  )
  assert.match(
    xml,
    /xsi:type="foreign" referenceId="ACME_REVIEW_PRODUCT_ID_CATALOG_PRODUCT_ENTITY_ENTITY_ID"/
  )
  assert.match(xml, /comment="Reviews &amp; ratings"/)
  const empty = checkFiles(
    await call('add-db-schema', { module: 'Acme_Reviews', table: 'acme_log' }),
    t
  )
  assert.match(empty[0].content, /name="entity_id"/)
  const bad = await call('add-db-schema', {
    module: 'Acme_Reviews',
    table: 'x',
    primaryKey: ['nope'],
  })
  assert.ok(bad.isError)
})
