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

test('URLs link, bare or in backticks', () => {
  expect(linkify('at https://goduke.com/roster. and `https://goduke.com`', resolve)).toBe(
    'at [https://goduke.com/roster](https://goduke.com/roster). and [`https://goduke.com`](https://goduke.com)',
  )
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

test('the reply row draws with links, relative to the session folder', async ($, on) => {
  on('env.get', () => ({ value: HOME }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('fs.exists', (_t$, e: any) => ({ value: e.path === '/repo/src/roster.ts' }))
  let drawn: string | undefined
  // Stands in for Claude Code's own drawing, which gets the rewritten text
  on('ui.render', { component: 'AssistantMessage' }, async (t$, e: any) => {
    drawn = e.props.text
    const { Text } = t$.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })

  const ui = await $.ui.mount({
    plugin: 'clickable-links',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: 'Edited `src/roster.ts` and `~/notes/game.md`.', isFirstOfReply: true },
  })
  expect(drawn).toBe(
    'Edited [`src/roster.ts`](file:///repo/src/roster.ts) and [`~/notes/game.md`](file:///Users/coach-k/notes/game.md).',
  )
  await ui.unmount()
})
