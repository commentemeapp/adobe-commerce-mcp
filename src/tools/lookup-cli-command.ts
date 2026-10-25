import { z } from 'zod'
import { loadCli, type CliCommand, type CliEntry } from '../knowledge/loader.js'
import { text } from './result.js'

export const lookupCliCommandSchema = {
  command: z
    .string()
    .min(1)
    .describe(
      'A bin/magento command, full or with Symfony shortcuts (e.g. "setup:upgrade", "bin/magento s:up", "indexer:reindex"), or keywords to find one (e.g. "static content deploy", "maintenance")'
    ),
}

function normalize(input: string): string {
  return input
    .trim()
    .replace(/^php\s+/, '')
    .replace(/^(\.\/)?bin\/magento\s+/, '')
    .replace(/^magento\s+/, '')
    .split(/\s+/)[0]
}

/** Symfony shortcut syntax: each ":"-separated part is a prefix of the full name part. */
function matchesShortcut(name: string, short: string): boolean {
  const a = name.split(':')
  const b = short.split(':')
  if (b.length > a.length) return false
  return b.every((p, i) => a[i].startsWith(p))
}

function renderEntries(title: string, list: CliEntry[]): string[] {
  if (!list.length) return []
  const out = [`## ${title}`, '']
  for (const e of list) {
    const names = [e.name, ...e.aliases].map((n) => `\`${n}\``).join(', ')
    out.push(
      `- ${names}: ${e.description || '(no description)'}${e.details.length ? ` (${e.details.join('; ')})` : ''}`
    )
  }
  out.push('')
  return out
}

function renderCommand(c: CliCommand, url: string, version: string): string {
  const lines = [`# bin/magento ${c.name}`, '', c.description, '', '```shell', c.usage, '```', '']
  lines.push(...renderEntries('Arguments', c.arguments))
  lines.push(...renderEntries('Options', c.options))
  lines.push(
    `Global options (\`--help\`, \`--quiet\`, \`--verbose\`, \`--no-interaction\`...) apply to every command.`
  )
  lines.push('', `> Reference for Adobe Commerce ${version} (on-premises): ${url}`)
  return lines.join('\n')
}

export async function lookupCliCommand({ command }: { command: string }) {
  const cli = loadCli()
  const name = normalize(command)
  const exact = cli.commands.find((c) => c.name === name)
  if (exact) return text(renderCommand(exact, cli.url, cli.version))

  if (name.includes(':')) {
    const short = cli.commands.filter((c) => matchesShortcut(c.name, name))
    if (short.length === 1) return text(renderCommand(short[0], cli.url, cli.version))
    if (short.length > 1) {
      return text(
        `"${name}" is ambiguous. It matches:\n\n${short.map((c) => `- \`${c.name}\`: ${c.description}`).join('\n')}`
      )
    }
  }

  const words = command
    .toLowerCase()
    .replace(/bin\/magento/g, '')
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length > 1)
  const scored = cli.commands
    .map((c) => {
      const hay = `${c.name} ${c.description}`.toLowerCase()
      const score = words.reduce(
        (s, w) => s + (c.name.includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0),
        0
      )
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
  if (!scored.length) {
    return text(
      `No bin/magento command matches "${command}". The reference lists ${cli.commands.length} commands.`,
      true
    )
  }
  const lines = [`# Commands matching "${command}"`, '']
  for (const { c } of scored) lines.push(`- \`${c.name}\`: ${c.description}`)
  lines.push('', 'Call lookup-cli-command again with the exact name for options and arguments.')
  return text(lines.join('\n'))
}
