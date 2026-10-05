import type { EngineInterface, Register } from 'claude-code'

import { linkify } from './linkify'

const CACHE_LIMIT = 500
const MARKDOWN_LIMIT = 10_000
const PRESSABLE_LIMIT = 256
const FILE_LINK = /\]\((file:\/\/[^)\s]+)\)/g

const rendered = new Map<string, string>()
const exists = new Map<string, boolean>()
let opener: string | undefined

async function rewrite($: EngineInterface, text: string): Promise<string> {
  const hit = rendered.get(text)
  if (hit !== undefined) return hit

  const home = (await $.env.get('HOME')) ?? ''
  const cwd = await $.session.cwd()
  const isAbsolute = (p: string) => p.startsWith('/') || p.startsWith('~/')
  const absolute = (p: string) => (p.startsWith('~/') ? home + p.slice(1) : p.startsWith('/') ? p : `${cwd}/${p}`)

  // Absolute paths link as written; relative ones only when the file is there.
  const pending: string[] = []
  linkify(text, p => {
    const abs = absolute(p)
    if (!isAbsolute(p) && !exists.has(abs)) pending.push(abs)
    return undefined
  })
  for (const abs of pending) exists.set(abs, await $.fs.exists(abs).catch(() => false))

  const out = linkify(text, p => (isAbsolute(p) || exists.get(absolute(p)) ? absolute(p) : undefined))
  if (rendered.size >= CACHE_LIMIT) rendered.delete(rendered.keys().next().value!)
  rendered.set(text, out)
  return out
}

// Opens a file in its default app, rather than letting the terminal reveal it.
async function openFile($: EngineInterface, href: string) {
  opener ??= (await $.process.run(['uname'])).stdout.trim() === 'Darwin' ? 'open' : 'xdg-open'
  const path = decodeURI(href.replace(/^file:\/\//, ''))
  const ran = await $.process.run([opener, path]).catch(() => undefined)
  if (!ran || ran.exitCode !== 0) $.ui.toast(`Couldn't open ${path}`)
}

function fileLinks(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(FILE_LINK)].map(m => m[1]!))]
}

// Draws the text with clickable file links: the mod's own Markdown in the terminal,
// where it can answer clicks, else Claude Code's drawing with the rewritten text.
async function render($: EngineInterface, e: any, next: any, gutter: { text: string; isDim: boolean }) {
  const text: string = e.props.text
  const out = await rewrite($, text)
  const files = fileLinks(out)
  if (e.surface !== 'terminal' || files.length === 0 || out.length > MARKDOWN_LIMIT || files.length > PRESSABLE_LIMIT) {
    return out === text ? next(e) : next({ ...e, props: { ...e.props, text: out } })
  }

  const { Box, Text, Markdown } = $.ui.resolve(e)
  return (
    <Box flexDirection="row">
      <Box width={gutter.text.length} flexShrink={0}>
        <Text dimColor={gutter.isDim}>{gutter.text}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Markdown
          key={`links-${e.requestId}`}
          text={out}
          dimColor={gutter.isDim}
          pressableLinks={files}
          onLinkPress={(link: { href: string }) => void openFile($, link.href)}
        />
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e: any, next) =>
    render($, e, next, { text: e.props.isFirstOfReply ? '● ' : '  ', isDim: false }))

  on('ui.render', { component: 'CommandOutput' }, async ($, e: any, next) =>
    e.props.isErrored ? next(e) : render($, e, next, { text: '  ⎿  ', isDim: true }))
}
