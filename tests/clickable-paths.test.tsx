import { expect, test } from 'claude-code/testing'

import { linkify } from '../hooks/linkify'

const HOME = '/Users/coach-k'
const resolve = (p: string) => (p.startsWith('~/') ? HOME + p.slice(1) : p.startsWith('/') ? p : undefined)

test('a path in backticks links and keeps its code styling', () => {
  expect(linkify('saved to `/Users/coach-k/duke/roster.md`.', resolve)).toBe(
    'saved to [`/Users/coach-k/duke/roster.md`](file:///Users/coach-k/duke/roster.md).',
  )
})

test('a bare path links without its trailing punctuation', () => {
  expect(linkify('see /Users/coach-k/duke/roster.md, then', resolve)).toBe(
    'see [/Users/coach-k/duke/roster.md](file:///Users/coach-k/duke/roster.md), then',
  )
})

test('a home path expands and a line suffix stays in the label only', () => {
  expect(linkify('`~/duke/plays.ts:23`', resolve)).toBe('[`~/duke/plays.ts:23`](file:///Users/coach-k/duke/plays.ts)')
})

test('URLs stay as written, including the path inside them', () => {
  const text = 'at https://goduke.com/Users/coach-k/roster.md and `https://goduke.com`'
  expect(linkify(text, resolve)).toBe(text)
})

test('existing links, fenced code and non-paths stay as written', () => {
  const text = '[Cameron](https://goduke.com) and <https://acc.com>, and/or 1/2, `ls -la`\n```\n/Users/coach-k/a.md\n```\n'
  expect(linkify(text, resolve)).toBe(text)
})

test('a relative path links only when the resolver finds it', () => {
  const found = (p: string) => (p === 'src/roster.ts' ? '/repo/src/roster.ts' : undefined)
  expect(linkify('`src/roster.ts` and `src/missing.ts`', found)).toBe(
    '[`src/roster.ts`](file:///repo/src/roster.ts) and `src/missing.ts`',
  )
})

const REPLY = {
  plugin: 'clickable-paths',
  component: 'AssistantMessage',
  requestId: 'msg-1',
  props: { text: 'Edited `src/roster.ts` and `~/notes/game.md`.', isFirstOfReply: true },
} as const
const LINKED =
  'Edited [`src/roster.ts`](file:///repo/src/roster.ts) and [`~/notes/game.md`](file:///Users/coach-k/notes/game.md).'

function session(on: any) {
  on('env.get', () => ({ value: HOME }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('fs.exists', (_t$: unknown, e: any) => ({ value: e.path === '/repo/src/roster.ts' }))
}

test('in the terminal the reply draws as a Markdown of its own with file links', async ($, on) => {
  session(on)
  const ui = await $.ui.mount({ ...REPLY, surface: 'terminal' })
  const md = await ui.find({ type: 'Markdown' })
  expect(md?.props).toMatchObject({ text: LINKED })
  expect(await ui.find({ type: 'Text', text: '●' })).toBeDefined()
  await ui.unmount()
})

test('clicking a file link opens the file instead of revealing it', async ($, on) => {
  session(on)
  const runs: string[][] = []
  on('process.run', (_t$: unknown, e: any) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: e.argv[0] === 'uname' ? 'Darwin\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const ui = await $.ui.mount({ ...REPLY, surface: 'terminal' })
  await ui.press({ key: 'reply-msg-1', link: { href: 'file:///Users/coach-k/notes/game.md' } })
  expect(runs).toContainEqual(['open', '/Users/coach-k/notes/game.md'])
  await ui.unmount()
})

test('elsewhere the reply keeps the built-in drawing with the rewritten text', async ($, on) => {
  session(on)
  let drawn: string | undefined
  // Stands in for Claude Code's own drawing, which gets the rewritten text
  on('ui.render', { component: 'AssistantMessage' }, async (t$, e: any) => {
    drawn = e.props.text
    const { Text } = t$.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  const ui = await $.ui.mount({ ...REPLY, surface: 'desktop' })
  expect(drawn).toBe(LINKED)
  await ui.unmount()
})
