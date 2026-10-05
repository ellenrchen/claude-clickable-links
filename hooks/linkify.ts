// Turns file paths and file links in markdown into file:// links, leaving fences and URLs alone.

export type Resolve = (path: string) => string | undefined

const PATH = String.raw`~?/(?:[\w.@%+-]+/)+[\w.@%+-]+|(?:[\w.@-]+/)+[\w@-][\w.@-]*\.\w+`
const LINE = String.raw`(?::\d+(?::\d+)?)?`
const TOKEN = new RegExp(
  [
    String.raw`(?<bang>!?)\[(?<label>[^\]\n]*)\]\((?<href>[^)\s]*)\)`, // existing link or image
    String.raw`<[a-z]+:[^>\s]+>`, // autolink
    String.raw`(?<ticks>\x60+)(?<inner>[^\x60\n]+?)\k<ticks>(?!\x60)`, // code span
    String.raw`[a-z][\w+.-]*://[^\s<>()\[\]\x60"']+`, // URL, left as is
    String.raw`(?<![\w/.~\-])(?:${PATH})${LINE}`, // bare path
  ].join('|'),
  'gi',
)
const WHOLE_PATH = new RegExp(String.raw`^(${PATH})${LINE}$`)
// A lone file name, linked only in backticks, where it can't be prose.
const FILE_NAME = new RegExp(String.raw`^([\w@-][\w.@-]*\.[A-Za-z]\w*)${LINE}$`)
const SCHEME = /^[a-z][\w+.-]*:/i
const TRAILING = /[.,;:!?)'"]+$/

type Groups = { bang?: string; label?: string; href?: string; ticks?: string; inner?: string }

function fileHref(abs: string): string {
  return 'file://' + encodeURI(abs).replace(/[?#]/g, encodeURIComponent)
}

function decode(s: string): string {
  try {
    return decodeURI(s)
  } catch {
    return s
  }
}

function pathHref(path: string, resolve: Resolve): string | undefined {
  const abs = resolve(path)
  return abs ? fileHref(abs) : undefined
}

// An existing link's href as a file:// link, when it points at a file.
function linkHref(href: string, resolve: Resolve): string | undefined {
  if (/^file:\/\//i.test(href)) return href
  if (!href || href.startsWith('#') || SCHEME.test(href)) return undefined
  return pathHref(decode(href).replace(/(?:#.*|:\d+(?::\d+)?)$/, ''), resolve)
}

function linkifyProse(text: string, resolve: Resolve): string {
  return text.replace(TOKEN, (match: string, ...rest: unknown[]) => {
    const g = rest[rest.length - 1] as Groups
    if (g.href !== undefined) {
      if (g.bang) return match
      const href = linkHref(g.href, resolve)
      return href && href !== g.href ? `[${g.label}](${href})` : match
    }
    if (g.ticks !== undefined) {
      const inner = g.inner!.trim()
      const m = WHOLE_PATH.exec(inner) ?? FILE_NAME.exec(inner)
      const href = m && !inner.includes('://') ? pathHref(m[1]!, resolve) : undefined
      return href ? `[${match}](${href})` : match
    }
    if (match.startsWith('<') || match.includes('://')) return match
    const trail = TRAILING.exec(match)?.[0] ?? ''
    const core = match.slice(0, match.length - trail.length)
    const m = core ? WHOLE_PATH.exec(core) : null
    const href = m ? pathHref(m[1]!, resolve) : undefined
    return href ? `[${core}](${href})${trail}` : match
  })
}

export function linkify(markdown: string, resolve: Resolve): string {
  // Odd-indexed parts are fenced code blocks.
  const parts = markdown.split(/(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?(?:^ {0,3}(?:```|~~~)[ \t]*$|(?![\s\S])))/m)
  return parts.map((part, i) => (i % 2 ? part : linkifyProse(part, resolve))).join('')
}
