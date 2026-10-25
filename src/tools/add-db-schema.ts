import { z } from 'zod'
import {
  ScaffoldError,
  assertIdentifier,
  basePathSchema,
  cli,
  docUrl,
  moduleNameSchema,
  parseModule,
  scaffoldError,
  scaffoldResult,
  xmlAttr,
  type GeneratedFile,
} from '../scaffold/common.js'

/** Valid column xsi:type values listed in the declarative schema docs. */
export const COLUMN_TYPES = [
  'blob',
  'boolean',
  'date',
  'datetime',
  'decimal',
  'float',
  'int',
  'json',
  'real',
  'smallint',
  'text',
  'timestamp',
  'varbinary',
  'varchar',
] as const

const columnSchema = z.object({
  name: z.string().describe('Column name (lowercase, digits and "_")'),
  type: z.enum(COLUMN_TYPES).describe('xsi:type of the column'),
  nullable: z
    .boolean()
    .optional()
    .describe('Default true, except for identity and primary key columns'),
  unsigned: z.boolean().optional().describe('Numeric types only'),
  identity: z.boolean().optional().describe('Auto increment'),
  length: z.number().int().positive().optional().describe('char, varchar and varbinary'),
  padding: z.number().int().positive().optional().describe('Size of an integer column'),
  precision: z.number().int().positive().optional().describe('decimal, float, real'),
  scale: z.number().int().min(0).optional().describe('decimal, float, real'),
  default: z.string().optional().describe('Default value, same datatype as the column'),
  onUpdate: z.boolean().optional().describe('on_update attribute (datetime and timestamp)'),
  comment: z.string().optional(),
})

export const addDbSchemaSchema = {
  module: moduleNameSchema,
  table: z.string().describe('Table name (e.g. "acme_review")'),
  comment: z.string().optional().describe('Table comment'),
  resource: z
    .enum(['default', 'checkout', 'sales'])
    .optional()
    .describe('Database resource (shard), default "default"'),
  engine: z.enum(['innodb', 'memory']).optional().describe('SQL engine, default "innodb"'),
  columns: z
    .array(columnSchema)
    .optional()
    .describe(
      'Columns. Without columns the table gets an entity_id int unsigned identity primary key.'
    ),
  primaryKey: z
    .array(z.string())
    .optional()
    .describe('Primary key columns (default: the identity column)'),
  unique: z
    .array(z.array(z.string()))
    .optional()
    .describe('Unique constraints, each a list of columns'),
  indexes: z
    .array(
      z.object({
        columns: z.array(z.string()),
        type: z.enum(['btree', 'fulltext', 'hash']).optional().describe('Default btree'),
      })
    )
    .optional(),
  foreignKeys: z
    .array(
      z.object({
        column: z.string(),
        referenceTable: z.string(),
        referenceColumn: z.string(),
        onDelete: z
          .enum(['CASCADE', 'SET NULL', 'NO ACTION'])
          .optional()
          .describe('Default CASCADE'),
      })
    )
    .optional(),
  basePath: basePathSchema,
}

type Column = z.infer<typeof columnSchema>

const NAME = /^[a-z][a-z0-9_]*$/

function refId(...parts: string[]): string {
  return parts.join('_').toUpperCase()
}

