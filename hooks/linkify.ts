// Turns file paths in markdown into links, leaving fences and existing links alone.

export type Resolve = (path: string) => string | undefined

const PATH = String.raw`~?/(?:[\w.@%+-]+/)+[\w.@%+-]+|(?:[\w.@-]+/)+[\w@-][\w.@-]*\.\w+`
const TOKEN = new RegExp(
  [
    String.raw`!?\[[^\]\n]*\]\([^)\n]*\)`, // existing link or image
    String.raw`<[a-z]+:[^>\s]+>`, // autolink
    String.raw`(\x60+)([^\x60\n]+?)\1(?!\x60)`, // code span: groups 1, 2
    String.raw`[a-z][\w+.-]*://[^\s<>()\[\]\x60"']+`, // URL, left as is
    String.raw`(?<![\w/.~\-])(?:${PATH})(?::\d+(?::\d+)?)?`, // bare path
  ].join('|'),
  'g',
)
const WHOLE_PATH = new RegExp(String.raw`^(${PATH})(?::(\d+)(?::\d+)?)?$`)
const TRAILING = /[.,;:!?)'"]+$/

function fileHref(abs: string): string {
  return 'file://' + encodeURI(abs).replace(/[?#]/g, encodeURIComponent)
}

// The href for a path, or undefined when it shouldn't link.
function hrefFor(target: string, resolve: Resolve): string | undefined {
  const m = WHOLE_PATH.exec(target)
  if (!m) return undefined
  const abs = resolve(m[1]!)
  return abs ? fileHref(abs) : undefined
}

function linkifyProse(text: string, resolve: Resolve): string {
  return text.replace(TOKEN, (match, ticks: string | undefined, inner: string | undefined) => {
    if (match.startsWith('[') || match.startsWith('![') || match.startsWith('<') || match.includes('://')) return match
    if (ticks !== undefined) {
      const href = hrefFor(inner!.trim(), resolve)
      return href ? `[${match}](${href})` : match
    }
    const trail = TRAILING.exec(match)?.[0] ?? ''
    const core = match.slice(0, match.length - trail.length)
    const href = core ? hrefFor(core, resolve) : undefined
    return href ? `[${core}](${href})${trail}` : match
  })
}

export function linkify(markdown: string, resolve: Resolve): string {
  // Odd-indexed parts are fenced code blocks.
  const parts = markdown.split(/(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?(?:^ {0,3}(?:```|~~~)[ \t]*$|(?![\s\S])))/m)
  return parts.map((part, i) => (i % 2 ? part : linkifyProse(part, resolve))).join('')
}
