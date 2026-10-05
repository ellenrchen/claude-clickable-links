import type { Register } from 'claude-code'

import { linkify } from './linkify'

const CACHE_LIMIT = 500
const rendered = new Map<string, string>()
const exists = new Map<string, boolean>()

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e: any, next) => {
    const text: string = e.props.text
    const hit = rendered.get(text)
    if (hit !== undefined) return hit === text ? next(e) : next({ ...e, props: { ...e.props, text: hit } })

    const home = (await $.env.get('HOME')) ?? ''
    const cwd = await $.session.cwd()
    const absolute = (p: string) => (p.startsWith('~/') ? home + p.slice(1) : p.startsWith('/') ? p : `${cwd}/${p}`)

    // Absolute paths link as written; relative ones only when the file is there.
    const pending: string[] = []
    linkify(text, p => {
      const abs = absolute(p)
      if (!p.startsWith('/') && !p.startsWith('~/') && !exists.has(abs)) pending.push(abs)
      return undefined
    })
    for (const abs of pending) exists.set(abs, await $.fs.exists(abs).catch(() => false))

    const out = linkify(text, p => {
      const abs = absolute(p)
      return p.startsWith('/') || p.startsWith('~/') || exists.get(abs) ? abs : undefined
    })
    if (rendered.size >= CACHE_LIMIT) rendered.delete(rendered.keys().next().value!)
    rendered.set(text, out)
    return out === text ? next(e) : next({ ...e, props: { ...e.props, text: out } })
  })
}
