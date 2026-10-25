/**
 * Ingestão da documentação oficial de Adobe Commerce para `data/`.
 *
 * Uso: `npm run ingerir -- <pasta-dos-clones>` (ou `FONTES_DIR=<pasta> npm run ingerir`).
 *
 * A pasta deve conter os clones de `AdobeDocs/commerce-php`, `commerce-frontend-core`,
 * `commerce-webapi` e `commerce-operations.en`. Os clones são dados: este script só lê
 * arquivos de texto deles, nunca executa nada que venha de lá.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, posix, relative, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { CATALOGO_CONFIG } from './catalogo-config.js'

type Area = 'php' | 'frontend' | 'webapi' | 'operations'

interface Fonte {
  repo: string
  area: Area
  /** pasta das páginas, relativa ao clone */
  raiz: string
  url: string
  licencia: string
  archivoLicencia: string
  /** caminhos (relativos à raiz) que não entram como documento */
  excluir: (rel: string) => boolean
}

interface Seccion {
  /** título da seção */
  h: string
  /** âncora */
  a: string
  /** nível do título (1 = página) */
  l: number
  /** texto em markdown */
  t: string
}

interface Doc {
  id: string
  area: Area
  repo: string
  source: string
  title: string
  description: string
  url: string
  sections: Seccion[]
}

const FONTES: Fonte[] = [
  {
    repo: 'commerce-php',
    area: 'php',
    raiz: 'src/pages',
    url: 'https://developer.adobe.com/commerce/php/',
    licencia: 'Apache-2.0',
    archivoLicencia: 'LICENSE',
    excluir: (rel) => rel.startsWith('includes/'),
  },
  {
    repo: 'commerce-frontend-core',
    area: 'frontend',
    raiz: 'src/pages',
    url: 'https://developer.adobe.com/commerce/frontend-core/',
    licencia: 'Apache-2.0',
    archivoLicencia: 'LICENSE',
    excluir: (rel) => rel.startsWith('includes/') || rel.startsWith('_includes/'),
  },
  {
    repo: 'commerce-webapi',
    area: 'webapi',
    raiz: 'src/pages',
    url: 'https://developer.adobe.com/commerce/webapi/',
    licencia: 'Apache-2.0',
    archivoLicencia: 'LICENSE',
    // A referência gerada do GraphQL (todas as versões) vai estruturada para lookup-webapi.
    excluir: (rel) => rel.startsWith('includes/') || rel.startsWith('reference/graphql/'),
  },
  {
    repo: 'commerce-operations.en',
    area: 'operations',
    raiz: 'help',
    url: 'https://experienceleague.adobe.com/en/docs/commerce-operations/',
    licencia: 'MIT',
    archivoLicencia: 'license.md',
    excluir: (rel) =>
      rel.startsWith('_includes/') ||
      rel.startsWith('assets/') ||
      rel.endsWith('TOC.md') ||
      // Fora do desenvolvimento PHP: notas de versão, os mais de 900 patches do QPT,
      // as ferramentas de monitoramento de nuvem e os resumos de eventos.
      rel.startsWith('release/') ||
      rel.startsWith('tools/quality-patches-tool/') ||
      rel.startsWith('tools/site-wide-analysis-tool/') ||
      rel.startsWith('tools/observation-for-adobe-commerce/') ||
      rel.startsWith('tools/managed-alerts-for-adobe-commerce/') ||
      rel.startsWith('events/') ||
      rel.startsWith('home/'),
  },
]

const RAIZ_PROJETO = resolve(dirname(new URL(import.meta.url).pathname), '..')
const DATA = join(RAIZ_PROJETO, 'data')

// ─── utilidades ──────────────────────────────────────────────────────────────

function listarMd(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...listarMd(p))
    else if (nome.endsWith('.md')) out.push(p)
  }
  return out.sort()
}

function lerSemFrontmatter(texto: string): { meta: Record<string, string>; corpo: string } {
  const meta: Record<string, string> = {}
  if (!texto.startsWith('---')) return { meta, corpo: texto }
  const fim = texto.indexOf('\n---', 3)
  if (fim === -1) return { meta, corpo: texto }
  const bloco = texto.slice(3, fim)
  for (const linha of bloco.split('\n')) {
    const m = /^([A-Za-z_-]+):\s*(.*)$/.exec(linha)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    meta[m[1]] = v
  }
  return { meta, corpo: texto.slice(fim + 4).replace(/^\r?\n/, '') }
}

