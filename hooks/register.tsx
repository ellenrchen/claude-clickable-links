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

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e: any, next) => {
    const text: string = e.props.text
    const out = await rewrite($, text)
    if (out === text) return next(e)

    const files = [...new Set([...out.matchAll(FILE_LINK)].map(m => m[1]!))]
    // A click on a file link only reaches the mod where the terminal reports clicks.
    if (e.surface !== 'terminal' || files.length === 0 || out.length > MARKDOWN_LIMIT || files.length > PRESSABLE_LIMIT) {
      return next({ ...e, props: { ...e.props, text: out } })
    }

    const { Box, Text, Markdown } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Box width={2} flexShrink={0}>
          <Text>{e.props.isFirstOfReply ? '●' : ' '}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          <Markdown
            key={`reply-${e.requestId}`}
            text={out}
            pressableLinks={files}
            onLinkPress={(link: { href: string }) => void openFile($, link.href)}
          />
        </Box>
      </Box>
    )
  })
}