export async function addDbSchema(args: {
  module: string
  table: string
  comment?: string
  resource?: 'default' | 'checkout' | 'sales'
  engine?: 'innodb' | 'memory'
  columns?: Column[]
  primaryKey?: string[]
  unique?: string[][]
  indexes?: Array<{ columns: string[]; type?: 'btree' | 'fulltext' | 'hash' }>
  foreignKeys?: Array<{
    column: string
    referenceTable: string
    referenceColumn: string
    onDelete?: 'CASCADE' | 'SET NULL' | 'NO ACTION'
  }>
  basePath?: string
}) {
  try {
    const mod = parseModule(args.module, args.basePath)
    const table = assertIdentifier(args.table, 'table name', NAME)
    const columns: Column[] = args.columns?.length
      ? args.columns
      : [
          {
            name: 'entity_id',
            type: 'int',
            unsigned: true,
            identity: true,
            nullable: false,
            comment: 'Entity ID',
          },
        ]
    const names = new Set<string>()
    for (const c of columns) {
      assertIdentifier(c.name, 'column name', NAME)
      if (names.has(c.name)) throw new ScaffoldError(`Column "${c.name}" is declared twice.`)
      names.add(c.name)
    }
    const known = (col: string, where: string) => {
      if (!names.has(col))
        throw new ScaffoldError(`${where} uses "${col}", which is not a column of ${table}.`)
      return col
    }
    const pk = args.primaryKey?.length
      ? args.primaryKey.map((c) => known(c, 'primaryKey'))
      : columns.filter((c) => c.identity).map((c) => c.name)
    if (columns.filter((c) => c.identity).length > 1)
      throw new ScaffoldError('Only one identity column is allowed.')

    const colXml = columns.map((c) => {
      const a = [`xsi:type="${c.type}"`, `name="${c.name}"`]
      if (c.padding !== undefined) a.push(`padding="${c.padding}"`)
      if (c.unsigned !== undefined) a.push(`unsigned="${c.unsigned}"`)
      const nullable = c.nullable ?? !(c.identity || pk.includes(c.name))
      a.push(`nullable="${nullable}"`)
      if (c.identity !== undefined) a.push(`identity="${c.identity}"`)
      if (c.length !== undefined) a.push(`length="${c.length}"`)
      else if (c.type === 'varchar') a.push('length="255"')
      if (c.precision !== undefined) a.push(`precision="${c.precision}"`)
      if (c.scale !== undefined) a.push(`scale="${c.scale}"`)
      if (c.default !== undefined) a.push(`default="${xmlAttr(c.default)}"`)
      if (c.onUpdate !== undefined) a.push(`on_update="${c.onUpdate}"`)
      if (c.comment) a.push(`comment="${xmlAttr(c.comment)}"`)
      return `        <column ${a.join(' ')}/>`
    })

    const inner = (cols: string[]) =>
      cols.map((c) => `            <column name="${c}"/>`).join('\n')
    const constraints: string[] = []
    if (pk.length) {
      constraints.push(
        `        <constraint xsi:type="primary" referenceId="PRIMARY">\n${inner(pk)}\n        </constraint>`
      )
    }
    for (const u of args.unique ?? []) {
      const cols = u.map((c) => known(c, 'unique'))
      constraints.push(
        `        <constraint xsi:type="unique" referenceId="${refId(table, ...cols)}">\n${inner(cols)}\n        </constraint>`
      )
    }
    for (const fk of args.foreignKeys ?? []) {
      const col = known(fk.column, 'foreignKeys')
      const refTable = assertIdentifier(fk.referenceTable, 'referenceTable', NAME)
      const refCol = assertIdentifier(fk.referenceColumn, 'referenceColumn', NAME)
      constraints.push(
        `        <constraint xsi:type="foreign" referenceId="${refId(table, col, refTable, refCol)}" table="${table}" column="${col}" referenceTable="${refTable}" referenceColumn="${refCol}" onDelete="${fk.onDelete ?? 'CASCADE'}"/>`
      )
    }
    const indexes = (args.indexes ?? []).map((ix) => {
      const cols = ix.columns.map((c) => known(c, 'indexes'))
      return `        <index referenceId="${refId(table, ...cols)}" indexType="${ix.type ?? 'btree'}">\n${inner(cols)}\n        </index>`
    })

    const tableAttrs = [
      `name="${table}"`,
      `resource="${args.resource ?? 'default'}"`,
      `engine="${args.engine ?? 'innodb'}"`,
    ]
    if (args.comment) tableAttrs.push(`comment="${xmlAttr(args.comment)}"`)
    const xml = `<?xml version="1.0"?>
<schema xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Setup/Declaration/Schema/etc/schema.xsd">
    <table ${tableAttrs.join(' ')}>
${[...colXml, ...constraints, ...indexes].join('\n')}
    </table>
</schema>
`
    const page = 'php/development/components/declarative-schema/configuration.md'
    const files: GeneratedFile[] = [
      {
        path: `${mod.basePath}/etc/db_schema.xml`,
        content: xml,
        source: docUrl(page, 'db_schema-structure'),
      },
    ]
    const notes = [
      `If etc/db_schema.xml already exists, add the <table> node to its <schema> instead of replacing the file.`,
      `Generate the whitelist: \`${cli(`setup:db-declaration:generate-whitelist --module-name=${mod.full}`)}\` (${docUrl('php/development/components/declarative-schema/migration-scripts.md', 'create-a-schema-whitelist')}).`,
      `Apply the schema: \`${cli('setup:upgrade')}\`. With --dry-run=1 it only writes the DDL statements to var/log/dry-run-installation.log (${docUrl('php/development/components/declarative-schema/migration-scripts.md')}).`,
      'The referenceId values are only used inside db_schema.xml files; the database gets system-generated names, and the docs suggest reusing the names written in db_schema_whitelist.json.',
    ]
    if (!pk.length)
      notes.unshift('The table has no primary key: set primaryKey or an identity column.')
    return scaffoldResult(`Table ${table} (${mod.full})`, files, notes)
  } catch (e) {
    return scaffoldError(e)
  }
}