/** Separa o markdown em trechos de prosa e blocos de código cercados. */
function segmentos(md: string): Array<{ codigo: boolean; texto: string }> {
  const out: Array<{ codigo: boolean; texto: string }> = []
  const linhas = md.split('\n')
  let atual: string[] = []
  let cerca: string | null = null
  const fechar = (codigo: boolean) => {
    if (atual.length) out.push({ codigo, texto: atual.join('\n') })
    atual = []
  }
  for (const linha of linhas) {
    const m = /^\s*(```+|~~~+)/.exec(linha)
    if (cerca === null && m) {
      fechar(false)
      cerca = m[1]
      atual.push(linha)
    } else if (cerca !== null && m && m[1].startsWith(cerca[0]) && m[1].length >= cerca.length) {
      atual.push(linha)
      fechar(true)
      cerca = null
    } else {
      atual.push(linha)
    }
  }
  fechar(cerca !== null)
  return out
}

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[`*~[\]()]/g, '')
    .replace(/[^a-z0-9_\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#8217;': '\u2019',
  '&#8216;': '\u2018',
  '&#8220;': '\u201c',
  '&#8221;': '\u201d',
  '&rsquo;': '\u2019',
  '&lsquo;': '\u2018',
  '&ndash;': '-',
  '&mdash;': '-',
  '&amp;': '&',
}

const TAGS_HTML =
  'table|thead|tbody|tfoot|tr|div|span|p|u|b|i|em|strong|sup|sub|ul|ol|a|pre|h[1-6]|colgroup|col|caption|center|font|small|hr|section|figure|figcaption|details|summary|kbd|g|path|rect|use|text|defs|tspan|style|nobr'

// ─── índice de documentos e URLs ─────────────────────────────────────────────

interface Arquivo {
  fonte: Fonte
  abs: string
  rel: string
  id: string
  url: string
}

/** URL pública das páginas do developer.adobe.com: o caminho sem `.md`, com barra final. */
function urlAdobeDev(fonte: Fonte, rel: string): string {
  let p = rel.replace(/\.md$/, '')
  if (p === 'index') p = ''
  else if (p.endsWith('/index')) p = p.slice(0, -'/index'.length)
  return fonte.url + (p ? p + '/' : '')
}

/**
 * URLs do Experience League: saem dos TOC.md de cada guia. O id do título (`{#configuration-guide}`)
 * é o primeiro segmento, os ids dos grupos aninhados (`{#cli}`) vêm em seguida e a página fecha
 * com o nome do arquivo.
 */
function mapaUrlsOperations(dirHelp: string): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const guia of readdirSync(dirHelp)) {
    const toc = join(dirHelp, guia, 'TOC.md')
    if (!existsSync(toc)) continue
    const { corpo } = lerSemFrontmatter(readFileSync(toc, 'utf-8'))
    const titulo = /^# .*\{#([^}]+)\}/m.exec(corpo)
    if (!titulo) continue
    const pilha: Array<{ indent: number; id: string }> = []
    for (const linha of corpo.split('\n')) {
      const m = /^(\s*)[+-]\s+(.*)$/.exec(linha)
      if (!m) continue
      const indent = m[1].replace(/\t/g, '    ').length
      while (pilha.length && pilha[pilha.length - 1].indent >= indent) pilha.pop()
      const link = /\]\(([^)]+\.md)\)/.exec(m[2])
      if (link) {
        let alvo = link[1]
        alvo = alvo.startsWith('/help/')
          ? alvo.slice('/help/'.length)
          : posix.join(guia, posix.normalize(alvo))
        const segs = [titulo[1], ...pilha.map((p) => p.id), basename(alvo, '.md')]
        if (!mapa.has(alvo))
          mapa.set(
            alvo,
            `https://experienceleague.adobe.com/en/docs/commerce-operations/${segs.join('/')}`
          )
        continue
      }
      const grupo = /\{#([^}]+)\}\s*$/.exec(m[2])
      if (grupo) pilha.push({ indent, id: grupo[1] })
    }
  }
  return mapa
}

// ─── limpeza do markdown ─────────────────────────────────────────────────────

interface Contexto {
  fonte: Fonte
  dirClone: string
  abs: string
  porAbs: Map<string, Arquivo>
  snippets: Map<string, string>
}

function expandirInclusoes(md: string, ctx: Contexto, abs: string, profundidade = 0): string {
  if (profundidade > 4) return md
  const raizPaginas = join(ctx.dirClone, ctx.fonte.raiz)
  // Adobe Developer (MDX): <Fragment src="..."/>
  md = md.replace(/<Fragment\s+src="([^"]+)"\s*\/>/g, (_, src: string) => {
    const alvo = src.startsWith('/') ? join(raizPaginas, src) : resolve(dirname(abs), src)
    if (!existsSync(alvo)) return ''
    const { corpo } = lerSemFrontmatter(readFileSync(alvo, 'utf-8'))
    return expandirInclusoes(corpo, ctx, alvo, profundidade + 1)
  })
  // Experience League: {{$include /help/...}}
  md = md.replace(/\{\{\$include\s+([^}\s]+)\s*\}\}/g, (_, src: string) => {
    const alvo = src.startsWith('/') ? join(ctx.dirClone, src) : resolve(dirname(abs), src)
    if (!existsSync(alvo)) return ''
    const { corpo } = lerSemFrontmatter(readFileSync(alvo, 'utf-8'))
    return expandirInclusoes(corpo, ctx, alvo, profundidade + 1)
  })
  // Experience League: {{snippet}} de help/_includes/snippets.md
  md = md.replace(/\{\{([a-z0-9-]+)\}\}/g, (todo, id: string) => ctx.snippets.get(id) ?? todo)
  return md
}

function reescreverLinks(texto: string, ctx: Contexto): string {
  const resolver = (alvo: string): string | null => {
    const m = /^([^#\s]+\.md)(#[^\s)]*)?$/.exec(alvo)
    if (!m || /^[a-z]+:/i.test(m[1])) return null
    const raizPaginas = join(ctx.dirClone, ctx.fonte.raiz)
    let abs: string
    if (m[1].startsWith('/help/')) abs = join(ctx.dirClone, m[1])
    else if (m[1].startsWith('/')) abs = join(raizPaginas, m[1])
    else abs = resolve(dirname(ctx.abs), m[1])
    const arq = ctx.porAbs.get(abs)
    if (!arq) return null
    return arq.url + (m[2] ?? '')
  }
  texto = texto.replace(/\]\(([^)\s]+)\)/g, (todo, alvo: string) => {
    const novo = resolver(alvo)
    return novo ? `](${novo})` : todo
  })
  texto = texto.replace(/^(\[[^\]]+\]:\s*)(\S+)/gm, (todo, ini: string, alvo: string) => {
    const novo = resolver(alvo)
    return novo ? ini + novo : todo
  })
  return texto
}

/** `[!DNL Nome]` e `[!UICONTROL Botão]` do Experience League viram o texto puro. */
function tirarMarcasEl(t: string): string {
  t = t.replace(/\[!(?:DNL|UICONTROL)\s+(\[[^\]]*\]\([^)]*\))\]/g, '$1')
  let antes: string
  do {
    antes = t
    t = t.replace(/\[!(?:DNL|UICONTROL|BADGE)\s+([^[\]]*)\]/g, '$1')
  } while (t !== antes)
  return t
}

function limparProsa(t: string, ctx: Contexto): string {
  t = t.replace(/<!--[\s\S]*?-->/g, '')
  t = t.replace(/<svg[\s\S]*?<\/svg>/gi, '')
  t = t.replace(/<\/?iframe[^>]*>/gi, '')
  t = t.replace(/<img\b[^>]*>/gi, '')
  // Componentes MDX de layout (<InlineAlert slots="text"/>, <Edition .../>, <HorizontalLine />...).
  // Placeholders como <Vendor> ou <VendorName_ModuleName> não têm atributos e ficam.
  t = t.replace(/<[A-Z][A-Za-z]*\s+[^<>]*=[^<>]*\/>/g, '')
  t = t.replace(/<HorizontalLine\s*\/>/g, '')
  // Experience League
  t = tirarMarcasEl(t)
  t = t.replace(
    />\s*\[!(NOTE|INFO|WARNING|TIP|IMPORTANT|CAUTION|MORELIKETHIS|PREREQUISITES|AVAILABILITY)\]/g,
    '> **$1:**'
  )
  t = t.replace(/\[!(?:BEGINTABS|ENDTABS|BEGINSHADEBOX|ENDSHADEBOX)\]/g, '')
  t = t.replace(/^>?\s*\[!VIDEO\]\([^)]*\)\s*$/gm, '')
  t = t.replace(/\[!TAB\s+([^\]]*)\]/g, '**$1**')
  t = t.replace(/\{(?:style|width|height|align|modal|zoomable|class|target)=[^}]*\}/g, '')
  t = t.replace(/^\[\/\/\]: # .*$/gm, '')
  t = t.replace(/^\{:[^}]*\}$/gm, '')
  // Imagens não vão no pacote
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  // HTML de tabelas e formatação
  t = t.replace(/<\/tr>/gi, '\n')
  t = t.replace(/<t[dh]\b[^>]*>/gi, ' | ')
  t = t.replace(/<\/t[dh]>/gi, '')
  t = t.replace(/<br\s*\/?>/gi, ' ')
  t = t.replace(/<li\b[^>]*>/gi, '\n- ')
  t = t.replace(/<\/li>/gi, '')
  t = t.replace(/<\/?code>/gi, '`')
  t = t.replace(new RegExp(`</?(?:${TAGS_HTML})\\b[^>]*>`, 'gi'), '')
  t = t.replace(/&[#a-z0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e)
  t = reescreverLinks(t, ctx)
  t = t.replace(/[ \t]+$/gm, '')
  return t
}

function limpar(md: string, ctx: Contexto): string {
  md = expandirInclusoes(md, ctx, ctx.abs)
  return segmentos(md)
    .map((s) => (s.codigo ? s.texto : limparProsa(s.texto, ctx)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function dividirSecoes(md: string, titulo: string): Seccion[] {
  const secoes: Seccion[] = []
  let atual: Seccion = { h: titulo, a: '', l: 1, t: '' }
  const buffer: string[] = []
  const fechar = () => {
    atual.t = buffer.join('\n').trim()
    if (atual.t || atual.l > 1) secoes.push(atual)
    buffer.length = 0
  }
  for (const seg of segmentos(md)) {
    if (seg.codigo) {
      buffer.push(seg.texto)
      continue
    }
    for (const linha of seg.texto.split('\n')) {
      const m = /^(#{1,3})\s+(.+?)\s*$/.exec(linha)
      if (!m) {
        buffer.push(linha)
        continue
      }
      let texto = m[2]
      let ancora = ''
      const explicita = /\s*\{#([^}]+)\}\s*$/.exec(texto)
      if (explicita) {
        ancora = explicita[1]
        texto = texto.slice(0, explicita.index).trim()
      }
      if (m[1].length === 1 && secoes.length === 0 && !buffer.join('').trim()) {
        // o H1 é o título da página
        atual.h = texto.replace(/`/g, '')
        continue
      }
      fechar()
      atual = { h: texto, a: ancora || slug(texto), l: m[1].length, t: '' }
    }
  }
  fechar()
  return secoes
}

// ─── referência estruturada: CLI, REST, GraphQL ──────────────────────────────

interface OpcaoCli {
  name: string
  aliases: string[]
  description: string
  details: string[]
}

interface ComandoCli {
  name: string
  usage: string
  description: string
  arguments: OpcaoCli[]
  options: OpcaoCli[]
}

function lerCli(arquivo: string) {
  const { corpo } = lerSemFrontmatter(readFileSync(arquivo, 'utf-8'))
  const versao = /\*\*Version\*\*:\s*([0-9.]+)/.exec(corpo)?.[1] ?? ''
  const blocos = corpo.split(/^## /m).slice(1)
  const comandos: ComandoCli[] = []
  let globais: OpcaoCli[] = []

  const lerEntradas = (texto: string): OpcaoCli[] => {
    const out: OpcaoCli[] = []
    for (const parte of texto.split(/^#### /m).slice(1)) {
      const [cab, ...resto] = parte.split('\n')
      const nomes = [...cab.matchAll(/`([^`]+)`/g)].map((m) => m[1])
      const descricao: string[] = []
      const detalhes: string[] = []
      for (const l of resto) {
        if (/^- /.test(l)) detalhes.push(l.slice(2).trim())
        else if (l.trim() && !l.startsWith('#')) descricao.push(l.trim())
      }
      out.push({
        name: nomes[0] ?? cab.trim(),
        aliases: nomes.slice(1),
        description: descricao.join(' '),
        details: detalhes,
      })
    }
    return out
  }

  for (const bloco of blocos) {
    const [cab, ...resto] = bloco.split('\n')
    const texto = resto.join('\n')
    if (cab.trim() === 'General') {
      const g = texto.split(/^### Global options/m)[1] ?? ''
      globais = lerEntradas(g)
      continue
    }
    const nome = /^`([^`]+)`/.exec(cab)?.[1]
    if (!nome) continue
    const usage = /```shell\n([\s\S]*?)\n```/.exec(texto)?.[1].trim() ?? ''
    const semUso = texto.replace(/```shell\n[\s\S]*?\n```/, '')
    const [antes] = semUso.split(/^### /m)
    const args = /^### Arguments\n([\s\S]*?)(?=^### |$(?![\s\S]))/m.exec(semUso)?.[1] ?? ''
    const opts = /^### Options\n([\s\S]*?)(?=^### |$(?![\s\S]))/m.exec(semUso)?.[1] ?? ''
    comandos.push({
      name: nome,
      usage,
      description: antes.replace(/\n{2,}/g, '\n').trim(),
      arguments: lerEntradas(args),
      options: lerEntradas(opts),
    })
  }
  return { version: versao, globalOptions: globais, commands: comandos }
}

interface ParamRest {
  name: string
  in: string
  required: boolean
  type: string
  description?: string
}

function tipoSwagger(s: any): string {
  if (!s) return ''
  if (s.$ref) return String(s.$ref).replace('#/definitions/', '')
  if (s.type === 'array') return `${tipoSwagger(s.items)}[]`
  return s.type ?? (s.properties ? 'object' : '')
}

function lerRest(dirOpenapi: string, versao: string) {
  const ler = (nome: string) =>
    parseYaml(readFileSync(join(dirOpenapi, nome), 'utf-8'), { maxAliasCount: -1 }) as any
  const admin = ler(`admin-schema-${versao}.yaml`)
  const cliente = ler(`customer-schema-${versao}.yaml`)
  const convidado = ler(`guest-schema-${versao}.yaml`)
  const tem = (doc: any, p: string, m: string) => Boolean(doc.paths?.[p]?.[m])
  const endpoints: any[] = []
  for (const [p, metodos] of Object.entries<any>(admin.paths ?? {})) {
    for (const [m, op] of Object.entries<any>(metodos)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(m)) continue
      const params: ParamRest[] = []
      let body: Array<{ name: string; type: string; required: boolean }> | undefined
      for (const par of op.parameters ?? []) {
        if (par.in === 'body') {
          const props = par.schema?.properties ?? {}
          const req: string[] = par.schema?.required ?? []
          body = Object.entries<any>(props).map(([n, s]) => ({
            name: n,
            type: tipoSwagger(s),
            required: req.includes(n),
          }))
          continue
        }
        params.push({
          name: par.name,
          in: par.in,
          required: Boolean(par.required),
          type: par.type ?? tipoSwagger(par.schema),
          ...(par.description ? { description: String(par.description) } : {}),
        })
      }
      const access = ['admin']
      if (tem(cliente, p, m)) access.push('customer')
      if (tem(convidado, p, m)) access.push('guest')
      endpoints.push({
        method: m.toUpperCase(),
        path: p,
        operationId: op.operationId,
        description: op.description ?? '',
        tags: op.tags ?? [],
        parameters: params,
        ...(body ? { body } : {}),
        returns: tipoSwagger(op.responses?.['200']?.schema),
        access,
      })
    }
  }
  return {
    version: admin.info?.version ?? versao,
    title: admin.info?.title ?? '',
    basePath: admin.basePath ?? '',
    source: `commerce-webapi/src/openapi/admin-schema-${versao}.yaml`,
    accessSources: [
      `commerce-webapi/src/openapi/customer-schema-${versao}.yaml`,
      `commerce-webapi/src/openapi/guest-schema-${versao}.yaml`,
    ],
    referenceUrl: 'https://developer.adobe.com/commerce/webapi/reference/rest/paas/',
    endpoints,
  }
}

function lerGraphql(
  arquivo: string,
  tipo: 'query' | 'mutation',
  guias: Map<string, { id: string; url: string }>
) {
  const corpo = readFileSync(arquivo, 'utf-8')
  const versao = /## Version\s+([0-9.]+)/.exec(corpo)?.[1] ?? ''
  const secao = tipo === 'query' ? '## Queries' : '## Mutations'
  const ini = corpo.indexOf(secao)
  const texto = ini >= 0 ? corpo.slice(ini + secao.length) : corpo
  const itens: any[] = []
  for (const parte of texto.split(/^### /m).slice(1)) {
    const [cab, ...resto] = parte.split('\n')
    const nome = cab.trim()
    if (!/^[A-Za-z_]\w*$/.test(nome)) continue
    const r = resto.join('\n')
    const descricao = r
      .split(/\*\*Response:\*\*/)[0]
      .replace(/<[^>]+>/g, '')
      .trim()
    const resposta = /\*\*Response:\*\*\s*\[`([^`]+)`\]/.exec(r)?.[1] ?? ''
    const args: Array<{ name: string; type: string; description: string }> = []
    const tabela = /#### Arguments\n([\s\S]*?)(?=\n#### |$(?![\s\S]))/.exec(r)?.[1] ?? ''
    for (const l of tabela.split('\n')) {
      const m = /^\|\s*`([^`]+)`\s*-\s*\[`([^`]+)`\]\([^)]*\)\s*\|\s*(.*?)\s*\|\s*$/.exec(l)
      if (m) args.push({ name: m[1], type: m[2], description: m[3].replace(/<[^>]+>/g, '') })
    }
    const exemplo = /```graphql\n([\s\S]*?)\n```/.exec(r)?.[1] ?? ''
    const guia = guias.get(nome)
    itens.push({
      name: nome,
      kind: tipo,
      description: descricao,
      returns: resposta,
      arguments: args,
      example: exemplo,
      referenceUrl: `https://developer.adobe.com/commerce/webapi/reference/graphql/latest/${tipo === 'mutation' ? 'mutations/' : ''}#${nome.toLowerCase()}`,
      ...(guia ? { guide: guia } : {}),
    })
  }
  return { version: versao, itens }
}

// ─── principal ───────────────────────────────────────────────────────────────

function main() {
  const dirFontes = resolve(process.argv[2] ?? process.env.FONTES_DIR ?? '')
  if (!process.argv[2] && !process.env.FONTES_DIR) {
    console.error('Uso: npm run ingerir -- <pasta-dos-clones>  (ou FONTES_DIR=<pasta>)')
    process.exit(1)
  }
  for (const f of FONTES) {
    if (!existsSync(join(dirFontes, f.repo, f.raiz))) {
      console.error(`Falta o clone ${f.repo} em ${dirFontes}`)
      process.exit(1)
    }
  }

  // 1. arquivos e URLs
  const arquivos: Arquivo[] = []
  const urlsOps = mapaUrlsOperations(join(dirFontes, 'commerce-operations.en', 'help'))
  let opsSemToc = 0
  for (const fonte of FONTES) {
    const raiz = join(dirFontes, fonte.repo, fonte.raiz)
    for (const abs of listarMd(raiz)) {
      const rel = relative(raiz, abs).split('\\').join('/')
      let url: string
      if (fonte.area === 'operations') {
        const daToc = urlsOps.get(rel)
        if (!daToc) opsSemToc++
        url = daToc ?? ''
      } else {
        url = urlAdobeDev(fonte, rel)
      }
      arquivos.push({ fonte, abs, rel, id: `${fonte.area}/${rel}`, url })
    }
  }
  const porAbs = new Map(arquivos.map((a) => [a.abs, a]))

  // snippets do Experience League
  const snippets = new Map<string, string>()
  const snippetsArq = join(dirFontes, 'commerce-operations.en', 'help', '_includes', 'snippets.md')
  if (existsSync(snippetsArq)) {
    const { corpo } = lerSemFrontmatter(readFileSync(snippetsArq, 'utf-8'))
    for (const parte of corpo.split(/^## /m).slice(1)) {
      const [cab, ...resto] = parte.split('\n')
      const id = /\{#([^}]+)\}/.exec(cab)?.[1]
      if (id) snippets.set(id, resto.join('\n').trim())
    }
  }

  // 2. documentos
  const docs: Doc[] = []
  let semUrl = 0
  for (const arq of arquivos) {
    if (arq.fonte.excluir(arq.rel)) continue
    if (!arq.url) {
      // página do Experience League que nenhum TOC publica
      semUrl++
      continue
    }
    const dirClone = join(dirFontes, arq.fonte.repo)
    const bruto = readFileSync(arq.abs, 'utf-8')
    const { meta, corpo } = lerSemFrontmatter(bruto)
    const ctx: Contexto = { fonte: arq.fonte, dirClone, abs: arq.abs, porAbs, snippets }
    const limpo = limpar(corpo, ctx)
    const tituloMeta = tirarMarcasEl(meta.title ?? '')
      .replace(/\s*\|.*$/, '')
      .trim()
    const secoes = dividirSecoes(limpo, tituloMeta || basename(arq.rel, '.md'))
    if (!secoes.length) continue
    const title = secoes[0].l === 1 ? secoes[0].h : tituloMeta
    docs.push({
      id: arq.id,
      area: arq.fonte.area,
      repo: arq.fonte.repo,
      source: `${arq.fonte.repo}/${arq.fonte.raiz}/${arq.rel}`,
      title: title || tituloMeta,
      description: tirarMarcasEl(meta.description ?? ''),
      url: arq.url,
      sections: secoes,
    })
  }

  // 3. conferência das URLs contra os links que as próprias fontes publicam
  const conhecidas = new Set<string>()
  const norm = (u: string) =>
    u
      .replace(/^https?:\/\//, '')
      .replace(/[#?].*$/, '')
      .replace(/\.html$/, '')
      .replace(/\/$/, '')
      .replace('experienceleague.adobe.com/docs/', 'experienceleague.adobe.com/en/docs/')
  for (const fonte of FONTES) {
    for (const abs of listarMd(join(dirFontes, fonte.repo, fonte.raiz))) {
      const t = readFileSync(abs, 'utf-8')
      for (const m of t.matchAll(
        /https?:\/\/(?:developer\.adobe\.com\/commerce\/(?:php|frontend-core|webapi)|experienceleague\.adobe\.com\/(?:en\/)?docs\/commerce-operations)\/[A-Za-z0-9/_.-]*/g
      )) {
        conhecidas.add(norm(m[0]))
      }
    }
  }
  const conferencia: Record<string, { docs: number; citadas: number }> = {}
  for (const d of docs) {
    conferencia[d.area] ??= { docs: 0, citadas: 0 }
    conferencia[d.area].docs++
    if (conhecidas.has(norm(d.url))) conferencia[d.area].citadas++
  }

  // 4. escrita
  rmSync(DATA, { recursive: true, force: true })
  mkdirSync(join(DATA, 'docs'), { recursive: true })
  mkdirSync(join(DATA, 'webapi'), { recursive: true })
  for (const area of ['php', 'frontend', 'webapi', 'operations'] as Area[]) {
    const lista = docs.filter((d) => d.area === area)
    writeFileSync(join(DATA, 'docs', `${area}.json`), JSON.stringify(lista))
  }

  const commit = (repo: string) =>
    execFileSync('git', ['-C', join(dirFontes, repo), 'rev-parse', 'HEAD'], {
      encoding: 'utf-8',
    }).trim()
  const fonteJson = FONTES.map((f) => {
    const licenca = readFileSync(join(dirFontes, f.repo, f.archivoLicencia), 'utf-8')
    return {
      repo: `AdobeDocs/${f.repo}`,
      url: `https://github.com/AdobeDocs/${f.repo}`,
      commit: commit(f.repo),
      license: f.licencia,
      licenseFile: f.archivoLicencia,
      licenseHeader:
        licenca
          .split('\n')
          .find((l) => l.trim())
          ?.trim() ?? '',
      area: f.area,
      publicUrl: f.url,
      documents: docs.filter((d) => d.area === f.area).length,
    }
  })
  writeFileSync(join(DATA, 'fonte.json'), JSON.stringify(fonteJson, null, 2) + '\n')

  // As licenças das fontes viajam com os dados: Apache-2.0 e MIT pedem a cópia da licença
  // e do aviso de copyright junto de qualquer redistribuição.
  mkdirSync(join(DATA, 'licenses'), { recursive: true })
  for (const f of FONTES) {
    const partes = [readFileSync(join(dirFontes, f.repo, f.archivoLicencia), 'utf-8').trim()]
    const copyright = join(dirFontes, f.repo, 'COPYRIGHT')
    if (existsSync(copyright)) partes.unshift(readFileSync(copyright, 'utf-8').trim())
    writeFileSync(join(DATA, 'licenses', `${f.repo}.txt`), partes.join('\n\n---\n\n') + '\n')
  }

  // CLI
  const cliArq = join(
    dirFontes,
    'commerce-operations.en/help/_includes/templated/reference/cli/commerce-on-premises.md'
  )
  const cli = lerCli(cliArq)
  writeFileSync(
    join(DATA, 'cli.json'),
    JSON.stringify({
      source:
        'commerce-operations.en/help/_includes/templated/reference/cli/commerce-on-premises.md',
      url: urlsOps.get('tools/reference/commerce-on-premises.md') ?? '',
      ...cli,
    })
  )

  // REST
  const rest = lerRest(join(dirFontes, 'commerce-webapi/src/openapi'), '2.4.9')
  writeFileSync(join(DATA, 'webapi', 'rest.json'), JSON.stringify(rest))

  // GraphQL: guias por nome (o H1 é "<nome> query" ou "<nome> mutation")
  const guias = new Map<string, { id: string; url: string }>()
  for (const d of docs) {
    if (d.area !== 'webapi' || !/^webapi\/graphql\/schema\/.*\/(queries|mutations)\//.test(d.id))
      continue
    const m = /^`?([A-Za-z_]\w*)`?\s+(query|mutation)\b/i.exec(d.title)
    if (m && !guias.has(m[1])) guias.set(m[1], { id: d.id, url: d.url })
  }
  const auto = join(dirFontes, 'commerce-webapi/src/pages/includes/autogenerated')
  const q = lerGraphql(join(auto, 'graphql-api-2-4-9-queries.md'), 'query', guias)
  const mu = lerGraphql(join(auto, 'graphql-api-2-4-9-mutations.md'), 'mutation', guias)
  writeFileSync(
    join(DATA, 'webapi', 'graphql.json'),
    JSON.stringify({
      version: q.version,
      sources: [
        'commerce-webapi/src/pages/includes/autogenerated/graphql-api-2-4-9-queries.md',
        'commerce-webapi/src/pages/includes/autogenerated/graphql-api-2-4-9-mutations.md',
      ],
      operations: [...q.itens, ...mu.itens],
    })
  )

  // Catálogo de arquivos de configuração: cada fonte tem de existir e a URN tem de aparecer nela.
  const porId = new Map(docs.map((d) => [d.id, d]))
  const erros: string[] = []
  const catalogo = CATALOGO_CONFIG.map((e) => {
    const links = e.sources.map((id) => {
      const d = porId.get(id)
      if (!d) erros.push(`${e.file}: a fonte ${id} não está entre os documentos`)
      return { id, title: d?.title ?? '', url: d?.url ?? '' }
    })
    if (e.urn) {
      const achou = e.sources.some((id) => {
        const d = porId.get(id)
        return d?.sections.some((s) => s.t.includes(e.urn!) || s.h.includes(e.urn!))
      })
      if (!achou) erros.push(`${e.file}: a URN ${e.urn} não aparece nas fontes citadas`)
    }
    return { ...e, links }
  })
  if (erros.length) {
    console.error(erros.join('\n'))
    process.exit(1)
  }
  writeFileSync(join(DATA, 'config-files.json'), JSON.stringify(catalogo, null, 2) + '\n')

  // relatório
  const bytes = (area: Area) => statSync(join(DATA, 'docs', `${area}.json`)).size
  console.log('Documentos por área:')
  for (const [area, c] of Object.entries(conferencia)) {
    console.log(
      `  ${area}: ${c.docs} documentos, ${(bytes(area as Area) / 1e6).toFixed(1)} MB; URL citada pelas próprias fontes em ${c.citadas}`
    )
  }
  console.log(
    `Páginas do Experience League fora de qualquer TOC (sem URL, puladas): ${semUrl} (${opsSemToc} no total, contando as excluídas)`
  )
  console.log(`CLI: ${cli.commands.length} comandos (versão ${cli.version})`)
  console.log(`REST: ${rest.endpoints.length} endpoints (versão ${rest.version})`)
  console.log(
    `GraphQL: ${q.itens.length} queries e ${mu.itens.length} mutations (versão ${q.version}); ${guias.size} guias`
  )
  console.log(`Catálogo de configuração: ${catalogo.length} arquivos`)
}

main()
